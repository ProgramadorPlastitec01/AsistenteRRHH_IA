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
import OpenAI from 'openai';
import os from 'os';

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Verificar que la API key esté cargada
console.log('🔑 Verificando API key de OpenAI...');
if (process.env.OPENAI_API_KEY) {
    console.log('✅ OPENAI_API_KEY cargada correctamente (longitud:', process.env.OPENAI_API_KEY.length, 'caracteres)');
} else {
    console.warn('⚠️ OPENAI_API_KEY NO encontrada en .env');
}

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

        // Create MCP client
        mcpClient = new Client({
            name: 'hr-kiosk-backend',
            version: '1.0.0'
        }, {
            capabilities: {}
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

    } catch (error) {
        console.error('Failed to initialize MCP:', error);
        console.log('⚠️ Reentering DEMO MODE. The server will stay online but will provide simulated responses until authentication is fixed.');
        console.log('💡 To fix this, run: npx notebooklm-mcp-server auth');
        isInitialized = true; // Mark as initialized but in demo mode
        notebookId = 'DEMO_MODE';
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
 * Query endpoint - Main interface for frontend
 */
app.post('/api/query', async (req, res) => {
    try {
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
                response: `[MODO DEMO] ${simulatedResponse}\n\n(Aviso: El servidor no pudo conectarse a NotebookLM. Por favor corre 'npx notebooklm-mcp-server auth' para activar el modo real)`,
                outOfScope: false
            });
        }

        // Call NotebookLM query tool with optimized prompt for speed and brevity
        const enhancedQuery = `RESPUESTA EN 1 ORACIÓN (MÁX 15 PALABRAS). DIRECTO AL GRANO.
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

        // Intentar parsear si el resultado es un JSON string (común en este servidor MCP)
        try {
            const parsed = JSON.parse(rawText);
            if (parsed.answer) responseText = parsed.answer;
            if (parsed.conversation_id) finalConversationId = parsed.conversation_id;
        } catch (e) {
            // No es JSON, usar el texto tal cual
        }

        // Limpiar el texto: quitar asteriscos de negrita, marcas de markdown, etc.
        // para que se vea mejor y sea más fácil de leer por voz
        responseText = responseText
            .replace(/\*\*/g, '') // Quitar negritas **
            .replace(/\*/g, '')   // Quitar asteriscos sueltos
            .replace(/#/g, '')    // Quitar almohadillas de títulos
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

        res.json({
            response: responseText,
            outOfScope: false,
            conversationId: finalConversationId
        });

    } catch (error) {
        console.error('Query error details:', error);

        // Check for common errors
        const errorMessage = error.message || 'Unknown error';

        if (errorMessage.includes('401') || errorMessage.includes('unauthorized') || errorMessage.includes('login')) {
            console.log('💡 Auth error detected. Suggesting re-authentication.');
            return res.status(401).json({
                error: 'Error de autenticación con Google. Por favor, ejecuta "npx notebooklm-mcp-server auth" en la terminal para renovar tus credenciales.'
            });
        }

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
            console.log(`  GET  /api/health   - Health check`);
            console.log(`  POST /api/query    - Query RRHH knowledge base`);
            console.log(`  POST /api/tts      - Google Cloud Text-to-Speech Neural (premium voice)`);
            console.log(`  POST /api/reset    - Reset conversation`);
            console.log(`  GET  /api/notebook - Get notebook info\n`);
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
