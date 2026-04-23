/**
 * ConversationStore - Intelligent Persistence & Cache Layer
 * Manages local storage, response caching, and session history
 */
class ConversationStore {
    constructor() {
        this.CACHE_KEY = 'nexus_response_cache';
        this.HISTORY_KEY = 'nexus_session_history';
        this.RECENT_KEY = 'nexus_recent_queries';
        this.CACHE_TTL = 3600000; // 1 hour in ms
        this.MAX_RECENT = 5;
    }

    /**
     * Normalizes a query string for cache key generation
     */
    _normalize(query) {
        return query.toLowerCase().trim().replace(/[¿?¡!]/g, '').replace(/\s+/g, ' ');
    }

    /**
     * Gets a cached response if valid and not expired
     */
    getCachedResponse(query) {
        try {
            const cache = JSON.parse(localStorage.getItem(this.CACHE_KEY) || '{}');
            const key = this._normalize(query);
            const entry = cache[key];

            if (entry && (Date.now() - entry.timestamp < this.CACHE_TTL)) {
                console.log(`[Store] Cache Hit: "${query}"`);
                return entry.response;
            }
        } catch (e) {
            console.warn('[Store] Error reading cache', e);
        }
        return null;
    }

    /**
     * Stores a response in the cache
     */
    setCachedResponse(query, response) {
        try {
            const cache = JSON.parse(localStorage.getItem(this.CACHE_KEY) || '{}');
            const key = this._normalize(query);

            cache[key] = {
                response,
                timestamp: Date.now()
            };

            // Cleanup expired entries to keep localStorage clean
            const now = Date.now();
            const cleanCache = {};
            Object.keys(cache).forEach(k => {
                if (now - cache[k].timestamp < this.CACHE_TTL) {
                    cleanCache[k] = cache[k];
                }
            });

            localStorage.setItem(this.CACHE_KEY, JSON.stringify(cleanCache));
        } catch (e) {
            console.warn('[Store] Error writing cache', e);
        }
    }

    /**
     * Saves a conversation to history and recent queries
     */
    saveConversation(sessionId, data) {
        try {
            // 1. Update Recent Queries (Quick Memory)
            let recent = JSON.parse(localStorage.getItem(this.RECENT_KEY) || '[]');
            // Remove if already exists to move to top
            recent = recent.filter(r => r.query !== data.query);
            recent.unshift({
                conversation_id: data.conversation_id,
                query: data.query,
                timestamp: new Date().toISOString()
            });
            // Keep only the last 5
            localStorage.setItem(this.RECENT_KEY, JSON.stringify(recent.slice(0, this.MAX_RECENT)));

            // 2. Update Session History
            let history = JSON.parse(localStorage.getItem(this.HISTORY_KEY) || '[]');
            history.push({
                session_id: sessionId,
                ...data,
                timestamp: new Date().toISOString()
            });
            localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));

            console.log(`[Store] Saved conversation to history: ${data.conversation_id}`);
        } catch (e) {
            console.warn('[Store] Error saving conversation', e);
        }
    }

    getRecentQueries() {
        try {
            return JSON.parse(localStorage.getItem(this.RECENT_KEY) || '[]');
        } catch (e) {
            return [];
        }
    }

    getSessionHistory(sessionId = null) {
        try {
            const history = JSON.parse(localStorage.getItem(this.HISTORY_KEY) || '[]');
            if (sessionId) {
                return history.filter(h => h.session_id === sessionId);
            }
            return history;
        } catch (e) {
            return [];
        }
    }

    clearSessionHistory() {
        localStorage.removeItem(this.HISTORY_KEY);
    }
}

const conversationStore = new ConversationStore();
export default conversationStore;
