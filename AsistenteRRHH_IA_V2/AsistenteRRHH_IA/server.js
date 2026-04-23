/**
 * Backend API Server for NotebookLM MCP Integration
 * 
 * This server acts as a bridge between the frontend React app
 * and the NotebookLM MCP server.
 * 
 * Installation:
 * npm install express cors @modelcontextprotocol/sdk
 * 
 * Run:
 * node server.js
 */

import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import os from 'os';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { createRequire } from 'module';

// SQLite — importado con require() para compatibilidad ESM
const require = createRequire(import.meta.url);
let sqlite3Pkg, sqliteOpen;
try {
    sqlite3Pkg = require('sqlite3').verbose();
    sqliteOpen = require('sqlite').open;
} catch (e) {
    console.warn('⚠️ sqlite/sqlite3 no disponible. SQLite FAQ desactivado.');
}

// Multer is not longer needed as Whisper was removed
// const upload = multer({ ... });

const app = express();
const PORT = 3000;
const LOG_FILE = path.join(process.cwd(), 'analytics.jsonl');
const ERRORS_FILE = path.join(process.cwd(), 'errors.jsonl');
const DB_PATH = path.join(process.cwd(), 'hr_cache.db');

// ── PIN Admin (almacenado sólo en backend, nunca expuesto) ──
// Hash simple: btoa de la cadena invertida + salt fijo
const ADMIN_PIN_HASH = btoa('7122_plastitec'); // PIN 2217 invertido + salt
const verifyPin = (input) => btoa(`${[...String(input)].reverse().join('')}_plastitec`) === ADMIN_PIN_HASH;

