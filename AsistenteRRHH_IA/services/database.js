/**
 * DatabaseService
 *
 * Gestiona la base de datos SQLite local para almacenamiento persistente de FAQs.
 * Es la ÚNICA fuente de verdad entre sesiones del servidor.
 *
 * Características:
 * - UPSERT real: INSERT OR IGNORE + UPDATE para evitar duplicados
 * - UNIQUE INDEX sobre question_normalized
 * - Campo `source` para trazabilidad (notebooklm | demo)
 * - Campo `knowledge_version` para revalidación inteligente
 * - Búsqueda por similitud con Dice Coefficient
 * - Auto-limpieza cuando se supera MAX_RECORDS
 * - Migración segura compatible con BD existente
 */

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { diceCoefficient } from 'dice-coefficient';

const DB_PATH = path.join(process.cwd(), 'hr_cache.db');
const MAX_RECORDS = 10000;
const SIMILARITY_THRESHOLD = 0.85;

// Marcadores de respuesta negativa/vacía para detección en revalidación
const NEGATIVE_MARKERS = [
    'no se encontró', 'no encontró', 'no existe información',
    'no tengo información', 'no tengo acceso', 'no se menciona',
    'no hay información', 'no está documentado', 'no figura',
    'no se registra', 'el rit no menciona', 'no contempla'
];

class DatabaseService {
    constructor() {
        this.db = null;
    }

