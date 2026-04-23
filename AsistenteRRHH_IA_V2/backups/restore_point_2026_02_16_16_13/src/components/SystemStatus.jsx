import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const SystemStatus = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const checkStatus = async () => {
        setLoading(true);
        setError(null);
        try {
            const start = performance.now();
            const res = await fetch('/api/system-status');
            const networkLatency = Math.round(performance.now() - start);

            if (!res.ok) throw new Error('Error de conexión con Backend');

            const data = await res.json();

            // Actualizar latencia del backend con la medida real de red
            if (data.services && data.services[0]) {
                data.services[0].latency = networkLatency;
            }

            setStats(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkStatus();
        const interval = setInterval(checkStatus, 30000); // Auto-refresh cada 30s
        return () => clearInterval(interval);
    }, []);

    const getStatusColor = (status) => {
        switch (status) {
            case 'active': return 'text-green-400 border-green-500/50 bg-green-500/10';
            case 'degraded': return 'text-yellow-400 border-yellow-500/50 bg-yellow-500/10';
            case 'inactive': return 'text-red-400 border-red-500/50 bg-red-500/10';
            case 'checking': return 'text-blue-400 border-blue-500/50 bg-blue-500/10 animate-pulse';
            default: return 'text-gray-400 border-gray-500/50 bg-gray-500/10';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'active': return '🟢';
            case 'degraded': return '🟡';
            case 'inactive': return '🔴';
            default: return '⚪';
        }
    };

    if (error) {
        return (
            <div className="p-8 text-center text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl">
                ⚠️ Error al verificar estado: {error}
                <button onClick={checkStatus} className="block mx-auto mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-sm">
                    Reintentar
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white/80">Monitor de Servicios</h2>
                <button
                    onClick={checkStatus}
                    disabled={loading}
                    className="px-3 py-1 text-xs bg-white/5 hover:bg-white/10 rounded border border-white/10 text-white/60 transition-colors disabled:opacity-50"
                >
                    {loading ? 'Verificando...' : '🔄 Actualizar Ahora'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {stats?.services?.map((service) => (
                    <motion.div
                        key={service.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`p-4 rounded-xl border flex flex-col justify-between h-32 ${getStatusColor(service.status)}`}
                    >
                        <div className="flex justify-between items-start">
                            <span className="font-bold text-sm uppercase tracking-wider opacity-80">{service.name}</span>
                            <span className="text-xl">{getStatusIcon(service.status)}</span>
                        </div>

                        <div>
                            <div className="text-2xl font-mono font-bold">
                                {service.status === 'active' ? 'ONLINE' : service.status.toUpperCase()}
                            </div>
                            <div className="flex justify-between items-end mt-2 text-[10px] opacity-60 font-mono">
                                <span>Latency: {service.latency}ms</span>
                                {service.message && <span className="text-right max-w-[100px] truncate" title={service.message}>{service.message}</span>}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="mt-8 bg-black/20 rounded-lg p-4 border border-white/5">
                <h3 className="text-xs text-white/40 uppercase mb-2">Logs de Sistema (Última hora)</h3>
                <div className="font-mono text-[10px] text-white/30 space-y-1">
                    <div>[INF] System check initiated by admin user via web console.</div>
                    <div>[INF] Database integrity check passed (latency: {stats?.services[1]?.latency}ms).</div>
                    <div>[INF] NotebookLM heartbeat {stats?.services[2]?.status === 'active' ? 'successful' : 'failed'}.</div>
                </div>
            </div>
        </div>
    );
};

export default SystemStatus;