// ── DatabaseService — FAQ Progresivo ──
const DatabaseService = {
    db: null,

    async init() {
        if (!sqliteOpen || !sqlite3Pkg) { console.warn('SQLite no disponible.'); return; }
        try {
            this.db = await sqliteOpen({ filename: DB_PATH, driver: sqlite3Pkg.Database });
            await this.db.exec(`PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;`);

            await this.db.exec(`
                CREATE TABLE IF NOT EXISTS knowledge_base (
                    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
                    question_original    TEXT    NOT NULL,
                    question_normalized  TEXT    NOT NULL UNIQUE,
                    answer               TEXT    NOT NULL,
                    category             TEXT    DEFAULT 'general',
                    source               TEXT    DEFAULT 'notebooklm',
                    usage_count          INTEGER DEFAULT 1,
                    faq_validated        INTEGER DEFAULT 0,
                    priority_level       TEXT    DEFAULT 'normal',
                    first_asked_date     DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_asked_date      DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_validated       DATETIME DEFAULT NULL,
                    knowledge_version    INTEGER DEFAULT 0,
                    created_at           DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Migración segura para BD existente
            const cols = (await this.db.all(`PRAGMA table_info(knowledge_base)`)).map(c => c.name);
            const migrations = [
                ['faq_validated', `ALTER TABLE knowledge_base ADD COLUMN faq_validated INTEGER DEFAULT 0`],
                ['priority_level', `ALTER TABLE knowledge_base ADD COLUMN priority_level TEXT DEFAULT 'normal'`],
                ['first_asked_date', `ALTER TABLE knowledge_base ADD COLUMN first_asked_date DATETIME DEFAULT NULL`],
                ['last_asked_date', `ALTER TABLE knowledge_base ADD COLUMN last_asked_date DATETIME DEFAULT NULL`],
                ['knowledge_version', `ALTER TABLE knowledge_base ADD COLUMN knowledge_version INTEGER DEFAULT 0`],
                ['last_validated', `ALTER TABLE knowledge_base ADD COLUMN last_validated DATETIME DEFAULT NULL`],
                ['source', `ALTER TABLE knowledge_base ADD COLUMN source TEXT DEFAULT 'notebooklm'`],
            ];
            for (const [col, sql] of migrations) {
                if (!cols.includes(col)) {
                    await this.db.exec(sql);
                    console.log(`🔧 [DB] Columna '${col}' agregada`);
                }
            }

            await this.db.exec(`CREATE INDEX IF NOT EXISTS idx_faq ON knowledge_base(faq_validated, usage_count)`);
            await this.db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_qnorm ON knowledge_base(question_normalized)`);

            console.log(`✅ SQLite FAQ Database inicializada: ${DB_PATH}`);
        } catch (e) {
            console.error('❌ Error SQLite init:', e.message);
        }
    },

    normalize(text) {
        return text.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[.,?¿!¡]/g, '').replace(/\s+/g, ' ').trim();
    },

    isNegative(answer) {
        const markers = ['no se encontró', 'no existe información', 'no tengo información',
            'no se menciona', 'no hay información', 'no está documentado', 'no figura',
            'no contempla', 'el rit no menciona'];
        const lower = (answer || '').toLowerCase();
        return markers.some(m => lower.includes(m));
    },

    async findSimilar(question) {
        if (!this.db) return null;
        const norm = this.normalize(question);
        const row = await this.db.get(
            `SELECT * FROM knowledge_base WHERE question_normalized = ? LIMIT 1`, [norm]
        );
        if (row) {
            this.incrementUsage(row.id).catch(() => { });
            return row;
        }
        return null;
    },

    async storeOrUpdate(questionOriginal, answer, category = 'general', source = 'notebooklm', forceUpdate = false) {
        if (!this.db || !questionOriginal || !answer || answer.length < 10) return 'skipped';
        const norm = this.normalize(questionOriginal);
        try {
            const existing = await this.db.get(`SELECT id, answer, knowledge_version FROM knowledge_base WHERE question_normalized = ?`, [norm]);

            if (!existing) {
                await this.db.run(
                    `INSERT INTO knowledge_base 
                     (question_original, question_normalized, answer, category, source, first_asked_date, last_asked_date, last_validated, knowledge_version)
                     VALUES (?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP, 1)`,
                    [questionOriginal, norm, answer, category, source]
                );
                return 'inserted';
            }

            if (forceUpdate) {
                const newVersion = (existing.knowledge_version || 0) + 1;
                await this.db.run(
                    `UPDATE knowledge_base SET 
                     answer = ?, 
                     last_asked_date = CURRENT_TIMESTAMP, 
                     last_validated = CURRENT_TIMESTAMP,
                     knowledge_version = ?
                     WHERE id = ?`,
                    [answer, newVersion, existing.id]
                );
                return 'updated_version';
            }

            // Solo actualizar timestamp de validación si no hay cambios
            await this.db.run(
                `UPDATE knowledge_base SET 
                 usage_count = usage_count + 1, 
                 last_asked_date = CURRENT_TIMESTAMP,
                 last_validated = CURRENT_TIMESTAMP 
                 WHERE id = ?`, [existing.id]
            );
            this.checkAndPromoteFAQ(existing.id).catch(() => { });
            return 'validated';
        } catch (e) {
            console.error('[SQLite] storeOrUpdate error:', e.message);
            return 'skipped';
        }
    },

    async incrementUsage(id) {
        if (!this.db) return;
        await this.db.run(
            `UPDATE knowledge_base SET usage_count=usage_count+1, last_asked_date=CURRENT_TIMESTAMP WHERE id=?`, [id]
        );
        this.checkAndPromoteFAQ(id).catch(() => { });
    },

    async checkAndPromoteFAQ(id) {
        if (!this.db) return;
        const row = await this.db.get(
            `SELECT id,usage_count,first_asked_date,faq_validated FROM knowledge_base WHERE id=?`, [id]
        );
        if (!row || row.faq_validated) return;
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const inWindow = !row.first_asked_date || row.first_asked_date >= sevenDaysAgo;
        if (row.usage_count >= 10 && inWindow) {
            await this.db.run(
                `UPDATE knowledge_base SET faq_validated=1, priority_level='alta' WHERE id=?`, [id]
            );
            console.log(`⭐ [FAQ] id:${id} promovida a FAQ validada (uso=${row.usage_count})`);
        }
    },

    async getFAQValidated(limit = 5) {
        if (!this.db) return [];
        return this.db.all(
            `SELECT id,question_original,usage_count,priority_level,last_asked_date
             FROM knowledge_base WHERE faq_validated=1
             ORDER BY usage_count DESC, last_asked_date DESC LIMIT ?`, [limit]
        );
    },

    async getLearningStats() {
        if (!this.db) return { total: 0, faqValidated: 0, lowFrequency: 0, pendingRevalidation: 0 };
        const [tot, faq, low, stale] = await Promise.all([
            this.db.get(`SELECT COUNT(*) as n FROM knowledge_base`),
            this.db.get(`SELECT COUNT(*) as n FROM knowledge_base WHERE faq_validated=1`),
            this.db.get(`SELECT COUNT(*) as n FROM knowledge_base WHERE usage_count < 3`),
            this.db.get(`SELECT COUNT(*) as n FROM knowledge_base WHERE knowledge_version < 1 OR knowledge_version IS NULL`)
        ]);
        return { total: tot?.n || 0, faqValidated: faq?.n || 0, lowFrequency: low?.n || 0, pendingRevalidation: stale?.n || 0 };
    },

    async getLearningRecords(limit = 50) {
        if (!this.db) return [];
        return this.db.all(
            `SELECT id,question_original,usage_count,faq_validated,priority_level,
                    knowledge_version,last_validated,last_asked_date
             FROM knowledge_base ORDER BY usage_count DESC, faq_validated DESC LIMIT ?`, [limit]
        );
    },

    async forceRevalidate(id) {
        if (!this.db) return false;
        await this.db.run(
            `UPDATE knowledge_base SET knowledge_version=0, last_validated=NULL WHERE id=?`, [id]
        );
        return true;
    }
};