    async init() {
        try {
            this.db = await open({
                filename: DB_PATH,
                driver: sqlite3.Database
            });

            // Habilitar WAL para mejor concurrencia y durabilidad
            await this.db.exec(`PRAGMA journal_mode = WAL;`);
            await this.db.exec(`PRAGMA synchronous = NORMAL;`);

            // Crear tabla con todos los campos (si no existe)
            await this.db.exec(`
                CREATE TABLE IF NOT EXISTS knowledge_base (
                    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
                    question_original    TEXT    NOT NULL,
                    question_normalized  TEXT    NOT NULL,
                    answer               TEXT    NOT NULL,
                    category             TEXT    DEFAULT 'general',
                    source               TEXT    DEFAULT 'notebooklm',
                    knowledge_version    INTEGER DEFAULT 0,
                    last_validated       DATETIME DEFAULT CURRENT_TIMESTAMP,
                    usage_count          INTEGER DEFAULT 1,
                    last_used            DATETIME DEFAULT CURRENT_TIMESTAMP,
                    created_at           DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // ── Migración segura: agregar columnas faltantes en BD antigua ──
            const cols = await this.db.all(`PRAGMA table_info(knowledge_base)`);
            const colNames = cols.map(c => c.name);

            if (!colNames.includes('source')) {
                await this.db.exec(`ALTER TABLE knowledge_base ADD COLUMN source TEXT DEFAULT 'notebooklm'`);
                console.log('🔧 [DB Migration] Columna "source" agregada');
            }
            if (!colNames.includes('knowledge_version')) {
                await this.db.exec(`ALTER TABLE knowledge_base ADD COLUMN knowledge_version INTEGER DEFAULT 0`);
                console.log('🔧 [DB Migration] Columna "knowledge_version" agregada');
            }
            if (!colNames.includes('last_validated')) {
                await this.db.exec(`ALTER TABLE knowledge_base ADD COLUMN last_validated DATETIME DEFAULT NULL`);
                console.log('🔧 [DB Migration] Columna "last_validated" agregada');
            }

            // Índices
            await this.db.exec(`CREATE INDEX IF NOT EXISTS idx_category ON knowledge_base(category)`);
            await this.db.exec(`CREATE INDEX IF NOT EXISTS idx_knowledge_version ON knowledge_base(knowledge_version)`);

            // UNIQUE INDEX — corazón del UPSERT real
            await this.db.exec(`
                CREATE UNIQUE INDEX IF NOT EXISTS idx_question_normalized_unique
                ON knowledge_base(question_normalized)
            `);

            console.log(`✅ SQLite Cache Database inicializada en: ${DB_PATH}`);
        } catch (error) {
            console.error('❌ Error inicializando SQLite:', error.message);
            throw error;
        }
    }

    /**
     * Normaliza un texto para búsqueda consistente.
     */
    normalize(text) {
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[.,?¿!¡]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Detecta si una respuesta es negativa/vacía de información.
     * @param {string} answer
     * @returns {boolean}
     */
    isNegativeResponse(answer) {
        if (!answer) return true;
        const lower = answer.toLowerCase();
        return NEGATIVE_MARKERS.some(marker => lower.includes(marker));
    }

    /**
     * Verifica si una pregunta normalizada ya existe en la BD.
     * @param {string} questionNormalized
     * @returns {Promise<boolean>}
     */
    async exists(questionNormalized) {
        if (!this.db) return false;
        const row = await this.db.get(
            `SELECT id FROM knowledge_base WHERE question_normalized = ? LIMIT 1`,
            [questionNormalized]
        );
        return !!row;
    }

    /**
     * Determina si un registro requiere revalidación contra NotebookLM.
     *
     * Criterios:
     * 1. knowledge_version del registro < versión actual del sistema
     * 2. usage_count < 3 (poco validado por el uso)
     * 3. Respuesta corta (< 150 chars) — sospechosamente incompleta
     * 4. Respuesta negativa previa — puede haber nueva información
     *
     * @param {Object} row         Fila de knowledge_base
     * @param {number} currentVersion  Versión actual del knowledge base
     * @returns {boolean}
     */
    needsRevalidation(row, currentVersion) {
        if (!row) return false;

        // Criterio 1: versión desactualizada (nueva fuente cargada)
        if ((row.knowledge_version || 0) < currentVersion) {
            return true;
        }
        // Criterio 2: poco uso = confiabilidad baja
        if (row.usage_count < 3) {
            return true;
        }
        // Criterio 3: respuesta sospechosamente corta
        if (row.answer && row.answer.length < 150) {
            return true;
        }
        // Criterio 4: respuesta negativa previa
        if (this.isNegativeResponse(row.answer)) {
            return true;
        }

        return false;
    }

    /**
     * Determina si dos respuestas difieren significativamente.
     * Usa combinación de longitud, contenido y Dice Coefficient.
     *
     * @param {string} oldAnswer
     * @param {string} newAnswer
     * @returns {boolean} true = cambio significativo, actualizar
     */
    hasSignificantChange(oldAnswer, newAnswer) {
        if (!oldAnswer || !newAnswer) return true;

        // La respuesta anterior era negativa y la nueva no → actualizar siempre
        if (this.isNegativeResponse(oldAnswer) && !this.isNegativeResponse(newAnswer)) {
            return true;
        }
        // La nueva es notablemente más completa (> 50 chars adicionales)
        if (newAnswer.length > oldAnswer.length + 50) {
            return true;
        }
        // Contenido significativamente diferente (Dice Coefficient < 0.6)
        const similarity = diceCoefficient(
            this.normalize(oldAnswer),
            this.normalize(newAnswer)
        );
        if (similarity < 0.6) {
            return true;
        }

        return false;
    }

    /**
     * Actualiza un registro con la nueva respuesta revalidada.
     * Siempre actualiza knowledge_version y last_validated.
     *
     * @param {number} id
     * @param {string} newAnswer     Nueva respuesta de NotebookLM (puede ser null si no cambió)
     * @param {number} currentVersion
     * @returns {Promise<'updated'|'touched'>}
     */
    async markRevalidated(id, newAnswer, currentVersion) {
        if (!this.db) return 'touched';

        if (newAnswer) {
            // Actualizar respuesta + versión
            await this.db.run(
                `UPDATE knowledge_base
                 SET answer            = ?,
                     knowledge_version = ?,
                     last_validated    = CURRENT_TIMESTAMP,
                     last_used         = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [newAnswer, currentVersion, id]
            );
            return 'updated';
        } else {
            // Solo actualizar metadata de validación (respuesta no cambió)
            await this.db.run(
                `UPDATE knowledge_base
                 SET knowledge_version = ?,
                     last_validated    = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [currentVersion, id]
            );
            return 'touched';
        }
    }

    /**
     * Retorna registros con knowledge_version desactualizada para batch revalidation.
     * @param {number} currentVersion
     * @param {number} limit
     * @returns {Promise<Array>}
     */
    async getStaleRecords(currentVersion, limit = 20) {
        if (!this.db) return [];
        return this.db.all(
            `SELECT id, question_original, answer, knowledge_version, usage_count
             FROM knowledge_base
             WHERE knowledge_version < ?
             ORDER BY usage_count DESC, last_used DESC
             LIMIT ?`,
            [currentVersion, limit]
        );
    }

    /**
     * Busca una respuesta similar en la base de datos.
     * Prioridad: coincidencia exacta → similitud fuzzy.
     */
    async findSimilar(question) {
        if (!this.db) return null;

        const normalizedInput = this.normalize(question);

        // 1. Coincidencia exacta por índice (muy rápido)
        const exactMatch = await this.db.get(
            `SELECT * FROM knowledge_base WHERE question_normalized = ? LIMIT 1`,
            [normalizedInput]
        );

        if (exactMatch) {
            await this.incrementUsage(exactMatch.id);
            console.log(`✅ [SQLite] Coincidencia exacta para: "${question}"`);
            return exactMatch;
        }

        // 2. Búsqueda por similitud Dice Coefficient (fuzzy)
        const candidates = await this.db.all(
            `SELECT id, question_normalized, answer, usage_count, knowledge_version
             FROM knowledge_base WHERE category = 'general'`
        );

        let bestMatch = null;
        let maxScore = 0;

        for (const cand of candidates) {
            const score = diceCoefficient(normalizedInput, cand.question_normalized);
            if (score > maxScore) {
                maxScore = score;
                bestMatch = cand;
            }
        }

        if (maxScore >= SIMILARITY_THRESHOLD) {
            // Traer fila completa para tener todos los campos
            const fullRow = await this.db.get(
                `SELECT * FROM knowledge_base WHERE id = ?`, [bestMatch.id]
            );
            await this.incrementUsage(bestMatch.id);
            console.log(`✅ [SQLite] Similitud ${(maxScore * 100).toFixed(1)}% para: "${question}"`);
            return fullRow;
        }

        return null;
    }

    /**
     * UPSERT real — INSERT si no existe, UPDATE si ya existe.
     *
     * @param {string} questionOriginal
     * @param {string} answer
     * @param {string} category
     * @param {string} source
     * @param {number} knowledgeVersion
     * @returns {Promise<'inserted'|'updated'|'skipped'>}
     */
    async storeOrUpdate(questionOriginal, answer, category = 'general', source = 'notebooklm', knowledgeVersion = 0) {
        if (!this.db) {
            console.warn('⚠️ [SQLite] DB no inicializada, no se puede guardar.');
            return 'skipped';
        }

        if (!questionOriginal || !answer || answer.length < 10) {
            console.warn('⚠️ [SQLite] Datos insuficientes, omitiendo guardado.');
            return 'skipped';
        }

        const normalized = this.normalize(questionOriginal);

        try {
            const insertResult = await this.db.run(
                `INSERT OR IGNORE INTO knowledge_base
                    (question_original, question_normalized, answer, category, source, knowledge_version, last_validated)
                 VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [questionOriginal, normalized, answer, category, source, knowledgeVersion]
            );

            if (insertResult.changes > 0) {
                console.log(`💾 [SQLite] ✅ NUEVA entrada guardada: "${questionOriginal.substring(0, 60)}"`);
                await this._runCleanupIfNeeded();
                return 'inserted';
            }

            // Ya existía → actualizar uso y versión
            await this.db.run(
                `UPDATE knowledge_base
                 SET usage_count = usage_count + 1,
                     last_used   = CURRENT_TIMESTAMP
                 WHERE question_normalized = ?`,
                [normalized]
            );
            console.log(`🔄 [SQLite] Entrada existente actualizada (uso++): "${questionOriginal.substring(0, 60)}"`);
            return 'updated';

        } catch (error) {
            console.error('⚠️ [SQLite] Error en storeOrUpdate:', error.message);
            return 'skipped';
        }
    }

