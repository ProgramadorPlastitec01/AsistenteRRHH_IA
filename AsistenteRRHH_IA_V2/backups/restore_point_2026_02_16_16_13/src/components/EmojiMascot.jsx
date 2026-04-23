import { motion, AnimatePresence } from 'framer-motion';

const EmojiMascot = ({ status, volume }) => {
    const getEmojiConfig = () => {
        switch (status) {
            case 'listening':
                return {
                    emoji: '🎙️',
                    label: 'Escuchando...',
                    animation: {
                        scale: [1, 1.1, 1],
                        rotate: [0, 5, -5, 0],
                        transition: { repeat: Infinity, duration: 1.5 }
                    },
                    subEmoji: '👂'
                };
            case 'thinking':
                return {
                    emoji: '🤔',
                    label: 'Pensando...',
                    animation: {
                        y: [0, -20, 0],
                        transition: { repeat: Infinity, duration: 1, ease: "easeInOut" }
                    },
                    subEmoji: '⏳'
                };
            case 'speaking':
                return {
                    emoji: '🗣️',
                    label: 'Hablando...',
                    animation: {
                        scale: [1, 1.05, 1],
                        transition: { repeat: Infinity, duration: 0.5 }
                    },
                    subEmoji: '🔊'
                };
            default:
                return {
                    emoji: '🤖',
                    label: 'Listo para ayudar',
                    animation: {
                        y: [0, -10, 0],
                        transition: { repeat: Infinity, duration: 4, ease: "easeInOut" }
                    },
                    subEmoji: '💬'
                };
        }
    };

    const config = getEmojiConfig();

    return (
        <div className="relative w-full h-full flex flex-col items-center justify-center pointer-events-none">
            {/* Fondo de aura dinámico */}
            <motion.div
                animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.1, 0.2, 0.1]
                }}
                transition={{ duration: 4, repeat: Infinity }}
                className={`absolute w-64 h-64 rounded-full blur-[80px] ${status === 'listening' ? 'bg-green-500' :
                        status === 'thinking' ? 'bg-blue-500' :
                            status === 'speaking' ? 'bg-primary-400' : 'bg-white'
                    }`}
            />

            <div className="relative flex items-center justify-center">
                {/* Emoji Principal */}
                <motion.div
                    key={status}
                    initial={{ scale: 0, rotate: -20, opacity: 0 }}
                    animate={{ scale: 1, rotate: 0, opacity: 1, ...config.animation }}
                    exit={{ scale: 0, opacity: 0 }}
                    className="text-[120px] drop-shadow-[0_20px_20px_rgba(0,0,0,0.5)] z-10 select-none"
                >
                    {config.emoji}
                </motion.div>

                {/* Sub-Emoji flotante */}
                <motion.div
                    animate={{
                        y: [0, -15, 0],
                        x: [0, 10, 0],
                        scale: status === 'speaking' ? [1, 1.2, 1] : 1
                    }}
                    transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                    className="absolute -top-4 -right-4 text-5xl drop-shadow-lg z-20"
                >
                    {config.subEmoji}
                </motion.div>

                {/* Visualizador de volumen para el estado de habla */}
                {status === 'speaking' && (
                    <div className="absolute -bottom-8 flex gap-1 items-end h-8">
                        {[...Array(5)].map((_, i) => (
                            <motion.div
                                key={i}
                                animate={{
                                    height: [8, Math.max(8, volume * (1 - i * 0.1)), 8]
                                }}
                                transition={{ repeat: Infinity, duration: 0.2, delay: i * 0.05 }}
                                className="w-2 bg-primary-400 rounded-full"
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Etiqueta de estado con estilo premium */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-12 px-6 py-2 bg-white/5 border border-white/10 rounded-full backdrop-blur-md"
            >
                <span className="text-primary-200 text-xs font-bold uppercase tracking-[0.3em] italic">
                    {config.label}
                </span>
            </motion.div>
        </div>
    );
};

export default EmojiMascot;
