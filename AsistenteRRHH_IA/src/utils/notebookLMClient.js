/**
 * NotebookLM MCP Client - HYBRID ARCHITECTURE
 * Handles communication with the NotebookLM backend server but prioritizes local intent resolution.
 */

import IntentEngine from './NexusIntentEngine.js';
import QuickCache from './QuickCache.js';
import { API_BASE_URL } from './apiConfig.js';

class NotebookLMClient {
    constructor() {
        this.conversationId = null;
        // Usa la URL base configurada (absoluta en prod, relativa en dev)
        this.apiBaseUrl = API_BASE_URL;
        console.log('NotebookLM Client configured for HYBRID MODE (Local + Remote). API:', this.apiBaseUrl);
    }

    // Helper para enviar métricas al backend sin bloquear UI
    logAnalytics(type, data) {
        fetch(`${this.apiBaseUrl}/api/analytics`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, data })
        }).catch(err => console.warn('Analytics logging error:', err));
    }

    async initialize() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/health`);
            const data = await response.json();
            console.log('NotebookLM Backend Status:', data.status);
            return data.status === 'ready';
        } catch (error) {
            console.error('No se pudo conectar con el servidor backend:', error);
            return false;
        }
    }

    /**
     * Consulta INTELIGENTE al sistema híbrido.
     * Prioridad:
     * 1. IntentEngine (Local, <5ms)
     * 2. QuickCache (Memoria, <10ms)
     * 3. NotebookLM (Remoto, ~10s)
     */
    async query(queryText, options = {}) {
        const startTime = performance.now();
        console.log(`[HybridEngine] Procesando: "${queryText}"`);

        // 1. ANÁLISIS DE INTENCIÓN (Local Edge AI)
        const intent = IntentEngine.analyze(queryText);

        if (intent.type && intent.type !== 'unknown' && intent.type !== 'void') {
            const latency = (performance.now() - startTime).toFixed(2);
            console.log(`[HybridEngine] ✅ Intención detectada: ${intent.type} (${latency}ms)`);

            // Reportar éxito local
            this.logAnalytics('LocalIntentResolved', {
                intentType: intent.type,
                query: queryText,
                latencyMs: latency
            });

            return intent.response;
        }

        // 2. CONSULTA DE CACHÉ (Memoria)
        const cachedResponse = QuickCache.get(queryText);
        if (cachedResponse) {
            const latency = (performance.now() - startTime).toFixed(2);
            console.log(`[HybridEngine] ⚡ Cache HIT (${latency}ms)`);

            // Reportar cache hit
            this.logAnalytics('LocalCacheHit', {
                query: queryText,
                latencyMs: latency
            });

            return cachedResponse;
        }

        // 3. CONSULTA REMOTA (NotebookLM / Deep Cloud)
        try {
            console.log(`[HybridEngine] ☁️ Intentando conexión remota...`);

            const controller = new AbortController();
            // Timeout global de 45s para llamadas remotas complejas
            const timeoutId = setTimeout(() => controller.abort(), 45000);

            // Optimización de payload: Recortar espacios y limitar longitud
            const sanitizedQuery = queryText.trim().substring(0, 500);

            // INYECCIÓN DE CONTEXTO TEMPORAL (Fase 1)
            const now = new Date();
            const timeContext = `[Contexto del Sistema: Fecha y hora actual: ${now.toLocaleString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}. Responde asumiendo esta fecha.]\n\n`;

            // La query final incluye el contexto, pero NO se muestra al usuario ni afecta la key de caché
            const finalRemoteQuery = timeContext + sanitizedQuery;

            const response = await fetch(`${this.apiBaseUrl}/api/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: finalRemoteQuery, // Enviamos query enriquecida
                    conversationId: this.conversationId
                }),
                signal: options?.signal || controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                try {
                    const errorData = JSON.parse(errorText);
                    throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
                } catch (e) {
                    // Si falla parsear el error como JSON, probablemente sea HTML
                    console.error('Server error response:', errorText);
                    const snippet = errorText.substring(0, 100).replace(/<[^>]*>/g, '').trim();
                    throw new Error(`Error del servidor (${response.status}): ${snippet || 'Respuesta inválida'}. Verifica el backend.`);
                }
            }

            const responseText = await response.text();
            let data;

            try {
                data = JSON.parse(responseText);
            } catch (e) {
                console.error('❌ Error parsing JSON response:', e);
                // Manejo robusto de errores de parsing (HTML vs JSON)
                if (responseText.trim().startsWith('<')) {
                    const titleMatch = responseText.match(/<title>(.*?)<\/title>/i);
                    const title = titleMatch ? titleMatch[1] : 'HTML Response';
                    throw new Error(`El servidor devolvió HTML (${response.status}): "${title}". Verifica que el backend esté corriendo.`);
                }
                throw new Error('Respuesta inválida del servidor (JSON malformado).');
            }

            // Guardamos el ID de conversación para mantener el contexto
            if (data.conversationId) {
                this.conversationId = data.conversationId;
            }

            // 4. GUARDAR EN CACHÉ (Para futuras consultas idénticas)
            if (data.response && data.response.length > 10) {
                QuickCache.set(queryText, data.response);
            }

            const totalLatency = (performance.now() - startTime).toFixed(0);
            console.log(`[HybridEngine] 🏁 Respuesta remota completada en ${totalLatency}ms`);

            return data.response;

        } catch (error) {
            console.error('Error al consultar NotebookLM:', error);
            // Propagate the specific error message to the UI
            throw new Error(error.message || 'Lo siento, no pude procesar tu consulta. Por favor, contacta con RRHH.');
        }
    }

    resetConversation() {
        this.conversationId = null;
        QuickCache.clear(); // Limpiar caché al reiniciar conversación
    }
}

export default new NotebookLMClient();