    /** @deprecated Usar storeOrUpdate() */
    async store(questionOriginal, answer, category = 'general') {
        return this.storeOrUpdate(questionOriginal, answer, category, 'notebooklm', 0);
    }

    async incrementUsage(id) {
        if (!this.db) return;
        await this.db.run(
            `UPDATE knowledge_base
             SET usage_count = usage_count + 1,
                 last_used   = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [id]
        );
    }

    async getStats() {
        if (!this.db) return { total: 0, byCategory: [], topQuestions: [] };

        const [total, byCategory, topQuestions] = await Promise.all([
            this.db.get(`SELECT COUNT(*) as total FROM knowledge_base`),
            this.db.all(`SELECT category, COUNT(*) as count FROM knowledge_base GROUP BY category`),
            this.db.all(
                `SELECT question_original, usage_count, last_used, knowledge_version
                 FROM knowledge_base ORDER BY usage_count DESC LIMIT 10`
            )
        ]);

        return {
            total: total.total,
            maxCapacity: MAX_RECORDS,
            utilizationPct: ((total.total / MAX_RECORDS) * 100).toFixed(1),
            byCategory,
            topQuestions
        };
    }

    async _runCleanupIfNeeded() {
        const count = await this.db.get(`SELECT COUNT(*) as total FROM knowledge_base`);
        if (count.total > MAX_RECORDS) {
            await this.db.run(`
                DELETE FROM knowledge_base WHERE id IN (
                    SELECT id FROM knowledge_base
                    ORDER BY usage_count ASC, last_used ASC
                    LIMIT ?
                )`,
                [Math.floor(MAX_RECORDS * 0.1)]
            );
            console.log('🧹 [SQLite] Auto-limpieza ejecutada');
        }
    }

    async cleanup() {
        return this._runCleanupIfNeeded();
    }
}

export default new DatabaseService();
