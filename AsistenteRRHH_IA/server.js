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
import http from 'http';
import OpenAI from 'openai';
import os from 'os';
import fs from 'fs';
import path from 'path';
import multer from 'multer';

// Configure Multer for audio uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const app = express();
const PORT = 3000;
const LOG_FILE = path.join(process.cwd(), 'analytics.jsonl');

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

// Middleware
app.use(cors());
app.use(express.json());

// Fallback for SPA routing (Reloads on sub-pages)
// (Moved to bottom of file)

// Enable Mobile/Ngrok mode: Serve static frontend files directly
app.use('/AsistenteRRHH', express.static(path.join(process.cwd(), 'dist')));

// Verificar que la API key esté cargada
console.log('🔑 Verificando API key de OpenAI...');
if (process.env.OPENAI_API_KEY) {
    console.log('✅ OPENAI_API_KEY cargada correctamente (longitud:', process.env.OPENAI_API_KEY.length, 'caracteres)');
} else {
    console.warn('⚠️ OPENAI_API_KEY NO encontrada en .env');
}

// Configure Persistent Keep-Alive Agent for internal requests
const keepAliveAgent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 5000, // 5 seconds initial delay
    maxSockets: 50,       // Allow concurrency
    timeout: 30000        // Socket timeout
});

// Configure long-running session parameters
const SESSION_REFRESH_INTERVAL = 25 * 60 * 1000; // Refresh every 25 minutes (before typical 1h expiry)
let authRefreshInterval = null;

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
            command: 'npx',
            args: ['notebooklm-mcp-server', 'mcp'],
            env: process.env
        });

        // Create MCP client with increased timeout for complex queries
        mcpClient = new Client({
            name: 'hr-kiosk-backend',
            version: '1.0.0'
        }, {
            capabilities: {},
            requestTimeout: 120000 // 120 seconds timeout
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
        try {
            // Ping ligero a NotebookLM (listar cuadernos es lo más barato)
            // Limitamos a 5 segundos para no colgar el chequeo
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000));
            const checkPromise = mcpClient.callTool({ name: 'notebook_list', arguments: {} });

            await Promise.race([checkPromise, timeoutPromise]);

            const latency = Date.now() - nlmStart;
            status.services[2].latency = latency;
            status.services[2].status = latency > 2500 ? 'degraded' : 'active';
        } catch (e) {
            status.services[2].latency = Date.now() - nlmStart;
            status.services[2].status = 'error';
            status.services[2].message = e.message === 'Timeout' ? 'High Latency (>5s)' : 'Connection Failed';
        }
    }

    res.json(status);
});

/**
 * Query endpoint - Main interface for frontend
 */
