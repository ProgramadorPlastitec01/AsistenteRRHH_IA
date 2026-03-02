/**
 * DatabaseService
 * 
 * Gestiona la base de datos SQLite local para el almacenamiento de FAQs.
 * Implementa búsqueda por similitud y auto-limpieza.
 */

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { diceCoefficient } from 'dice-coefficient';

const DB_PATH = path.join(process.cwd(), 'hr_cache.db');
const MAX_RECORDS = 10000;
const SIMILARITY_THRESHOLD = 0.85;

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

            await this.db.exec(`
                CREATE TABLE IF NOT EXISTS knowledge_base (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    question_original TEXT NOT NULL,
                    question_normalized TEXT NOT NULL,
                    answer TEXT NOT NULL,
                    category TEXT DEFAULT 'general',
                    usage_count INTEGER DEFAULT 1,
                    last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await this.db.exec(`CREATE INDEX IF NOT EXISTS idx_question_normalized ON knowledge_base(question_normalized)`);
            await this.db.exec(`CREATE INDEX IF NOT EXISTS idx_category ON knowledge_base(category)`);

            console.log('✅ SQLite Cache Database Initialized');
        } catch (error) {
            console.error('❌ Error initializing SQLite:', error.message);
            throw error;
        }
    }

    /**
     * Normaliza un texto para mejorar la búsqueda.
     */
    normalize(text) {
        return text.toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();
    }

    /**
     * Busca una respuesta similar en la base de datos.
     */
    async findSimilar(question) {
        if (!this.db) return null;

        const normalizedInput = this.normalize(question);

        // Primero intento coincidencia exacta de normalizado (Rápido)
        const exactMatch = await this.db.get(
            `SELECT * FROM knowledge_base WHERE question_normalized = ? LIMIT 1`,
            [normalizedInput]
        );

        if (exactMatch) {
            await this.incrementUsage(exactMatch.id);
            return exactMatch;
        }

        // Si no hay exacta, busco similitud (Carga todos los normalizados de 'general')
        // En una base de datos más grande usaríamos FTS o vectores, pero para 10k registros basta.
        const candidates = await this.db.all(`SELECT id, question_normalized, answer FROM knowledge_base WHERE category = 'general'`);

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
            await this.incrementUsage(bestMatch.id);
            return bestMatch;
        }

        return null;
    }

    async store(questionOriginal, answer, category = 'general') {
        if (!this.db) return;

        try {
            const normalized = this.normalize(questionOriginal);

            await this.db.run(
                `INSERT INTO knowledge_base (question_original, question_normalized, answer, category) VALUES (?, ?, ?, ?)`,
                [questionOriginal, normalized, answer, category]
            );

            // Auto-limpieza si excede límite
            const count = await this.db.get(`SELECT COUNT(*) as total FROM knowledge_base`);
            if (count.total > MAX_RECORDS) {
                await this.cleanup();
            }
        } catch (error) {
            console.error('⚠️ Error storing in SQLite:', error.message);
        }
    }

    async incrementUsage(id) {
        await this.db.run(
            `UPDATE knowledge_base SET usage_count = usage_count + 1, last_used = CURRENT_TIMESTAMP WHERE id = ?`,
            [id]
        );
    }

    async cleanup() {
        // Elimina el 10% más antiguo o menos usado
        await this.db.run(`
            DELETE FROM knowledge_base WHERE id IN (
                SELECT id FROM knowledge_base 
                ORDER BY usage_count ASC, last_used ASC 
                LIMIT ?
            )`,
            [Math.floor(MAX_RECORDS * 0.1)]
        );
        console.log('🧹 Database cleanup performed');
    }
}

export default new DatabaseService();