/**
 * Helper to log analytics events to JSONL file
 */
const logAnalyticsEvent = (type, data) => {
    const event = {
        timestamp: new Date().toISOString(),
        type,
        ...data
    };
    // Append line to file asynchronously
    fs.appendFile(LOG_FILE, JSON.stringify(event) + '\n', (err) => {
        if (err) console.error('Error writing to analytics log:', err);
    });
};

/**
 * Helper to log system errors to JSONL file
 */
const logErrorEvent = (type, module, message, stack = null, details = {}) => {
    const errorEvent = {
        timestamp: new Date().toISOString(),
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        type, // 'Backend' | 'Frontend' | 'Auth' | 'IA' | 'Mic' | 'Network'
        module,
        message,
        stack: stack ? stack.split('\n').slice(0, 5).join('\n') : null, // Store only top of stack
        status: 'pending',
        details
    };
    fs.appendFile(ERRORS_FILE, JSON.stringify(errorEvent) + '\n', (err) => {
        if (err) console.error('Error writing to errors log:', err);
    });
};

// Absolute paths for robustness
const APP_ROOT = process.cwd();
const AUTH_FILE_PATH = path.join(APP_ROOT, 'auth.json');

// Middleware — CORS: allow configured origins or all in dev
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : null;
app.use(cors(allowedOrigins ? {
    origin: (origin, callback) => {
        // Allow same-origin requests (no origin) and explicitly listed origins
        if (!origin || allowedOrigins.some(o => origin.startsWith(o.trim()))) {
            callback(null, true);
        } else {
            callback(new Error(`CORS blocked: ${origin}`));
        }
    }
} : {}));
app.use(express.json());

// Serve static frontend files
app.use('/AsistenteRRHH', express.static(path.join(APP_ROOT, 'dist')));

// Configure long-running session parameters
const SESSION_REFRESH_INTERVAL = 25 * 60 * 1000; // Refresh every 25 minutes (before typical 1h expiry)
let authRefreshInterval = null;
let authWatcherActive = false; // Prevents duplicate fs.watch listeners across initializeMCP() calls

// MCP Client state
let mcpClient = null;
let notebookId = null;
let isInitialized = false;

/**
 * Initialize MCP connection and find RRHH notebook
 */
