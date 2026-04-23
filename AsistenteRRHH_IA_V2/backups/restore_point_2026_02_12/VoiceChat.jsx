import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import notebookLMClient from '../utils/notebookLMClient';
import NexusCore from './NexusCore';
import CompanyLogo from './CompanyLogo';

const VoiceChat = () => {
    const [isActivated, setIsActivated] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [state, setState] = useState('idle'); // idle, listening, thinking, speaking
    const [transcript, setTranscript] = useState('');
    const [response, setResponse] = useState('');
    const [error, setError] = useState('');
    const [isSupported, setIsSupported] = useState(true);
    const [volume, setVolume] = useState(0);

    const recognitionRef = useRef(null);
    const synthRef = useRef(window.speechSynthesis);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const animationFrameRef = useRef(null);
    const streamRef = useRef(null);
    const inactivityTimerRef = useRef(null);

    useEffect(() => {
        // Check browser support for Web Speech API
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            setIsSupported(false);
            setError('Tu navegador no soporta reconocimiento de voz. Por favor usa Chrome o Edge.');
            return;
        }

        // Initialize NotebookLM client
        notebookLMClient.initialize();

        return () => {
            if (recognitionRef.current) recognitionRef.current.stop();
            if (synthRef.current) synthRef.current.cancel();
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            if (audioContextRef.current) audioContextRef.current.close();
            if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        };
    }, []);

    // INACTIVITY LOGIC (30 Seconds)
    const resetInactivityTimer = () => {
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);

        // Solo aplicar si el sistema está activado
        if (!isActivated) return;

        inactivityTimerRef.current = setTimeout(() => {
            handleInactivityTimeout();
        }, 30000); // 30 segundos
    };

    const handleInactivityTimeout = () => {
        console.log("Inactivity detected. Resetting to standby mode.");
        setIsActivated(false);
        setState('idle');
        setTranscript('');
        setResponse('');
        if (synthRef.current) synthRef.current.cancel();
        if (recognitionRef.current) recognitionRef.current.stop();
    };

    // Reset timer on state changes or user interactions
    useEffect(() => {
        resetInactivityTimer();
    }, [state, isActivated, transcript, response]);

    useEffect(() => {
        if (!isActivated) return;

        const events = ['mousemove', 'mousedown', 'keydown', 'touchstart'];
        const handleUserActivity = () => resetInactivityTimer();

        events.forEach(event => window.addEventListener(event, handleUserActivity));

        return () => {
            events.forEach(event => window.removeEventListener(event, handleUserActivity));
        };
    }, [isActivated]);


    const speakText = (text) => {
        // Cancel any ongoing speech
        synthRef.current.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-ES';
        utterance.rate = 0.9; // Regresamos a velocidad corporativa formal
        utterance.pitch = 1.0; // Tono profesional sin efectos agudos

        // Try to use a natural Spanish voice
        const voices = synthRef.current.getVoices();
        const spanishVoice = voices.find(voice =>
            voice.lang.startsWith('es') && voice.name.includes('Google')
        ) || voices.find(voice => voice.lang.startsWith('es'));

        if (spanishVoice) {
            utterance.voice = spanishVoice;
        }

        utterance.onend = () => {
            setState('idle');
            setTranscript('');
            setResponse('');
        };

        utterance.onerror = (event) => {
            console.error('Speech synthesis error:', event);
            setState('idle');
        };

        synthRef.current.speak(utterance);
    };

    const handleQuery = async (text) => {
        if (!text) return;

        setTranscript(text);
        setResponse('');
        setError('');
        setState('thinking');

        // Cancelar cualquier discurso previo antes de iniciar nueva consulta
        if (synthRef.current) synthRef.current.cancel();

        try {
            // Query NotebookLM
            const aiResponse = await notebookLMClient.query(text);
            setResponse(aiResponse);
            setState('speaking');

            // Speak the response
            speakText(aiResponse);
        } catch (err) {
            setError(err.message || 'Hubo un error al procesar tu consulta. Por favor intenta de nuevo.');
            setState('idle');
        }
    };

    const stopListening = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        setVolume(0);
        setState('idle');
    };

    const startListening = async () => {
        if (!isSupported) return;

        setError('');
        setTranscript('');
        setResponse('');
        setState('listening');

        try {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.lang = 'es-ES';
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;

            recognitionRef.current.onresult = (event) => {
                const text = event.results[0][0].transcript;
                console.log('Result:', text);
                if (text) {
                    setTranscript(text);
                    handleQuery(text);
                }
            };

            recognitionRef.current.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                if (event.error === 'no-speech') {
                    // Ignorar
                } else {
                    setError('Error al escuchar. Intente nuevamente.');
                    setState('idle');
                }
            };

            recognitionRef.current.onend = () => {
                if (state === 'listening') {
                    setState('idle');
                }
            };

            // Audio Setup
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            analyserRef.current = audioContextRef.current.createAnalyser();
            const source = audioContextRef.current.createMediaStreamSource(stream);
            source.connect(analyserRef.current);
            analyserRef.current.fftSize = 256;

            const bufferLength = analyserRef.current.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const updateVolume = () => {
                if (analyserRef.current && audioContextRef.current.state === 'running') {
                    analyserRef.current.getByteFrequencyData(dataArray);
                    let sum = 0;
                    for (let i = 0; i < bufferLength; i++) {
                        sum += dataArray[i];
                    }
                    const average = sum / bufferLength;
                    setVolume(average * 2.5);
                    animationFrameRef.current = requestAnimationFrame(updateVolume);
                }
            };
            updateVolume();

            recognitionRef.current.start();
        } catch (err) {
            console.error('Error starting speech recognition:', err);
            setError('Error al iniciar el micrófono.');
            setState('idle');
        }
    };

    const getStateConfig = () => {
        switch (state) {
            case 'listening':
                return {
                    icon: '🎙️',
                    text: 'Escuchando...',
                    subtext: 'Por favor, hable ahora',
                    color: 'bg-green-600',
                    pulseColor: 'border-green-400',
                    showPulse: true
                };
            case 'thinking':
                return {
                    icon: '🧠',
                    text: 'Procesando...',
                    subtext: 'Consultando normativas y documentos internos...',
                    color: 'bg-primary-400',
                    pulseColor: 'border-white/50',
                    showPulse: true
                };
            case 'speaking':
                return {
                    icon: '🗣️',
                    text: 'Respondiendo...',
                    subtext: 'Favor de escuchar la información solicitada',
                    color: 'bg-primary-600',
                    pulseColor: 'border-white/50',
                    showPulse: true
                };
            default:
                return {
                    icon: '💬',
                    text: '¿En qué puedo asistirle hoy?',
                    subtext: 'Presione el botón para iniciar la consulta',
                    color: 'bg-primary-500',
                    pulseColor: 'border-white/30',
                    showPulse: false
                };
        }
    };

    const config = getStateConfig();

    if (!isActivated) {
        return (
            <div
                className="h-screen w-full flex flex-col items-center justify-center bg-[#0d1426] cursor-pointer overflow-hidden p-8"
                onClick={() => setIsActivated(true)}
            >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#1e293b_0%,_#0d1426_100%)]"></div>

                <div className="relative z-10 text-center space-y-8 animate-in fade-in zoom-in duration-1000">
                    <div className="scale-125 mb-12">
                        <NexusCore status="idle" volume={0} />
                    </div>

                    <div className="flex flex-col items-center gap-4 text-center">
                        <CompanyLogo size={320} className="mb-2" />
                        <h1 className="text-2xl font-light text-white/40 tracking-[0.8em] uppercase ml-[0.8em]">
                            Asistente <span className="text-primary-500 font-bold">RRHH</span>
                        </h1>
                    </div>

                    <div className="pt-12">
                        <div className="inline-flex items-center gap-3 px-8 py-4 bg-primary-500 rounded-full text-white font-bold text-lg animate-bounce shadow-2xl shadow-primary-500/20">
                            <span>COMENZAR CONSULTA</span>
                            <span className="text-2xl">➔</span>
                        </div>
                    </div>
                </div>

                <div className="absolute bottom-10 flex flex-col items-center gap-1 opacity-20 text-white text-[10px] tracking-[0.5em] uppercase text-center">
                    <span>Plastitec Intelligent Systems © 2026</span>
                    <span className="text-[8px] tracking-[0.3em] font-bold">Departamento de Desarrollo • Área de TI</span>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen w-full flex bg-[#0d1426] overflow-hidden text-white font-sans transition-all duration-1000 animate-in fade-in">
            {/* LADO IZQUIERDO: Interacción y Resultados (50%) */}
            <div className="w-1/2 h-full flex flex-col p-12 border-r border-white/5 relative z-20 glass-effect">
                <div className="flex flex-col h-full">
                    {/* Header con Logo Oficial */}
                    <div className="mb-12 flex justify-between items-center">
                        <div className="flex flex-col">
                            <CompanyLogo size={240} className="mb-1" />
                            <div className="flex items-center gap-2 mt-1 ml-0.5 opacity-60">
                                <span className="w-6 h-[1px] bg-primary-500"></span>
                                <span className="text-[9px] text-primary-300 uppercase tracking-[0.4em] font-bold">Asistente RRHH</span>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="p-3 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all group"
                            title="Información y Ejemplos"
                        >
                            <span className="text-xl group-hover:scale-110 transition-transform block">ℹ️</span>
                        </button>
                    </div>

                    {/* Contenido Principal */}
                    <div className="flex-grow flex flex-col justify-center space-y-8">
                        <div className="space-y-2">
                            <h2 className="text-3xl font-semibold text-primary-100 italic">{config.text}</h2>
                            <p className="text-lg text-primary-300 opacity-50">{config.subtext}</p>
                        </div>

                        {/* Botones de Control */}
                        <div className="flex items-center gap-8">
                            <button
                                onClick={state === 'listening' ? stopListening : startListening}
                                disabled={state === 'thinking' || state === 'speaking' || !isSupported}
                                className={`
                                    group relative w-32 h-32 rounded-full transition-all duration-500 transform active:scale-95 flex items-center justify-center
                                    ${state === 'listening' ? 'bg-red-500 scale-110 shadow-[0_0_50px_rgba(239,68,68,0.3)]' : 'bg-primary-500 hover:bg-primary-600 shadow-2xl shadow-primary-500/30'}
                                `}
                            >
                                <div className={`text-6xl ${state === 'listening' ? 'animate-pulse' : ''}`}>{config.icon}</div>
                                {state === 'listening' && (
                                    <div className="absolute inset-0 rounded-full border-4 border-white/30 animate-ping"></div>
                                )}
                            </button>

                            {state === 'listening' && (
                                <div className="flex-grow h-2 bg-white/10 rounded-full overflow-hidden max-w-[200px]">
                                    <div className="h-full bg-white transition-all duration-75 shadow-[0_0_20px_white]" style={{ width: `${Math.min(volume, 100)}%` }}></div>
                                </div>
                            )}
                        </div>

                        {/* Fallback de Texto Manual */}
                        <div className="w-full max-w-md mx-auto">
                            <input
                                type="text"
                                placeholder="⌨️ O escribe tu consulta aquí..."
                                className="w-full bg-white/5 border border-white/10 rounded-full py-3 px-6 text-white placeholder-white/30 focus:outline-none focus:bg-white/10 focus:border-primary-500 transition-all text-sm text-center"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                        handleQuery(e.currentTarget.value.trim());
                                        e.currentTarget.value = '';
                                    }
                                }}
                            />
                        </div>

                        {/* Área de Visualización de Texto */}
                        <div className="w-full space-y-6 overflow-y-auto custom-scrollbar pr-4 max-h-[40vh]">
                            {error && (
                                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl animate-shake">
                                    <p className="text-sm text-red-300">⚠️ {error}</p>
                                </div>
                            )}

                            {transcript && (
                                <div className="p-6 bg-white/5 rounded-2xl border border-white/5 animate-in slide-in-from-left-4">
                                    <span className="text-xs font-bold text-primary-400 uppercase block mb-2 tracking-widest">Tu consulta:</span>
                                    <p className="text-xl text-white font-light italic leading-relaxed">"{transcript}"</p>
                                </div>
                            )}

                            {response && (
                                <div className="p-8 bg-primary-600/10 rounded-3xl border border-primary-500/20 animate-in slide-in-from-left-8 duration-700">
                                    <span className="text-xs font-bold text-primary-200 uppercase block mb-3 tracking-widest italic">Respuesta de Michigan:</span>
                                    <p className="text-xl text-white leading-relaxed font-normal">{response}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer Minimalista */}
                    <div className="mt-auto pt-6 space-y-4">
                        <p className="text-sm text-white/60 text-center italic leading-tight px-4">
                            * Nota: La información es generada por inteligencia artificial y podría contener imprecisiones. Por favor, verifica los datos críticos directamente con el personal de RRHH.
                        </p>

                        <div className="opacity-20 text-[9px] uppercase tracking-[0.3em] flex justify-between items-center border-t border-white/5 pt-4">
                            <div className="flex flex-col gap-1">
                                <span>Oficina de Recursos Humanos</span>
                                <span className="font-bold tracking-wider text-[8px]">Departamento de Desarrollo • Área de TI</span>
                            </div>
                            <span>v0.0.0</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* LADO DERECHO: Mascota (50%) */}
            <div className="w-1/2 h-full flex flex-col items-center justify-center p-12 bg-gradient-to-br from-[#0d1426] via-[#1a2b4f] to-[#0d1426] relative overflow-hidden">
                {/* Fondo de rayos/tecnología */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] bg-[conic-gradient(from_0deg_at_50%_50%,_transparent_0deg,_#3b82f6_180deg,_transparent_360deg)] animate-spin-slow"></div>
                </div>

                <div className="relative z-10 scale-[1.2] transform translate-y-8">
                    <NexusCore status={state} volume={volume} />
                </div>

                {/* MODAL DE INFORMACIÓN */}
                <AnimatePresence>
                    {isModalOpen && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
                            onClick={() => setIsModalOpen(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.9, y: 20, opacity: 0 }}
                                animate={{ scale: 1, y: 0, opacity: 1 }}
                                exit={{ scale: 0.9, y: 20, opacity: 0 }}
                                className="bg-[#1a2b4f] border border-white/10 rounded-[2.5rem] p-10 max-w-2xl w-full shadow-2xl relative overflow-hidden"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Decoración de fondo del modal */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 blur-3xl rounded-full -mr-10 -mt-10"></div>

                                <div className="relative z-10">
                                    <div className="flex justify-between items-center mb-8">
                                        <h2 className="text-3xl font-bold text-white">Guía del Asistente</h2>
                                        <button
                                            onClick={() => setIsModalOpen(false)}
                                            className="text-white/40 hover:text-white transition-colors text-2xl"
                                        >✕</button>
                                    </div>

                                    <div className="space-y-8">
                                        <section>
                                            <h3 className="text-primary-400 font-bold uppercase tracking-widest text-xs mb-3 font-mono">¿Para qué sirve?</h3>
                                            <p className="text-white/80 leading-relaxed italic border-l-2 border-primary-500 pl-4">
                                                Este asistente inteligente está diseñado para ayudarte con consultas sobre normativas internas, beneficios, procedimientos y documentos del departamento de RRHH de Plastitec.
                                            </p>
                                        </section>

                                        <section>
                                            <h3 className="text-primary-400 font-bold uppercase tracking-widest text-xs mb-4 font-mono">Ejemplos de consulta</h3>
                                            <div className="grid grid-cols-1 gap-3">
                                                {[
                                                    "¿Cuáles son los requisitos para solicitar vacaciones?",
                                                    "¿Cómo funciona el seguro de gastos médicos?",
                                                    "¿Qué debo hacer en caso de un permiso por maternidad?",
                                                    "¿Dónde puedo consultar el calendario de días festivos?"
                                                ].map((example, i) => (
                                                    <div
                                                        key={i}
                                                        className="p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-3 group"
                                                        onClick={() => {
                                                            setIsModalOpen(false);
                                                            // Un pequeño delay para que visualmente se vea el cierre antes de que cambie el estado del core
                                                            setTimeout(() => {
                                                                handleQuery(example);
                                                            }, 300);
                                                        }}
                                                    >
                                                        <span className="text-primary-500 opacity-50 font-mono">0{i + 1}</span>
                                                        <span className="text-white/70 group-hover:text-white transition-colors">{example}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    </div>

                                    <div className="mt-10 pt-6 border-t border-white/10 text-center space-y-2">
                                        <p className="text-[10px] text-white/30 uppercase tracking-[0.3em]">Plastitec Human Resources Internal Support</p>
                                        <p className="text-[9px] text-primary-400/40 uppercase tracking-[0.15em] font-bold">Desarrollado por el Departamento de Desarrollo - Área de TI</p>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default VoiceChat;
