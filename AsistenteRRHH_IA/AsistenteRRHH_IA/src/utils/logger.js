import { API_BASE_URL } from './apiConfig';

/**
 * NexusLogger - Centralized Telemetry and Performance Tracker
 * Professional logging layer for HR Kiosk
 */
class NexusLogger {
    constructor() {
        this.sessionId = this._generateId('SESS');
        this.currentConversationId = null;
        this.timers = {};
        this.deviceInfo = this._getDeviceInfo();
    }

    _generateId(prefix) {
        return `${prefix}-${Math.random().toString(36).substr(2, 9).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    }

    _getDeviceInfo() {
        const ua = navigator.userAgent;
        if (/iPhone/i.test(ua)) return 'iphone';
        if (/iPad/i.test(ua)) return 'tablet';
        if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return 'tablet';
        if (/Android/i.test(ua)) return 'mobile';
        return 'desktop';
    }

    startSession() {
        this.sessionId = this._generateId('SESS');
        console.log(`[Logger] New Session Started: ${this.sessionId}`);
    }

    startConversation(queryText) {
        this.currentConversationId = this._generateId('CNV');
        this.timers = {
            total: performance.now(),
            phases: {}
        };
        console.log(`[Logger] Starting Transaction: ${this.currentConversationId} | Query: "${queryText}"`);
        return this.currentConversationId;
    }

    startPhase(phaseName) {
        this.timers.phases[phaseName] = performance.now();
    }

    endPhase(phaseName) {
        if (this.timers.phases[phaseName]) {
            const duration = performance.now() - this.timers.phases[phaseName];
            this.timers.phases[phaseName] = Math.round(duration);
            return this.timers.phases[phaseName];
        }
        return 0;
    }

    async logConversation(data) {
        const totalTime = performance.now() - this.timers.total;

        const event = {
            session_id: this.sessionId,
            conversation_id: this.currentConversationId,
            timestamp: new Date().toISOString(),
            device_type: this.deviceInfo,
            status: data.status || 'success',
            query: data.query,
            source: data.source || 'remote', // 'local' | 'remote'
            transcription_time_ms: this.timers.phases['transcription'] || 0,
            backend_latency_ms: this.timers.phases['backend'] || 0,
            total_time_ms: Math.round(totalTime),
            error_type: data.errorType || null,
            userAgent: navigator.userAgent
        };

        console.log('[Logger] Structured Event:', event);

        // Send to backend (AnalyticsDashboard reads from /api/analytics)
        try {
            await fetch(`${API_BASE_URL}/api/analytics`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: event.source === 'local' ? 'LocalIntentResolved' : 'RemoteQuery',
                    data: event // The dashboard can now use this full structured object
                })
            });
        } catch (err) {
            console.warn('[Logger] Failed to send telemetry to backend', err);
        }

        return event;
    }

    async logError(category, module, message, stack = null, details = {}) {
        const categories = ['VOICE_ERROR', 'NETWORK_ERROR', 'BACKEND_ERROR', 'TIMEOUT_ERROR', 'UNKNOWN_ERROR'];
        const type = categories.includes(category) ? category : 'UNKNOWN_ERROR';

        const errorLog = {
            id: this._generateId('ERR'),
            timestamp: new Date().toISOString(),
            session_id: this.sessionId,
            conversation_id: this.currentConversationId,
            type,
            module,
            message,
            stack,
            details: {
                ...details,
                device_type: this.deviceInfo,
                userAgent: navigator.userAgent
            }
        };

        console.error(`[Logger] ${type} in ${module}:`, message);

        try {
            await fetch(`${API_BASE_URL}/api/report-error`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(errorLog)
            });
        } catch (err) {
            console.warn('[Logger] Failed to report error to backend');
        }
    }
}

const logger = new NexusLogger();
export default logger;