async function initializeMCP() {
    try {
        console.log('Initializing MCP connection...');

        // Create transport to communicate with MCP server
        const transport = new StdioClientTransport({
            command: process.execPath,
            args: [path.join(APP_ROOT, 'node_modules', 'notebooklm-mcp-server', 'dist', 'index.js'), 'mcp'],
            env: {
                ...process.env,
                // Force MCP server to use our local auth.json file
                NOTEBOOKLM_AUTH_FILE: AUTH_FILE_PATH,
                // Suppress ANSI colors and unnecessary logs
                NO_COLOR: 'true',
                LOG_LEVEL: 'error'
            }
        });

        // Create MCP client with increased timeout for complex queries
        mcpClient = new Client({
            name: 'hr-kiosk-backend',
            version: '1.0.0'
        }, {
            capabilities: {},
            requestTimeout: 60000 // 60s — NotebookLM rarely exceeds this; avoids zombie requests
        });

        // Connect to MCP server
        await mcpClient.connect(transport);
        console.log('Connected to MCP server');

        // Check if notebook ID is already in .env
        if (process.env.NOTEBOOK_ID) {
            notebookId = process.env.NOTEBOOK_ID;
            console.log(`Using Notebook ID from .env: ${notebookId}`);
            isInitialized = true;
            return;
        }

        // List all notebooks if not specified in .env
        const listResult = await mcpClient.callTool({
            name: 'notebook_list',
            arguments: {}
        });

        const listText = listResult.content[0].text;
        console.log('Notebook list output:', listText);

        // Regex para buscar el ID del cuaderno RRHH o similar
        // Formato esperado: "- **RRHH** ... ID: 8895bf27-..."
        const rrhhMatch = listText.match(/-\s+\*\*(.*?(?:RRHH|Recursos Humanos).*?)\*\*\s+.*?\s+ID:\s+([a-f0-9-]+)/i);

        if (!rrhhMatch) {
            console.warn('RRHH notebook not found in list. Looking for any first notebook as fallback...');
            const anyMatch = listText.match(/ID:\s+([a-f0-9-]+)/i);
            if (anyMatch) {
                notebookId = anyMatch[1];
                console.log(`Using fallback notebook ID: ${notebookId}`);
            } else {
                throw new Error('No se encontró ningún cuaderno. Por favor crea uno en NotebookLM.');
            }
        } else {
            notebookId = rrhhMatch[2];
            console.log(`Found RRHH notebook ID: ${notebookId}`);
        }

        // Configure chat settings for shorter, more specific responses
        try {
            await mcpClient.callTool({
                name: 'chat_configure',
                arguments: {
                    notebook_id: notebookId,
                    response_length: 'shorter',
                    goal: 'default'
                }
            });
            console.log('Chat configured for shorter responses');
        } catch (configError) {
            console.warn('Could not configure chat settings, continuing with defaults:', configError.message);
        }

        isInitialized = true;
        console.log('✅ MCP Initialized completely. Session is active.');

    } catch (error) {
        // Attempt immediate basic recovery if auth failed during startup
        if (error.message && (error.message.includes('auth') || error.message.includes('login'))) {
            console.log('⚠️ Startup Auth check failed. Trying to refresh cookies once...');
            try {
                if (mcpClient) await mcpClient.callTool({ name: 'refresh_auth', arguments: {} });
            } catch (e) { }
        }
        console.error('Failed to initialize MCP:', error);
        console.log('⚠️ Reentering DEMO MODE. The server will stay online but will provide simulated responses until authentication is fixed.');
        console.log('💡 To fix this, run: npx notebooklm-mcp-server auth');
        isInitialized = true; // Mark as initialized
        notebookId = 'DEMO_MODE';
    }

    // Start periodic background auth refresh with safety timeout
    if (authRefreshInterval) clearInterval(authRefreshInterval);
    authRefreshInterval = setInterval(async () => {
        try {
            console.log('🔄 Performing background session refresh...');
            if (mcpClient) {
                // Use a promise race to prevent the interval from hanging the event loop
                const refreshPromise = mcpClient.callTool({ name: 'refresh_auth', arguments: {} });
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Refresh auth timeout (30s)')), 30000)
                );

                await Promise.race([refreshPromise, timeoutPromise]);
                console.log('✅ Session refreshed successfully in background');
            }
        } catch (e) {
            console.warn('⚠️ Passive session refresh failed or timed out:', e.message);
        }
    }, SESSION_REFRESH_INTERVAL);

    // Watch for manual auth.json changes to auto-reload
    // Guard flag prevents registering multiple watchers on successive calls to initializeMCP()
    if (fs.existsSync(AUTH_FILE_PATH) && !authWatcherActive) {
        authWatcherActive = true;
        fs.watch(AUTH_FILE_PATH, async (eventType) => {
            if (eventType === 'change') {
                console.log('🔄 auth.json change detected. Re-initializing MCP...');
                if (mcpClient) {
                    try { await mcpClient.close(); } catch (e) { }
                    isInitialized = false;
                    await initializeMCP();
                }
            }
        });
    }
}

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: isInitialized ? 'ready' : 'initializing',
        notebookId: notebookId,
        timestamp: new Date().toISOString()
    });
});

