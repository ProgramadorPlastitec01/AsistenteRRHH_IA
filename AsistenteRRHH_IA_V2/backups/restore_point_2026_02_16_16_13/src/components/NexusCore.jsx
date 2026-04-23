import { motion, useTransform, useMotionValue, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

const NexusCore = ({ status, volume }) => {
    // Asegurar que volume sea un MotionValue
    const volumeMV = useMotionValue(0);

    // Si volume viene como prop (sea número o MotionValue), sincronizarlo
    useEffect(() => {
        if (volume?.get) {
            // Es un MotionValue, suscribirse a cambios (raro pasar MV a MV pero safety check)
            const unsub = volume.on("change", v => volumeMV.set(v));
            return unsub;
        } else if (typeof volume === 'number') {
            volumeMV.set(volume);
        }
    }, [volume, volumeMV]);

    // O mejor: usar un hook que normalice. 
    // Dado que vamos a cambiar el padre, asumamos que 'volume' PUEDE ser un MotionValue.
    // Si el padre pasa un MotionValue, deberíamos usarlo directamente.
    const activeVolume = volume?.get ? volume : volumeMV;

    // Transformaciones optimizadas (GPU friendly)
    const orbScale = useTransform(activeVolume, [0, 100], [1, 1.5]);
    const ringScale = useTransform(activeVolume, [0, 200], [1, 2]);
    const rayScale = useTransform(activeVolume, [0, 100], [1, 3]);

    // Definición de colores por estado
    const statusColors = {
        idle: {
            primary: '#3b82f6', // Blue
            secondary: '#1d4ed8',
            glow: 'rgba(59, 130, 246, 0.3)',
        },
        listening: {
            primary: '#10b981', // Green
            secondary: '#059669',
            glow: 'rgba(16, 185, 129, 0.4)',
        },
        thinking: {
            primary: '#8b5cf6', // Purple
            secondary: '#6d28d9',
            glow: 'rgba(139, 92, 246, 0.4)',
        },
        speaking: {
            primary: '#f59e0b', // Orange
            secondary: '#d97706',
            glow: 'rgba(245, 158, 11, 0.4)',
        }
    };

    const currentTheme = statusColors[status] || statusColors.idle;

    return (
        <div className="relative w-full h-full flex flex-col items-center justify-center pointer-events-none transform-gpu">
            {/* Fondo de aura expansiva multinivel - OPTIMIZADO: Sin blur excesivo */}
            <motion.div
                animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.2, 0.3, 0.2],
                    rotate: 360
                }}
                transition={{
                    scale: { duration: 8, repeat: Infinity, ease: "easeInOut" },
                    rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                    opacity: { duration: 5, repeat: Infinity }
                }}
                className="absolute w-[300px] h-[300px] md:w-[450px] md:h-[450px] rounded-full blur-[60px] md:blur-[100px] will-change-transform"
                style={{ background: `conic-gradient(from 0deg at 50% 50%, transparent, ${currentTheme.glow}, transparent)` }}
            />

            {/* Núcleo Central de Energía */}
            <div className="relative scale-110">
                {/* Partículas de Datos Orbitales con velocidad constante */}
                {[...Array(15)].map((_, i) => (
                    <motion.div
                        key={`part-${i}`}
                        animate={{
                            rotate: 360,
                            opacity: status === 'thinking' ? [0.4, 1, 0.4] : [0.2, 0.5, 0.2]
                        }}
                        transition={{
                            rotate: { duration: 15 + i, repeat: Infinity, ease: "linear" },
                            opacity: { duration: 2, repeat: Infinity }
                        }}
                        className="absolute top-1/2 left-1/2 will-change-transform"
                        style={{
                            width: '3px',
                            height: '3px',
                            background: currentTheme.primary,
                            borderRadius: '50%',
                            boxShadow: `0 0 5px ${currentTheme.primary}`,
                            marginLeft: `${80 + (i % 4) * 15}px`,
                            transformOrigin: `-${80 + (i % 4) * 15}px center`
                        }}
                    />
                ))}

                {/* Anillos orbitales tecnológicos */}
                {[...Array(4)].map((_, i) => (
                    <motion.div
                        key={i}
                        animate={{
                            rotate: i % 2 === 0 ? 360 : -360,
                            borderColor: currentTheme.primary,
                            opacity: status === 'idle' ? 0.1 : 0.3
                        }}
                        transition={{
                            rotate: { duration: 20 + i * 10, repeat: Infinity, ease: "linear" },
                            borderColor: { duration: 1 },
                            opacity: { duration: 1 }
                        }}
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 will-change-transform"
                        style={{
                            width: `${140 + i * 45}px`,
                            height: `${140 + i * 45}px`,
                            borderStyle: i % 2 === 0 ? 'solid' : 'dashed',
                            borderColor: currentTheme.primary,
                            scale: status === 'speaking' ? ringScale : 1
                        }}
                    />
                ))}

                {/* El Orbe Principal - Animación Estabilizada */}
                <motion.div
                    animate={{
                        boxShadow: `0 0 30px ${currentTheme.glow}`,
                        backgroundColor: currentTheme.primary
                    }}
                    transition={{
                        boxShadow: { duration: 1.5, repeat: Infinity, repeatType: "reverse" },
                        backgroundColor: { duration: 1 }
                    }}
                    className="relative w-36 h-36 rounded-full z-10 overflow-hidden backdrop-blur-sm will-change-transform"
                    style={{
                        background: `radial-gradient(circle at 30% 30%, white 0%, ${currentTheme.primary} 30%, ${currentTheme.secondary} 100%)`,
                        scale: status === 'speaking' ? orbScale : 1
                    }}
                >
                    {/* Efecto de Respiración Continua (no se acelera) */}
                    <motion.div
                        animate={{
                            scale: [1, 1.05, 1],
                            opacity: [0.3, 0.5, 0.3]
                        }}
                        transition={{
                            duration: 4,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className="absolute inset-0 bg-white/20 rounded-full"
                    />

                    {/* Escaneo Lento */}
                    <motion.div
                        animate={{ y: ['-100%', '200%'] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-x-0 h-[2px] bg-white/50 blur-[1px] z-20"
                    />
                </motion.div>

                {/* Rayos de Comunicación Suavizados */}
                <AnimatePresence>
                    {status === 'speaking' && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            {[...Array(12)].map((_, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ scaleY: 0, opacity: 0 }}
                                    animate={{
                                        scaleY: [1, 2],
                                        opacity: [0.6, 0],
                                        rotate: i * 30
                                    }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 1, repeat: Infinity, repeatDelay: 0.1 }}
                                    className="absolute w-[1.5px] h-24 bg-gradient-to-t from-white to-transparent origin-bottom will-change-transform"
                                    style={{
                                        scaleY: rayScale // Use transform for height animation
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </AnimatePresence>
            </div>

        </div>
    );
};

export default NexusCore;
