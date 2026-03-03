/**
 * QuickCache.js
 * Caché en memoria para evitar llamadas redundantes a NotebookLM.
 * Lógica LRU (Least Recently Used) básica.
 */

class QuickCache {
    constructor(ttlMs = 1000 * 60 * 10, maxSize = 50) { // 10 minutos de TTL, max 50 entradas
        this.cache = new Map();
        this.ttl = ttlMs;
        this.maxSize = maxSize;
    }

    _normalize(key) {
        return key.toLowerCase().trim().replace(/[.,?]/g, '');
    }

    get(query) {
        const key = this._normalize(query);
        const item = this.cache.get(key);

        if (!item) return null;

        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            console.log(`[Cache] Expirado: "${query}"`);
            return null;
        }

        console.log(`[Cache] HIT: "${query}" (latencia: <1ms)`);

        // Refrescar uso (LRU)
        this.cache.delete(key);
        this.cache.set(key, item);

        return item.response;
    }

    set(query, response) {
        if (!response || response.length < 5) return; // No cachear respuestas cortas o vacías

        const key = this._normalize(query);

        // Evitar sobrellenado (LRU: eliminar el más antiguo insertado)
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, {
            response,
            expiry: Date.now() + this.ttl
        });

        console.log(`[Cache] SET: "${query}"`);
    }

    clear() {
        this.cache.clear();
    }
}

export default new QuickCache();