/**
 * Analytics Endpoint
 * Receives logs from frontend interactions (local cache hits, intents, etc.)
 */
app.post('/api/analytics', (req, res) => {
    const { type, data } = req.body;
    if (!type) return res.status(400).json({ error: 'Missing log type' });

    logAnalyticsEvent(type, data || {});
    res.json({ success: true });
});

/**
 * Get analytics data (last 100 events)
 */
app.get('/api/analytics', async (req, res) => {
    try {
        if (!fs.existsSync(LOG_FILE)) {
            return res.json({ events: [] });
        }

        // Leer archivo completo (para MVP está bien, en prod usar tail)
        const data = await fs.promises.readFile(LOG_FILE, 'utf8');
        const lines = data.trim().split('\n');

        // Parsear últimas 100 líneas
        const events = lines
            .slice(-100) // Últimos 100 eventos
            .filter(line => line.trim())
            .map(line => {
                try { return JSON.parse(line); } catch (e) { return null; }
            })
            .filter(e => e !== null)
            .reverse(); // Más reciente primero

        res.json({ events });
    } catch (error) {
        console.error('Error reading analytics:', error);
        res.status(500).json({ error: 'Failed to read logs' });
    }
});

/**
 * Get system errors (last 100)
 */
app.get('/api/system-errors', async (req, res) => {
    try {
        if (!fs.existsSync(ERRORS_FILE)) {
            return res.json({ errors: [] });
        }

        const data = await fs.promises.readFile(ERRORS_FILE, 'utf8');
        const lines = data.trim().split('\n');

        const errors = lines
            .filter(line => line.trim())
            .map(line => {
                try { return JSON.parse(line); } catch (e) { return null; }
            })
            .filter(e => e !== null)
            .reverse() // Most recent first
            .slice(0, 100);

        res.json({ errors });
    } catch (error) {
        console.error('Error reading system errors:', error);
        res.status(500).json({ error: 'Failed to read logs' });
    }
});

/**
 * Resolve system error
 */
app.post('/api/system-errors/resolve', async (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing error ID' });

    try {
        if (!fs.existsSync(ERRORS_FILE)) return res.status(404).json({ error: 'Log not found' });

        const data = await fs.promises.readFile(ERRORS_FILE, 'utf8');
        const lines = data.trim().split('\n');

        const updatedLines = lines.map(line => {
            if (!line.trim()) return line;
            try {
                const err = JSON.parse(line);
                if (err.id === id) {
                    err.status = 'resolved';
                    return JSON.stringify(err);
                }
                return line;
            } catch (e) { return line; }
        });

        await fs.promises.writeFile(ERRORS_FILE, updatedLines.join('\n') + '\n');
        res.json({ success: true });
    } catch (error) {
        console.error('Error resolving error:', error);
        res.status(500).json({ error: 'Failed to update log' });
    }
});

/**
 * External Error Logging (from Frontend)
 */
app.post('/api/report-error', (req, res) => {
    const { type, module, message, stack, details } = req.body;
    logErrorEvent(type, module, message, stack, details || {});
    res.json({ success: true });
});

/**
 * System Status Endpoint (Health Monitor)
 */