app.post('/api/query', async (req, res) => {
    try {
        const start = Date.now();
        const { query, conversationId } = req.body;

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

        // Call NotebookLM query tool with prompt for detailed, structured responses
        const enhancedQuery = `Actúa como el Asistente de Recursos Humanos IA de Plastitec. 
IMPORTANTE: Mantén una ortografía y gramática PERFECTA. Escribe todas las palabras completas, sin abreviaturas ni omisiones de letras.

Si la pregunta es un saludo o simple, responde brevemente.
Si el usuario pide un "resumen", "resumir" o pide específicamente un solo párrafo, DEBES responder OBLIGATORIAMENTE en un único párrafo conciso de máximo 5 líneas, sin usar listas ni títulos.
En otros casos de políticas, normativas o procedimientos, usa este formato:

# Título
**Resumen:** ...
**Detalles:** ...
**Contacto:** ...

Responde siempre en español y con un tono profesional pero cercano.
P: ${query}`;

        const result = await mcpClient.callTool({
            name: 'notebook_query',
            arguments: {
                notebook_id: notebookId,
                query: enhancedQuery,
                conversation_id: conversationId || undefined
            }
        });

        // Extract response text
        const rawText = result.content[0].text;
        let responseText = rawText;
        let finalConversationId = result.conversationId;

        // Detectar si la respuesta es en realidad un error de autenticación (algunos servidores MCP lo devuelven como texto)
        if (rawText.includes('Authentication expired') || rawText.includes('re-authenticate')) {
            console.log('💡 Auth error detected in content. Returning 401.');
            return res.status(401).json({
                error: 'Error de autenticación con Google: La sesión ha expirado. Por favor, ejecuta "npx notebooklm-mcp-server auth" en una terminal para renovar tus credenciales.'
            });
        }

        // Intentar parsear si el resultado es un JSON string (común en este servidor MCP)
        try {
            const parsed = JSON.parse(rawText);
            if (parsed.answer) responseText = parsed.answer;
            if (parsed.conversation_id) finalConversationId = parsed.conversation_id;
        } catch (e) {
            // No es JSON, usar el texto tal cual
        }

        // Limpieza básica (solo referencias numéricas), conservando formato Markdown
        responseText = responseText
            .replace(/\[\d+\]/g, '') // Quitar referencias tipo [1], [2]
            .trim();

        // Check if response indicates information not found
        const isOutOfScope =
            responseText.toLowerCase().includes('no tengo información') ||
            responseText.toLowerCase().includes('no encuentro') ||
            responseText.toLowerCase().includes('no está en') ||
            responseText.toLowerCase().includes('no hay información');

        // If out of scope, provide helpful redirect
        if (isOutOfScope) {
            return res.json({
                response: 'Lo siento, no tengo información específica sobre esa consulta en mi base de conocimientos actual. Te recomiendo que contactes directamente con el departamento de Recursos Humanos para obtener una respuesta precisa. Puedes visitarnos en la oficina 301 o llamar a la extensión 1234.',
                outOfScope: true,
                conversationId: finalConversationId
            });
        }

        // Log successful remote query
        logAnalyticsEvent('RemoteQuery', {
            query, // original query without context
            responseLength: responseText.length,
            latencyMs: Date.now() - start,
            notebookId
        });

        res.json({
            response: responseText,
            outOfScope: false,
            conversationId: finalConversationId
        });

    } catch (error) {
        console.error('Query error details:', error);

        // Check for common errors
        const errorMessage = error.message || 'Unknown error';

        // Detectar errores de autenticación (incluyendo expiración)
        if (errorMessage.includes('401') ||
            errorMessage.includes('unauthorized') ||
            errorMessage.includes('login') ||
            errorMessage.includes('expired') ||
            errorMessage.includes('authenticat')) {
            console.log('💡 Auth error detected. Attempting to refresh cookies from disk...');

            try {
                // Intentar refrescar las cookies automáticamente si el usuario ya corrió el comando 'auth'
                await mcpClient.callTool({ name: 'refresh_auth', arguments: {} });
                console.log('✅ Cookies refreshed. Retrying query automatically...');

                // REINTENTO AUTOMÁTICO (una sola vez)
                const retryResult = await mcpClient.callTool({
                    name: 'notebook_query',
                    arguments: {
                        notebook_id: notebookId,
                        query: req.body.query, // Usamos la query original sin contexto para el reintento simple
                        conversation_id: conversationId || undefined
                    }
                });

                // Si tiene éxito, devolver respuesta normal
                const rawTextRetry = retryResult.content[0].text;
                let responseTextRetry = rawTextRetry;
                try {
                    const parsed = JSON.parse(rawTextRetry);
                    if (parsed.answer) responseTextRetry = parsed.answer;
                } catch (e) { }

                logAnalyticsEvent('RemoteQueryRetry', { success: true });

                return res.json({
                    response: responseTextRetry,
                    outOfScope: false,
                    conversationId: retryResult.conversationId
                });

            } catch (refreshError) {
                console.error('Failed to auto-retry query after refresh:', refreshError);
                return res.status(401).json({
                    error: 'La sesión se ha renovado. Por favor intenta tu pregunta de nuevo.'
                });
            }
        }

        res.status(500).json({
            error: `Error al procesar la consulta: ${errorMessage}`
        });
    }
});

/**
 * Audio Transcription Endpoint
 * High-speed transcription using OpenAI Whisper API
 */
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        if (!process.env.OPENAI_API_KEY) {
            console.warn('⚠️ Whisper fallback: No OpenAI API key configured.');
            return res.status(500).json({
                error: 'Servicio de transcripción no configurado en el servidor.',
                fallbackToWebSpeech: true
            });
        }

        console.log(`🎙️ Recibido audio para transcripción (${req.file.size} bytes)`);
        const start = Date.now();

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        // Crear un archivo temporal legible para la API de OpenAI
        const tempPath = path.join(os.tmpdir(), `upload_${Date.now()}.webm`);
        fs.writeFileSync(tempPath, req.file.buffer);

        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempPath),
            model: "whisper-1",
            language: "es",
        });

        // Limpiar archivo temporal
        fs.unlinkSync(tempPath);

        const duration = Date.now() - start;
        console.log(`✅ Transcripción Whisper completada en ${duration}ms: "${transcription.text}"`);

        logAnalyticsEvent('WhisperTranscription', {
            fileSize: req.file.size,
            latencyMs: duration,
            textLength: transcription.text.length
        });

        res.json({
            transcript: transcription.text,
            latencyMs: duration
        });

    } catch (error) {
        console.error('Whisper Error:', error);
        res.status(500).json({
            error: 'Error al procesar el audio',
            details: error.message,
            fallbackToWebSpeech: true
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
app.use((req, res, next) => {
    // If it's a request to the main app path, serve index.html (SPA)
    if (req.path.startsWith('/AsistenteRRHH/') && !req.path.includes('.')) {
        return res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
    }
    // API 404
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Endpoint no encontrado' });
    }
    next();
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
            console.log(`  GET  /api/system-status - System Health Monitor (NUEVO)`);
            console.log(`  POST /api/query         - Query RRHH knowledge base`);
            console.log(`  POST /api/analytics     - Analytics Report`);
            console.log(`  POST /api/tts           - Google Cloud Text-to-Speech`);
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
