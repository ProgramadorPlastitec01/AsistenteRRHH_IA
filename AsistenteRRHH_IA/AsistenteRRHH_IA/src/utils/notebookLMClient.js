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
            if (!response.ok) {
                // Server is running but erroring — log status, don't crash on .json()
                const text = await response.text().catch(() => '');
                console.warn(`Backend health check failed (HTTP ${response.status}):`, text.substring(0, 120));
                return false;
            }
            const data = await response.json();
            console.log('NotebookLM Backend Status:', data.status);
            return data.status === 'ready';
        } catch (error) {
            // Network-level error (backend not running, DNS, etc.)
            console.error('No se pudo conectar con el servidor backend:', error.message);
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

            // Build a single abort signal.
            // If the caller provides an external signal (e.g. user stops recording), link the
            // internal 45 s safety timeout to it so clearTimeout fires on external abort too.
            let signal;
            let timeoutId;

            if (options?.signal) {
                signal = options.signal;
                // Safety net: clear the timeout if the external signal fires first
                timeoutId = setTimeout(() => {
                    console.warn('[HybridEngine] Timeout interno de 65s alcanzado');
                }, 65000);
                signal.addEventListener('abort', () => clearTimeout(timeoutId), { once: true });
            } else {
                const controller = new AbortController();
                signal = controller.signal;
                timeoutId = setTimeout(() => controller.abort(), 65000);
            }

            // Optimización de payload: Recortar espacios y limitar longitud
            const sanitizedQuery = queryText.trim().substring(0, 500);

            const response = await fetch(`${this.apiBaseUrl}/api/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: sanitizedQuery,
                    conversationId: this.conversationId
                }),
                signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');

                if (!errorText) {
                    // Empty body: backend running but crashed mid-handler, or Vite proxy error
                    throw new Error(
                        response.status === 503
                            ? 'El servidor backend no está disponible. Por favor abre otra terminal y ejecuta: node server.js'
                            : `Error del servidor (${response.status}). Verifica que node server.js esté corriendo.`
                    );
                }

                try {
                    const errorData = JSON.parse(errorText);
                    throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
                } catch (e) {
                    if (e.message.startsWith('Error')) throw e; // already a useful message
                    // Body is HTML or malformed
                    const snippet = errorText.substring(0, 100).replace(/<[^>]*>/g, '').trim();
                    throw new Error(`Error del servidor (${response.status}): ${snippet || 'Respuesta no válida'}. Verifica el backend.`);
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