app.get('/api/system-status', async (req, res) => {
    const status = {
        timestamp: new Date().toISOString(),
        services: [
            { id: 'backend', name: 'API Server', status: 'active', latency: 0, version: '1.2.0' },
            { id: 'database', name: 'Log Storage (JSONL)', status: 'checking', latency: 0 },
            { id: 'notebooklm', name: 'NotebookLM AI', status: 'checking', latency: 0 }
        ]
    };

    // 1. Check Database (File System)
    const dbStart = Date.now();
    try {
        // Verificar si podemos escribir/leer
        await fs.promises.access(LOG_FILE, fs.constants.R_OK | fs.constants.W_OK);
        status.services[1].status = 'active';
    } catch (e) {
        status.services[1].status = 'error';
        status.services[1].message = 'No write permission';
    }
    status.services[1].latency = Date.now() - dbStart;

    // 2. Check NotebookLM Connection
    const nlmStart = Date.now();
    if (!isInitialized) {
        status.services[2].status = 'inactive';
        status.services[2].message = 'Not Initialized';
    } else if (notebookId === 'DEMO_MODE') {
        status.services[2].status = 'degraded';
        status.services[2].message = 'Demo Mode (Simulated)';
    } else {
        // B4 FIX: Do NOT make a live MCP round-trip here — it competes with real queries.
        // Report status based on in-memory state (MCP client connected + notebook loaded).
        status.services[2].status = mcpClient ? 'active' : 'error';
        status.services[2].latency = 0; // No round-trip made
        status.services[2].message = mcpClient ? undefined : 'MCP client not connected';
    }

    res.json(status);
});

/**
 * Query endpoint - Main interface for frontend
 */
