import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const HelpGuide = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[250] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.92, y: 30 }} 
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.92, y: 30 }}
                    className="bg-[#111827]/95 border border-white/10 rounded-[2.5rem] p-8 max-w-4xl w-full shadow-2xl flex flex-col max-h-[90vh]"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8 flex-shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center text-2xl shadow-[0_0_15px_rgba(234,179,8,0.2)]">
                                💡
                            </div>
                            <div>
                                <h2 className="text-2xl text-white font-bold tracking-tight">Convenciones de Uso</h2>
                                <p className="text-xs text-yellow-300/80 uppercase tracking-widest mt-1">¿Cómo formular tus preguntas?</p>
                            </div>
                        </div>
                        <button 
                            onClick={onClose} 
                            className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 hover:text-red-400 border border-white/10 rounded-full text-white/50 transition-all text-xl"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Content Scrollable */}
                    <div className="overflow-y-auto custom-scrollbar pr-2 space-y-8 pb-4">
                        
                        {/* Instrucciones */}
                        <section className="bg-white/[0.02] border border-white/5 rounded-3xl p-6">
                            <h3 className="text-blue-400 text-sm font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                <span>🎯</span> Instrucciones Clave
                            </h3>
                            <p className="text-white/70 text-lg font-light leading-relaxed">
                                Para obtener la mejor respuesta, formula preguntas <strong className="text-white">claras y específicas</strong>. 
                                El asistente entiende lenguaje natural, pero las consultas cortas sin contexto pueden confundirlo. 
                                <span className="block mt-2 text-blue-300">Entre más contexto des a tu inquietud, más precisa será la respuesta.</span>
                            </p>
                        </section>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Bien formuladas */}
                            <section className="bg-green-500/10 border border-green-500/20 rounded-3xl p-6">
                                <h3 className="text-green-400 text-base font-bold flex items-center gap-2 mb-4">
                                    <span className="text-xl">✅</span> Ejemplos Correctos
                                </h3>
                                <ul className="space-y-4">
                                    <li className="flex items-start gap-3 text-white/80 font-light">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 shrink-0"></div>
                                        <span>"¿Cuántos días de vacaciones tengo al cumplir un año?"</span>
                                    </li>
                                    <li className="flex items-start gap-3 text-white/80 font-light">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 shrink-0"></div>
                                        <span>"¿Cuál es el horario laboral de lunes a viernes?"</span>
                                    </li>
                                    <li className="flex items-start gap-3 text-white/80 font-light">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 shrink-0"></div>
                                        <span>"¿Qué pasa si llego tarde sin justificación?"</span>
                                    </li>
                                </ul>
                            </section>

                            {/* Mal formuladas */}
                            <section className="bg-red-500/10 border border-red-500/20 rounded-3xl p-6">
                                <h3 className="text-red-400 text-base font-bold flex items-center gap-2 mb-4">
                                    <span className="text-xl">❌</span> Ejemplos Incorrectos
                                </h3>
                                <ul className="space-y-4">
                                    <li className="flex items-start gap-3 text-white/60 font-light line-through decoration-red-500/50">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 shrink-0"></div>
                                        <span>"vacaciones"</span>
                                    </li>
                                    <li className="flex items-start gap-3 text-white/60 font-light line-through decoration-red-500/50">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 shrink-0"></div>
                                        <span>"horario"</span>
                                    </li>
                                    <li className="flex items-start gap-3 text-white/60 font-light line-through decoration-red-500/50">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 shrink-0"></div>
                                        <span>"tarde"</span>
                                    </li>
                                </ul>
                                <p className="text-xs text-red-300/70 mt-4 italic">Estas palabras aisladas no expresan tu duda real.</p>
                            </section>
                        </div>

                        {/* Palabras Clave */}
                        <section className="bg-white/[0.02] border border-white/5 rounded-3xl p-6">
                            <h3 className="text-violet-400 text-sm font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                <span>🔑</span> Recomendación de Palabras Clave
                            </h3>
                            <p className="text-white/60 text-sm mb-4">
                                Usar los términos correctos del Reglamento Interno ayuda a localizar la información rápidamente:
                            </p>
                            <div className="flex flex-wrap gap-3">
                                {['vacaciones', 'permisos', 'horario', 'incapacidades', 'sanciones', 'dotación', 'contrato'].map((kw) => (
                                    <span key={kw} className="px-3 py-1.5 bg-violet-500/10 border border-violet-500/20 rounded-lg text-violet-300 font-mono text-sm shadow-sm hover:bg-violet-500/20 transition-colors">
                                        {kw}
                                    </span>
                                ))}
                            </div>
                        </section>

                    </div>
                    
                    {/* Mensaje inferior */}
                    <div className="mt-4 pt-6 border-t border-white/10 text-center">
                        <button 
                            onClick={onClose}
                            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 hover:shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all rounded-full text-white font-bold tracking-wide"
                        >
                            ¡Entendido!
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default HelpGuide;
