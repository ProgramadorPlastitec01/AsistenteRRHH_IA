import { motion, AnimatePresence } from 'framer-motion';

const NexusCore = ({ status, volume }) => {
    // Definición de colores por estado
    const statusColors = {
        idle: {
            primary: '#3b82f6', // Blue
            secondary: '#1d4ed8',
            glow: 'rgba(59, 130, 246, 0.3)',
            particleSpeed: 10
        },
        listening: {
            primary: '#10b981', // Green
            secondary: '#059669',
            glow: 'rgba(16, 185, 129, 0.4)',
            particleSpeed: 5
        },
        thinking: {
            primary: '#8b5cf6', // Purple
            secondary: '#6d28d9',
            glow: 'rgba(139, 92, 246, 0.4)',
            particleSpeed: 2
        },
        speaking: {
            primary: '#f59e0b', // Orange
            secondary: '#d97706',
            glow: 'rgba(245, 158, 11, 0.4)',
            particleSpeed: 4
        }
    };

    const currentTheme = statusColors[status] || statusColors.idle;

    // Transición suave para los cambios de estado
    const stateTransition = { type: "spring", stiffness: 50, damping: 20 };

    return (
        <div className="relative w-full h-full flex flex-col items-center justify-center pointer-events-none">
            {/* Fondo de aura expansiva multinivel */}
            <motion.div
                animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.2, 0.4, 0.2],
                    rotate: 360
                }}
                transition={{
                    scale: { duration: 8, repeat: Infinity, ease: "easeInOut" },
                    rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                    opacity: { duration: 5, repeat: Infinity }
                }}
                className="absolute w-[450px] h-[450px] rounded-full blur-[130px]"
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
                        className="absolute top-1/2 left-1/2"
                        style={{
                            width: '3px',
                            height: '3px',
                            background: currentTheme.primary,
                            borderRadius: '50%',
                            boxShadow: `0 0 12px ${currentTheme.primary}`,
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
                            scale: status === 'speaking' ? 1 + (volume / 200) : 1,
                            borderColor: currentTheme.primary,
                            opacity: status === 'idle' ? 0.1 : 0.3
                        }}
                        transition={{
                            rotate: { duration: 20 + i * 10, repeat: Infinity, ease: "linear" },
                            scale: { type: "spring", stiffness: 300, damping: 30 },
                            borderColor: { duration: 1 },
                            opacity: { duration: 1 }
                        }}
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                        style={{
                            width: `${140 + i * 45}px`,
                            height: `${140 + i * 45}px`,
                            borderStyle: i % 2 === 0 ? 'solid' : 'dashed',
                            borderColor: currentTheme.primary // Ensure initial color matches theme
                        }}
                    />
                ))}

                {/* El Orbe Principal - Animación Estabilizada */}
                <motion.div
                    animate={{
                        scale: status === 'speaking' ? 1 + (volume / 100) : 1,
                        boxShadow: `0 0 50px ${currentTheme.glow}`,
                        backgroundColor: currentTheme.primary
                    }}
                    transition={{
                        scale: { type: "spring", stiffness: 400, damping: 25 },
                        boxShadow: { duration: 1.5, repeat: Infinity, repeatType: "reverse" },
                        backgroundColor: { duration: 1 }
                    }}
                    className="relative w-36 h-36 rounded-full z-10 overflow-hidden backdrop-blur-sm"
                    style={{
                        background: `radial-gradient(circle at 30% 30%, white 0%, ${currentTheme.primary} 30%, ${currentTheme.secondary} 100%)`
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
                        <div className="absolute inset-0 flex items-center justify-center">
                            {[...Array(12)].map((_, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{
                                        scale: [1, 2 + volume / 40],
                                        opacity: [0.6, 0],
                                        rotate: i * 30
                                    }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 1, repeat: Infinity, repeatDelay: 0.1 }}
                                    className="absolute w-[1.5px] h-24 bg-gradient-to-t from-white to-transparent origin-bottom"
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