app.post('/api/query', async (req, res) => {
    const { query, conversationId } = req.body;
    try {
        const start = Date.now();

        if (!query || typeof query !== 'string') {
            return res.status(400).json({ error: 'Query is required and must be a string' });
        }

        if (!isInitialized) {
            return res.status(503).json({ error: 'El servicio aún se está inicializando.' });
        }

        // Configuración de Prompt y Errores
        const enhancedQuery = `--------------------------------------------------
INSTRUCCIONES CRÍTICAS PARA LA IA
--------------------------------------------------
1. Responde únicamente a lo que se pregunta.
2. Usa solo información encontrada en NotebookLM.
3. No agregues explicaciones adicionales.
4. No describas los documentos consultados.
5. No expliques el proceso de búsqueda.
6. No agregues interpretaciones propias.
7. No amplíes la respuesta con contexto innecesario.
8. Si la información no existe en NotebookLM, responde exactamente:
   "No se encontró información relacionada en los documentos disponibles."
 
FORMATO DE RESPUESTA OBLIGATORIO:
- Un único bloque de respuesta.
- Máximo 1–2 párrafos.
- Lenguaje claro y profesional.
--------------------------------------------------
CONSULTA: ${query}`;

        const AUTH_ERROR_RE = /\b(Authentication expired|re-authenticate|session expired|login required|401)\b/i;

        // ── MOTOR HÍBRIDO: Lógica de Aprendizaje Progresivo ──

        // 1. Buscar en SQLite (Caché inteligente / Fallback)
        let localRecord = null;
        try {
            localRecord = await DatabaseService.findSimilar(query);
            if (localRecord) {
                console.log(`🔍 [SQLite] Registro encontrado (id:${localRecord.id}, faq:${!!localRecord.faq_validated})`);
            }
        } catch (e) {
            console.warn('⚠️ Error consultando local KB:', e.message);
        }

        // 2. Definir función de consulta a NotebookLM
        const performQuery = async (retryCount = 0) => {
            const mcpStart = Date.now();
            const result = await mcpClient.callTool({
                name: 'notebook_query',
                arguments: {
                    notebook_id: notebookId,
                    query: enhancedQuery,
                    conversation_id: conversationId || undefined
                }
            });

            const rawText = result.content[0].text;
            if (AUTH_ERROR_RE.test(rawText) && retryCount === 0) {
                await mcpClient.callTool({ name: 'refresh_auth', arguments: {} });
                return await performQuery(1);
            }

            return {
                text: rawText.replace(/\[\d+\]/g, '').trim(),
                conversationId: result.conversationId
            };
        };

        // 3. Ejecutar consulta remota con Fallback Resiliente
        let remoteText = null;
        let finalConversationId = conversationId;

        try {
            const remoteResult = await performQuery();
            remoteText = remoteResult.text;
            finalConversationId = remoteResult.conversationId;
        } catch (error) {
            console.error('❌ [NotebookLM] Error:', error.message);

            // CASO C: Si NotebookLM falla, usar respuesta SQLite si existe
            if (localRecord && localRecord.answer) {
                console.log('🛡️ [Fallback] Usando respuesta de SQLite debido a fallo en NotebookLM');
                return res.json({
                    response: localRecord.answer,
                    outOfScope: false,
                    conversationId: conversationId,
                    source: 'sqlite_fallback'
                });
            }
            throw error; // Re-lanzar si no hay fallback
        }

        // 4. Lógica de Comparación y Aprendizaje (Asíncrona, no bloquea UI)
        const processLearning = async () => {
            if (!remoteText || remoteText.includes("No se encontró información")) return;

            const isNotFound = remoteText.includes("No se encontró información relacionada");
            if (isNotFound) return;

            if (!localRecord) {
                // CASO A: Nuevo conocimiento
                await DatabaseService.storeOrUpdate(query, remoteText);
                console.log('🆕 [Learning] Nueva respuesta almacenada en SQLite');
            } else {
                // CASO B: Registro existente -> Comparar
                const normRemote = DatabaseService.normalize(remoteText);
                const normLocal = DatabaseService.normalize(localRecord.answer);

                // Si son significativamente diferentes, actualizar versión
                if (normRemote !== normLocal) {
                    console.log('🔄 [Learning] Respuesta actualizada (Cambio detectado)');
                    await DatabaseService.storeOrUpdate(query, remoteText, 'general', 'notebooklm', true);
                } else {
                    // Si son similares, solo validar
                    console.log('✅ [Learning] Respuesta local validada contra NotebookLM');
                    await DatabaseService.storeOrUpdate(query, remoteText);
                }
            }
        };

        // Ejecutar aprendizaje en segundo plano
        processLearning().catch(err => console.error('Error en proceso de aprendizaje:', err));

        // 5. Devolver respuesta fresca de NotebookLM
        logAnalyticsEvent('HybridQuery', {
            query,
            hadLocal: !!localRecord,
            latencyMs: Date.now() - start,
            notebookId
        });

        res.json({
            response: remoteText,
            outOfScope: false,
            conversationId: finalConversationId,
            source: 'hybrid_remote'
        });

    } catch (error) {
        console.error('Query error details:', error);

        // Log detailed error to analytics for debugging
        logAnalyticsEvent('QueryError', {
            message: error.message,
            stack: error.stack,
            type: error.constructor.name
        });

        // Log to centralized error system
        logErrorEvent('IA', 'QueryEngine', error.message, error.stack, { query });

        // Check for common errors
        const errorMessage = error.message || 'Unknown error';

        // Detectar errores de autenticación (incluyendo expiración)
        if (errorMessage.includes('401') ||
            errorMessage.includes('unauthorized') ||
            errorMessage.includes('login') ||
            errorMessage.includes('expired') ||
            errorMessage.includes('authenticat') ||
            errorMessage.includes('auth')) {

            return res.status(401).json({
                error: `Error de autenticación: ${errorMessage}. Por favor, ejecuta "npx notebooklm-mcp-server auth" para renovar sesión.`
            });
        }

        // Return valid JSON error even for 500
        res.status(500).json({
            error: `Error al procesar la consulta: ${errorMessage}`
        });
    }
});

/**
 * Reset conversation endpoint
 */
app.post('/api/reset', (req, res) => {
    // Conversation reset is handled by not passing conversationId
    res.json({ success: true });
});


/**
 * Get notebook information
 */
