import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { API_BASE_URL } from '../utils/apiConfig';
import SystemStatus from './SystemStatus';

const AnalyticsDashboard = ({ onClose }) => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, remote: 0, local: 0, savedTime: 0 });
    const [activeTab, setActiveTab] = useState('analytics'); // 'analytics' | 'system'

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

    const processEvents = (rawEvents) => {
        setEvents(rawEvents);

        let remoteCount = 0;
        let localCount = 0;
        let savedTimeSeconds = 0;

        rawEvents.forEach(e => {
            if (e.type === 'RemoteQuery') {
                remoteCount++;
            } else if (e.type === 'LocalIntentResolved' || e.type === 'LocalCacheHit') {
                localCount++;
                // Estimamos que una consulta remota tarda 10s y una local 0.01s
                // Ahorro por cada local = ~9.99s
                savedTimeSeconds += 9.9;
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
        const interval = setInterval(fetchAnalytics, 10000); // Auto-refresh cada 10s
        return () => clearInterval(interval);
    }, []);

    const getBadgeColor = (type) => {
        if (type === 'RemoteQuery') return 'bg-purple-500/20 text-purple-300 border-purple-500/50';
        if (type === 'LocalIntentResolved') return 'bg-green-500/20 text-green-300 border-green-500/50';
        if (type === 'LocalCacheHit') return 'bg-blue-500/20 text-blue-300 border-blue-500/50';
        return 'bg-gray-500/20 text-gray-300';
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
            </div>

            {/* Content Area */}
            <div className="flex-grow overflow-hidden flex flex-col">
                {activeTab === 'system' ? (
                    <SystemStatus />
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
                                    events.map((e, idx) => (
                                        <motion.div
                                            key={idx}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.03 }}
                                            className="flex items-center gap-4 p-3 hover:bg-white/5 rounded-lg border border-transparent hover:border-white/5 transition-colors group"
                                        >
                                            <div className="w-20 text-[10px] text-white/30 font-mono flex-shrink-0">
                                                {new Date(e.timestamp).toLocaleTimeString()}
                                            </div>
                                            <div className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${getBadgeColor(e.type)} w-32 text-center flex-shrink-0`}>
                                                {e.type.replace('Local', '').replace('Remote', '')}
                                            </div>
                                            <div className="flex-grow text-sm text-white/80 truncate font-sans group-hover:text-white transition-colors">
                                                "{e.query || e.data?.query || '---'}"
                                            </div>
                                            <div className="w-20 text-right text-xs font-mono text-white/50">
                                                {e.latencyMs || e.data?.latencyMs || 0}ms
                                            </div>
                                        </motion.div>
                                    ))
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
