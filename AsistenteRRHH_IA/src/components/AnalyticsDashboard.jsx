import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { API_BASE_URL } from '../utils/apiConfig';
import SystemStatus from './SystemStatus';

const AnalyticsDashboard = ({ onClose }) => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, remote: 0, local: 0, savedTime: 0 });
    const [systemErrors, setSystemErrors] = useState([]);
    const [activeTab, setActiveTab] = useState('analytics'); // 'analytics' | 'system' | 'errors'
    const [errorFilter, setErrorFilter] = useState('all'); // 'all' | 'Mic'

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/analytics`);
            const data = await res.json();
            if (data.events) {
                processEvents(data.events);
            }
        } catch (err) {
            console.error('Error fetching stats:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchSystemErrors = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/system-errors`);
            const data = await res.json();
            if (data.errors) setSystemErrors(data.errors);
        } catch (err) {
            console.error('Error fetching system errors:', err);
        }
    };

    const resolveError = async (id) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/system-errors/resolve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            if (res.ok) fetchSystemErrors();
        } catch (err) {
            console.error('Error resolving error:', err);
        }
    };

    const processEvents = (rawEvents) => {
        setEvents(rawEvents);

        let remoteCount = 0;
        let localCount = 0;
        let savedTimeSeconds = 0;

        rawEvents.forEach(e => {
            const d = e.data || {};
            const source = d.source || (e.type === 'RemoteQuery' ? 'remote' : 'local');

            if (source === 'remote') {
                remoteCount++;
            } else {
                localCount++;
                // Ahorro: Si es local, ahorramos el tiempo promedio de una consulta remota (~4.5s)
                savedTimeSeconds += 4.5;
            }
        });

        setStats({
            total: rawEvents.length,
            remote: remoteCount,
            local: localCount,
            savedTime: Math.round(savedTimeSeconds)
        });
    };

    useEffect(() => {
        fetchAnalytics();
        fetchSystemErrors();
        const interval = setInterval(() => {
            fetchAnalytics();
            fetchSystemErrors();
        }, 10000); // Auto-refresh cada 10s
        return () => clearInterval(interval);
    }, []);

    const getBadgeColor = (type) => {
        if (type === 'RemoteQuery') return 'bg-purple-500/20 text-purple-300 border-purple-500/50';
        if (type === 'LocalIntentResolved') return 'bg-green-500/20 text-green-300 border-green-500/50';
        if (type === 'LocalCacheHit') return 'bg-blue-500/20 text-blue-300 border-blue-500/50';
        return 'bg-gray-500/20 text-gray-300';
    };

    const getDeviceInfo = (ua) => {
        if (!ua) return 'Unknown Device';
        if (ua.includes('iPhone')) return '📱 iPhone';
        if (ua.includes('iPad')) return 'tablet iPad';
        if (ua.includes('Android')) return ua.includes('wv') ? '📱 Android (WV)' : '📱 Android';
        if (ua.includes('Windows')) return '💻 Windows';
        if (ua.includes('Macintosh')) return '💻 Mac';
        return '🖥️ Desktop/Other';
    };

    const getBrowserInfo = (ua) => {
        if (!ua) return '---';
        if (ua.includes('Edg/')) return 'Edge';
        if (ua.includes('Chrome/')) return 'Chrome';
        if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari';
        if (ua.includes('Firefox/')) return 'Firefox';
        return 'Other';
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed inset-0 z-50 bg-[#0d1426]/95 backdrop-blur-xl flex flex-col p-6 overflow-hidden font-mono"
        >
            {/* Header */}
            <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                <div>
                    <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                        ⚡ Admin Dashboard
                    </h1>
                    <p className="text-xs text-white/40 mt-1">System & Analytics Console</p>
                </div>
                <button
                    onClick={onClose}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/60 transition-colors"
                >
                    Cerrar [ESC]
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mb-6">
                <button
                    onClick={() => setActiveTab('analytics')}
                    className={`px-6 py-3 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'analytics' ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
                >
                    📊 Estadísticas de Uso
                </button>
                <button
                    onClick={() => setActiveTab('system')}
                    className={`px-6 py-3 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'system' ? 'bg-green-600 text-white shadow-[0_0_20px_rgba(22,163,74,0.4)]' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
                >
                    🖥️ Estado de Servicios
                </button>
                <button
                    onClick={() => setActiveTab('errors')}
                    className={`px-6 py-3 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'errors' ? 'bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
                >
                    🚨 Errores del Sistema
                    {systemErrors.filter(e => e.status === 'pending').length > 0 && (
                        <span className="bg-white text-red-600 rounded-full w-5 h-5 flex items-center justify-center text-[10px] animate-pulse">
                            {systemErrors.filter(e => e.status === 'pending').length}
                        </span>
                    )}
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-grow overflow-hidden flex flex-col">
                {activeTab === 'system' ? (
                    <SystemStatus />
                ) : activeTab === 'errors' ? (
                    <div className="flex-grow flex flex-col overflow-hidden">
                        <div className="bg-black/20 rounded-xl border border-white/5 overflow-hidden flex flex-col flex-grow">
                            <div className="px-6 py-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
                                <h3 className="text-sm font-semibold text-white/80">System Error Log</h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setErrorFilter('all')}
                                        className={`px-3 py-1 rounded text-[10px] border transition-all ${errorFilter === 'all' ? 'bg-white/10 border-white/20 text-white' : 'border-transparent text-white/40'}`}
                                    >
                                        Todos
                                    </button>
                                    <button
                                        onClick={() => setErrorFilter('Mic')}
                                        className={`px-3 py-1 rounded text-[10px] border transition-all ${errorFilter === 'Mic' ? 'bg-orange-500/20 border-orange-500/40 text-orange-400' : 'border-transparent text-white/40'}`}
                                    >
                                        🎙️ Mic Errs
                                    </button>
                                </div>
                            </div>
                            <div className="overflow-auto p-4 space-y-3 custom-scrollbar">
                                {systemErrors.length === 0 ? (
                                    <div className="text-center py-20 text-white/10 italic">No se han registrado errores aún.</div>
                                ) : (
                                    systemErrors
                                        .filter(err => errorFilter === 'all' || err.type === errorFilter)
                                        .map((err) => (
                                            <motion.div
                                                key={err.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className={`p-4 rounded-xl border ${err.status === 'resolved' ? 'bg-green-500/5 border-green-500/10 opacity-60' : 'bg-red-500/5 border-red-500/20'} flex flex-col md:flex-row gap-4`}
                                            >
                                                <div className="flex-shrink-0 w-32">
                                                    <div className="text-[10px] text-white/30 mb-1">{new Date(err.timestamp).toLocaleString()}</div>
                                                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${err.type === 'Mic' ? 'bg-orange-500/20 text-orange-400' : 'bg-red-500/20 text-red-400'}`}>
                                                        {err.type}
                                                    </span>
                                                </div>
                                                <div className="flex-grow">
                                                    <div className="text-xs font-bold text-white/80 mb-1">[{err.module}] {err.message}</div>

                                                    <div className="flex flex-wrap gap-2 mb-2">
                                                        <div className="px-1.5 py-0.5 bg-white/5 rounded text-[9px] text-white/40 border border-white/10">
                                                            {getDeviceInfo(err.details?.userAgent)}
                                                        </div>
                                                        <div className="px-1.5 py-0.5 bg-white/5 rounded text-[9px] text-white/40 border border-white/10">
                                                            🌐 {getBrowserInfo(err.details?.userAgent)}
                                                        </div>
                                                        {err.details?.phase && (
                                                            <div className="px-1.5 py-0.5 bg-blue-500/10 rounded text-[9px] text-blue-400/80 border border-blue-500/20">
                                                                Phase: {err.details.phase}
                                                            </div>
                                                        )}
                                                        {err.details?.isSecure === false && (
                                                            <div className="px-1.5 py-0.5 bg-red-500/10 rounded text-[9px] text-red-400 font-bold border border-red-500/20">
                                                                ⚠️ INSECURE CONTEXT
                                                            </div>
                                                        )}
                                                    </div>

                                                    {err.stack && (
                                                        <pre className="text-[9px] text-white/20 bg-black/40 p-2 rounded overflow-x-auto font-mono whitespace-pre-wrap">
                                                            {err.stack}
                                                        </pre>
                                                    )}
                                                </div>
                                                <div className="flex-shrink-0 flex items-center justify-end">
                                                    {err.status === 'pending' ? (
                                                        <button
                                                            onClick={() => resolveError(err.id)}
                                                            className="px-4 py-2 bg-green-600/20 hover:bg-green-600/40 border border-green-500/30 rounded-lg text-green-400 text-[10px] font-bold transition-all"
                                                        >
                                                            Marcar Resuelto
                                                        </button>
                                                    ) : (
                                                        <span className="text-green-400/40 text-[10px] flex items-center gap-1 italic">
                                                            ✅ Resuelto
                                                        </span>
                                                    )}
                                                </div>
                                            </motion.div>
                                        ))
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* KPI Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                            <div className="bg-white/5 border border-white/10 p-4 rounded-xl">
                                <div className="text-white/40 text-xs uppercase mb-1">Total Consultas</div>
                                <div className="text-3xl font-bold text-white">{stats.total}</div>
                            </div>
                            <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl">
                                <div className="text-green-400/60 text-xs uppercase mb-1">Resueltas Localmente</div>
                                <div className="text-3xl font-bold text-green-400">{stats.local}</div>
                                <div className="text-[10px] text-green-400/40">Speed: &lt;10ms</div>
                            </div>
                            <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-xl">
                                <div className="text-purple-400/60 text-xs uppercase mb-1">Consultas Remotas</div>
                                <div className="text-3xl font-bold text-purple-400">{stats.remote}</div>
                                <div className="text-[10px] text-purple-400/40">NotebookLM AI</div>
                            </div>
                            <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl relative overflow-hidden">
                                <div className="text-blue-400/60 text-xs uppercase mb-1">Tiempo Ahorrado</div>
                                <div className="text-3xl font-bold text-blue-400">{stats.savedTime}s</div>
                                <div className="text-[10px] text-blue-400/40">ROI Estimado</div>
                                {/* Background decoration */}
                                <div className="absolute -right-4 -bottom-4 text-blue-500/10 text-6xl">⏱️</div>
                            </div>
                        </div>

                        {/* Logs Table */}
                        <div className="flex-grow bg-black/20 rounded-xl border border-white/5 overflow-hidden flex flex-col">
                            <div className="px-4 py-3 border-b border-white/5 bg-white/5 flex justify-between items-center">
                                <h3 className="text-sm font-semibold text-white/80">Live Event Log</h3>
                                <div className="flex gap-2 text-[10px]">
                                    <span className="flex items-center gap-1 text-green-400"><div className="w-2 h-2 rounded-full bg-green-400"></div>Local</span>
                                    <span className="flex items-center gap-1 text-purple-400"><div className="w-2 h-2 rounded-full bg-purple-400"></div>Remote</span>
                                </div>
                            </div>

                            <div className="overflow-auto flex-grow p-2 space-y-1 custom-scrollbar">
                                {loading && events.length === 0 ? (
                                    <div className="text-center py-10 text-white/20">Cargando datos...</div>
                                ) : (
                                    events.map((e, idx) => {
                                        const d = e.data || {};
                                        const isStructured = !!d.session_id;
                                        return (
                                            <motion.div
                                                key={idx}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.02 }}
                                                className="flex flex-col p-3 hover:bg-white/5 rounded-lg border border-transparent hover:border-white/5 transition-colors group"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-20 text-[10px] text-white/30 font-mono flex-shrink-0">
                                                        {new Date(e.timestamp || d.timestamp).toLocaleTimeString()}
                                                    </div>
                                                    <div className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${getBadgeColor(e.type)} w-32 text-center flex-shrink-0`}>
                                                        {e.type.replace('Local', '').replace('Remote', '')}
                                                    </div>
                                                    <div className="flex-grow text-sm text-white/80 truncate font-sans group-hover:text-white transition-colors">
                                                        "{d.query || e.query || '---'}"
                                                    </div>
                                                    <div className="text-right text-xs font-mono text-white/50 flex items-center gap-3">
                                                        {isStructured && (
                                                            <span className="text-[10px] text-blue-400/50 hidden md:inline">
                                                                T:{d.transcription_time_ms}ms | B:{d.backend_latency_ms}ms
                                                            </span>
                                                        )}
                                                        <span className="w-16 font-bold text-white/70">
                                                            {d.total_time_ms || e.latencyMs || 0}ms
                                                        </span>
                                                    </div>
                                                </div>
                                                {isStructured && (
                                                    <div className="mt-1 flex gap-4 text-[9px] text-white/20 font-mono pl-24">
                                                        <span>SESS: {d.session_id.split('-')[1]}</span>
                                                        <span>CONV: {d.conversation_id.split('-')[1]}</span>
                                                        <span>DEVICE: {d.device_type}</span>
                                                    </div>
                                                )}
                                            </motion.div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </motion.div>
    );
};

export default AnalyticsDashboard;