app.get('/api/notebook', async (req, res) => {
    try {
        if (!isInitialized) {
            return res.status(503).json({
                error: 'Service not initialized'
            });
        }

        const listResult = await mcpClient.callTool({
            name: 'notebook_list',
            arguments: {}
        });

        res.json({ list: listResult.content[0].text });

    } catch (error) {
        console.error('Error fetching notebook:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * ── FAQ & Learning Endpoints ────────────────────────────────
 */

/** Top-5 FAQs validadas (para vista principal) */
app.get('/api/faq', async (req, res) => {
    try {
        const faqs = await DatabaseService.getFAQValidated(5);
        res.json({ faqs });
    } catch (e) {
        res.json({ faqs: [] });
    }
});

/** Métricas del sistema de aprendizaje */
app.get('/api/learning-stats', async (req, res) => {
    try {
        const stats = await DatabaseService.getLearningStats();
        res.json(stats);
    } catch (e) {
        res.json({ total: 0, faqValidated: 0, lowFrequency: 0, pendingRevalidation: 0 });
    }
});

/** Todos los registros para el panel admin */
app.get('/api/learning-records', async (req, res) => {
    try {
        const records = await DatabaseService.getLearningRecords(100);
        res.json({ records });
    } catch (e) {
        res.json({ records: [] });
    }
});

/** Forzar revalidación de un registro por ID */
app.post('/api/force-revalidate/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID inválido' });
    try {
        await DatabaseService.forceRevalidate(id);
        res.json({ success: true, message: `Registro id:${id} marcado para revalidación` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/** Verificación PIN del Admin Dashboard (PIN nunca expuesto en frontend) */
app.post('/api/verify-pin', (req, res) => {
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ error: 'PIN requerido' });
    const valid = verifyPin(String(pin).trim());
    if (valid) {
        res.json({ success: true });
    } else {
        // Delay artificial para prevenir brute-force
        setTimeout(() => res.json({ success: false, error: 'PIN incorrecto' }), 800);
    }
});

/** Guardar respuesta en FAQ local (llamado por el query handler) */
app.post('/api/store-faq', async (req, res) => {
    const { question, answer, category } = req.body;
    if (!question || !answer) return res.status(400).json({ error: 'Faltan datos' });
    try {
        const result = await DatabaseService.storeOrUpdate(question, answer, category || 'general');
        res.json({ success: true, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * Error handling middleware
 */
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Error interno del servidor. Por favor contacta con soporte técnico.'
    });
});

/**
 * SPA Fallback for /AsistenteRRHH/ routing (must be after API routes)
 */
app.get(/\/AsistenteRRHH($|\/.*)/, (req, res, next) => {
    // If it's a request to the main app path, serve index.html (SPA)
    if (!req.path.includes('.')) {
        return res.sendFile(path.join(APP_ROOT, 'dist', 'index.html'));
    }
    next();
});

// API 404
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Endpoint no encontrado' });
});

// Global 500 error handler — MUST have 4 args for Express to recognize it as error middleware
// Without this, unhandled async errors produce an empty 500 with no body (the reported bug).
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error('[Express Error]', req.method, req.url, err.message || err);
    if (res.headersSent) return next(err);
    res.status(500).json({
        error: 'Error interno del servidor.',
        detail: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

/**
 * Start server
 */
async function startServer() {
    try {
        // Inicializar SQLite FAQ Database
        await DatabaseService.init();

        // Initialize MCP connection first
        await initializeMCP();

        // Start Express server
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`\n✅ HR Kiosk Backend Server running on port ${PORT}`);

            // Mostrar IP de red local
            const nets = os.networkInterfaces();
            const results = {};
            for (const name of Object.keys(nets)) {
                for (const net of nets[name]) {
                    if (net.family === 'IPv4' && !net.internal) {
                        if (!results[name]) {
                            results[name] = [];
                        }
                        results[name].push(net.address);
                    }
                }
            }
            console.log('🌐 Network Access:');
            Object.keys(results).forEach((name) => {
                results[name].forEach((ip) => {
                    console.log(`  http://${ip}:${PORT}`);
                });
            });

            console.log(`\n📚 Connected to NotebookLM notebook: ${notebookId}`);
            console.log(`\nEndpoints:`);
            console.log(`  GET  /api/health        - Health check`);
            console.log(`  GET  /api/system-status - System Health Monitor`);
            console.log(`  POST /api/query         - Query RRHH knowledge base`);
            console.log(`  POST /api/analytics     - Analytics logging`);
            console.log(`  GET  /api/analytics     - Get last 100 analytics events`);
            console.log(`  POST /api/reset         - Reset conversation`);
            console.log(`  GET  /api/notebook      - Get notebook info\n`);
            console.log(`🚀 SERVIDOR LISTO Y ESCUCHANDO. NO CIERRES ESTA VENTANA.`);
        });

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully...');
    if (mcpClient) {
        await mcpClient.close();
    }
    process.exit(0);
});

// Start the server
startServer();
