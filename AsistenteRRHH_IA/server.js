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

// Multer is not longer needed as Whisper was removed
// const upload = multer({ ... });

const app = express();
const PORT = 3000;
const LOG_FILE = path.join(process.cwd(), 'analytics.jsonl');
const ERRORS_FILE = path.join(process.cwd(), 'errors.jsonl');

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

    // Start periodic background auth refresh
    if (authRefreshInterval) clearInterval(authRefreshInterval);
    authRefreshInterval = setInterval(async () => {
        try {
            console.log('🔄 Performing background session refresh...');
            if (mcpClient) {
                await mcpClient.callTool({ name: 'refresh_auth', arguments: {} });
                console.log('✅ Session refreshed successfully in background');
            }
        } catch (e) {
            console.warn('⚠️ Passive session refresh failed (will retry next cycle):', e.message);
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
            return res.status(400).json({
                error: 'Query is required and must be a string'
            });
        }

        if (!isInitialized) {
            return res.status(503).json({
                error: 'El servicio aún se está inicializando. Por favor intenta de nuevo en unos momentos.'
            });
        }

        console.log(`Processing query: "${query}"`);

        // FALLBACK: If in Demo Mode, return simulated responses
        if (notebookId === 'DEMO_MODE') {
            const lowerQuery = query.toLowerCase();
            let simulatedResponse = 'Lo siento, no encuentro esa información en mi base de conocimientos actual. Por favor, contacta con RRHH.';

            if (lowerQuery.includes('vacaciones')) simulatedResponse = 'Tienes derecho a 22 días de vacaciones. Regístralas en el portal de empleados.';
            if (lowerQuery.includes('pago') || lowerQuery.includes('nómina')) simulatedResponse = 'La nómina se paga el último viernes de cada mes.';
            if (lowerQuery.includes('horario')) simulatedResponse = 'El horario es de 9:00 a 18:00, de lunes a viernes.';

            return res.json({
                response: simulatedResponse, // Clean response for demo
                outOfScope: false
            });
        }

        // B1 FIX/REFINEMENT: Apply strict constraints to force direct, grounded responses.
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
- Sin introducciones como "Según la información proporcionada...", "De acuerdo con los documentos...", etc.
--------------------------------------------------

CONSULTA: ${query}`;

        // Auth error pattern — B2 FIX: precise regex to avoid false positives on words like
        // "autorización" or "autenticación de empleados" that would trigger a useless retry.
        const AUTH_ERROR_RE = /\b(Authentication expired|re-authenticate|session expired|login required|401)\b/i;

        const performQuery = async (retryCount = 0) => {
            const mcpStart = Date.now();
            console.log(`[Query] MCP call started at +${mcpStart - start}ms`);

            const result = await mcpClient.callTool({
                name: 'notebook_query',
                arguments: {
                    notebook_id: notebookId,
                    query: enhancedQuery,
                    conversation_id: conversationId || undefined
                }
            });

            const mcpLatency = Date.now() - mcpStart;
            console.log(`[Query] MCP responded in ${mcpLatency}ms | Total so far: ${Date.now() - start}ms`);

            const rawText = result.content[0].text;

            // B2: only retry on genuine auth errors, not every occurrence of the substring
            if (AUTH_ERROR_RE.test(rawText)) {
                if (retryCount === 0) {
                    console.log('💡 Auth error detected in content. Attempting refresh and retry...');
                    await mcpClient.callTool({ name: 'refresh_auth', arguments: {} });
                    return await performQuery(1);
                }
                throw new Error('Sesión expirada persistentemente. Por favor, ejecuta "npx notebooklm-mcp-server auth".');
            }

            return {
                text: rawText,
                conversationId: result.conversationId
            };
        };

        const { text: rawText, conversationId: finalConversationId } = await performQuery();
        const backendTotal = Date.now() - start;
        console.log(`[Query] ✅ Complete. Backend total: ${backendTotal}ms`);

        let responseText = rawText;
        let finalId = finalConversationId;

        // Intentar parsear si el resultado es un JSON string
        try {
            const parsed = JSON.parse(rawText);
            if (parsed.answer) responseText = parsed.answer;
            if (parsed.conversation_id) finalId = parsed.conversation_id;
        } catch (e) { }

        // Limpieza básica (eliminando referencias estilo [1], [2])
        responseText = responseText
            .replace(/\[\d+\]/g, '')
            .trim();

        // Check if out of scope or not found
        const isNotFound = responseText.includes("No se encontró información relacionada en los documentos disponibles");

        if (isNotFound) {
            return res.json({
                response: responseText,
                outOfScope: true,
                conversationId: finalId
            });
        }

        // Log successful remote query
        logAnalyticsEvent('RemoteQuery', {
            query,
            responseLength: responseText.length,
            latencyMs: Date.now() - start,
            notebookId
        });

        res.json({
            response: responseText,
            outOfScope: false,
            conversationId: finalId
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
