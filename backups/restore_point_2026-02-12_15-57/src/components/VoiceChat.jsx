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
    const ttsInProgressRef = useRef(false); // Control de rate limiting

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


    /**
     * 🎙️ WEB SPEECH API - SÍNTESIS DE VOZ OPTIMIZADA
     * Configuración optimizada para máxima fluidez y naturalidad
     */
    const speakText = async (text) => {
        // Prevenir múltiples solicitudes simultáneas
        if (ttsInProgressRef.current) {
            console.warn('⚠️ Ya hay una síntesis de voz en progreso.');
            return;
        }

        try {
            ttsInProgressRef.current = true;

            console.log('\n🎙️ ========================================');
            console.log('🚀 INICIANDO SÍNTESIS DE VOZ');
            console.log('   - Motor: Web Speech API (Navegador)');
            console.log('   - Texto:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
            console.log('========================================\n');

            // Cancelar cualquier síntesis en curso
            if (synthRef.current) {
                synthRef.current.cancel();
            }

            // Esperar un momento para asegurar que se canceló
            await new Promise(resolve => setTimeout(resolve, 100));

            // Crear utterance
            const utterance = new SpeechSynthesisUtterance(text);

            // Obtener voces disponibles
            const voices = synthRef.current.getVoices();

            // Buscar la mejor voz en español
            // Prioridad: 1) Español (México/US) 2) Español (España) 3) Cualquier español
            let selectedVoice = null;

            // Intentar encontrar voz en español latino (México o US)
            selectedVoice = voices.find(voice =>
                voice.lang.includes('es-MX') || voice.lang.includes('es-US')
            );

            // Si no hay, buscar español de España
            if (!selectedVoice) {
                selectedVoice = voices.find(voice => voice.lang.includes('es-ES'));
            }

            // Si no hay, buscar cualquier voz en español
            if (!selectedVoice) {
                selectedVoice = voices.find(voice => voice.lang.startsWith('es'));
            }

            // Configurar voz
            if (selectedVoice) {
                utterance.voice = selectedVoice;
                console.log(`✅ Voz seleccionada: ${selectedVoice.name} (${selectedVoice.lang})`);
            } else {
                console.warn('⚠️ No se encontró voz en español. Usando voz por defecto.');
            }

            // Configuración optimizada para fluidez y naturalidad
            utterance.rate = 1.0;    // Velocidad normal (0.1 a 10)
            utterance.pitch = 1.0;   // Tono normal (0 a 2)
            utterance.volume = 1.0;  // Volumen máximo (0 a 1)
            utterance.lang = selectedVoice ? selectedVoice.lang : 'es-ES';

            console.log('🔧 Configuración:');
            console.log(`   - Velocidad: ${utterance.rate} (normal)`);
            console.log(`   - Tono: ${utterance.pitch} (natural)`);
            console.log(`   - Volumen: ${utterance.volume} (máximo)`);
            console.log(`   - Idioma: ${utterance.lang}`);

            // Event handlers
            utterance.onstart = () => {
                console.log('\n🔊 ========================================');
                console.log('🎵 REPRODUCIENDO VOZ');
                console.log('   - Motor: Web Speech API');
                console.log('   - Voz:', utterance.voice ? utterance.voice.name : 'Por defecto');
                console.log('========================================\n');
            };

            utterance.onend = () => {
                console.log('✅ Reproducción completada exitosamente\n');
                ttsInProgressRef.current = false;
                setState('idle');
                setTranscript('');
                setResponse('');
            };

            utterance.onerror = (event) => {
                console.error('❌ Error en síntesis de voz:', event.error);
                ttsInProgressRef.current = false;
                setState('idle');
                setError('Error al generar la voz. Por favor intenta de nuevo.');
            };

            // Reproducir
            synthRef.current.speak(utterance);

        } catch (err) {
            console.error('\n❌ ========================================');
            console.error('ERROR EN SÍNTESIS DE VOZ:');
            console.error('   - Mensaje:', err.message);
            console.error('========================================\n');

            ttsInProgressRef.current = false;
            setState('idle');
            setError('❌ Error al generar voz. Por favor intenta de nuevo.');
        }
    };

    /**
     * � FALLBACK: Web Speech API
     * Se usa solo si OpenAI TTS falla
     */
    const fallbackToWebSpeech = (text) => {
        try {
            synthRef.current.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'es-ES';
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;

            const voices = synthRef.current.getVoices();
            const spanishVoice = voices.find(v => v.lang.startsWith('es') && v.name.includes('Neural')) ||
                voices.find(v => v.lang.startsWith('es'));

            if (spanishVoice) {
                utterance.voice = spanishVoice;
                console.log('�️ Fallback voice:', spanishVoice.name);
            }

            utterance.onend = () => {
                setState('idle');
                setTranscript('');
                setResponse('');
            };

            utterance.onerror = () => {
                setState('idle');
            };

            synthRef.current.speak(utterance);
        } catch (error) {
            console.error('❌ Fallback también falló:', error);
            setState('idle');
        }
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
            recognitionRef.current.interimResults = true; // Enable for faster visual feedback

            recognitionRef.current.onresult = (event) => {
                const result = event.results[0];
                const text = result[0].transcript;
                const isFinal = result.isFinal;

                console.log('Result:', text, 'Final:', isFinal);

                setTranscript(text);

                if (isFinal) {
                    recognitionRef.current.stop();
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
                    text: 'Te escucho...',
                    subtext: 'Habla ahora',
                    color: 'text-green-400',
                    borderColor: 'border-green-500/50',
                    bgGlow: 'shadow-[0_0_100px_rgba(74,222,128,0.2)]'
                };
            case 'thinking':
                return {
                    icon: '🧠',
                    text: 'Procesando...',
                    subtext: 'Analizando documentos...',
                    color: 'text-blue-400',
                    borderColor: 'border-blue-500/50',
                    bgGlow: 'shadow-[0_0_100px_rgba(96,165,250,0.2)]'
                };
            case 'speaking':
                return {
                    icon: '🗣️',
                    text: 'Respondiendo',
                    subtext: 'Escucha la respuesta',
                    color: 'text-purple-400',
                    borderColor: 'border-purple-500/50',
                    bgGlow: 'shadow-[0_0_100px_rgba(192,132,252,0.2)]'
                };
            default:
                return {
                    icon: '✨',
                    text: 'Bienvenido',
                    subtext: 'Toca el micrófono para comenzar',
                    color: 'text-white',
                    borderColor: 'border-white/10',
                    bgGlow: ''
                };
        }
    };

    const config = getStateConfig();

    if (!isActivated) {
        return (
            <div
                className="h-screen w-full flex flex-col items-center justify-center bg-[#0d1426] cursor-pointer overflow-hidden relative"
                onClick={() => setIsActivated(true)}
            >
                {/* Background Animation */}
                <div className="absolute inset-0 z-0">
                    <NexusCore status="idle" volume={0} />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0d1426] via-transparent to-[#0d1426]/80"></div>
                </div>

                <div className="relative z-10 text-center space-y-12 animate-in fade-in zoom-in duration-1000 p-8 bg-black/20 backdrop-blur-sm rounded-[3rem] border border-white/5 shadow-2xl">
                    <div className="flex flex-col items-center gap-6">
                        <CompanyLogo size={180} className="mb-4 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]" />

                        {/* Demo Badge */}
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-400/30 rounded-full backdrop-blur-sm">
                            <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
                            <span className="text-xs font-semibold text-yellow-300 tracking-wider uppercase">Versión Demo</span>
                        </div>

                        <div>
                            <h1 className="text-4xl font-light text-white tracking-[0.5em] uppercase">
                                Asistente <span className="font-bold text-blue-400">RRHH</span>
                            </h1>
                        </div>
                    </div>

                    <div>
                        <div className="inline-flex items-center gap-4 px-12 py-6 bg-white/5 border border-white/10 rounded-full text-white text-xl backdrop-blur-md hover:bg-white/10 transition-all group shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                            <span className="group-hover:tracking-widest transition-all duration-300">TOCAR PARA INICIAR</span>
                            <span className="text-2xl animate-pulse">👆</span>
                        </div>
                    </div>
                </div>

                <div className="absolute bottom-12 text-center space-y-2 opacity-40">
                    <p className="text-[10px] uppercase tracking-[0.4em] text-white">Plastitec - Tecnologia </p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen w-full bg-[#0d1426] overflow-hidden relative font-sans text-white">

            {/* 1. BACKGROUND LAYER (NexusCore Visuals) */}
            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-1000 ${response ? 'opacity-20 scale-150 blur-sm' : 'opacity-100 scale-100'}`}>
                <NexusCore status={state} volume={volume} />
            </div>

            {/* 2. OVERLAY CONTENT LAYER */}
            <div className="relative z-10 h-full flex flex-col p-6 md:p-12">

                {/* HEADER */}
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                        {/* Logo y Título */}
                        <div className="flex items-center gap-6 bg-black/30 backdrop-blur-md p-4 pr-8 rounded-full border border-white/5">
                            <CompanyLogo size={60} />
                            <div className="flex flex-col">
                                <span className="text-xs text-blue-300 font-bold tracking-[0.3em] uppercase">Asistente Virtual</span>
                                <span className="text-[10px] text-white/40 uppercase tracking-wider">Recursos Humanos</span>
                            </div>
                        </div>

                        {/* Demo Badge */}
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-400/30 rounded-full backdrop-blur-sm">
                            <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse"></span>
                            <span className="text-[10px] font-semibold text-yellow-300 tracking-wider uppercase">Demo</span>
                        </div>
                    </div>

                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="w-12 h-12 flex items-center justify-center bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-colors backdrop-blur-md"
                    >
                        ℹ️
                    </button>
                </div>

                {/* MAIN CENTRAL AREA - Adapts to content */}
                <div className="flex-grow flex flex-col items-center justify-center relative my-4">

                    {/* STATE INDICATOR (When no response yet) */}
                    {!response && (
                        <div className={`text-center space-y-4 transition-transform duration-500 will-change-transform ${state === 'listening' ? 'scale-110' : 'scale-100'}`}>
                            <div className={`text-6xl mb-4 ${state === 'thinking' ? 'animate-bounce' : ''}`}>
                                {config.icon}
                            </div>
                            <h2 className={`text-4xl font-light ${config.color}`}>{config.text}</h2>
                            <p className="text-white/40 text-lg tracking-wider">{config.subtext}</p>
                        </div>
                    )}

                    {/* RESPONSE CARD (Shows when there is a response) */}
                    <AnimatePresence>
                        {response && (
                            <motion.div
                                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="w-full max-w-5xl bg-[#1a2333]/90 backdrop-blur-xl border border-white/10 rounded-[3rem] p-10 md:p-14 shadow-2xl flex flex-col max-h-[65vh]"
                            >
                                {/* Scrollable Text Area */}
                                <div className="overflow-y-auto custom-scrollbar pr-6 space-y-6 flex-grow">
                                    <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest sticky top-0 bg-[#1a2333]/95 py-2 z-10">Respuesta:</h3>
                                    <div className="text-2xl md:text-3xl font-light leading-relaxed text-slate-100">
                                        {response}
                                    </div>
                                </div>

                                {/* Footer con Advertencia y Transcript */}
                                <div className="mt-8 pt-6 border-t border-white/5 flex flex-col gap-3">
                                    <div className="text-white/30 text-xs italic flex justify-between">
                                        <span>Tu consulta: "{transcript}"</span>
                                        <span>v1.0</span>
                                    </div>

                                    <div className="text-center">
                                        <p className="text-xs font-bold text-red-300/90 bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-lg inline-block">
                                            ⚠️ La respuesta por IA puede contener errores.
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* BOTTOM CONTROLS BAR */}
                <div className="w-full max-w-3xl mx-auto flex items-center gap-6 bg-black/40 backdrop-blur-lg border border-white/10 rounded-full p-3 pr-8 shadow-[0_10px_40px_rgba(0,0,0,0.3)]">

                    {/* Big Mic Button */}
                    <button
                        onClick={state === 'listening' ? stopListening : startListening}
                        className={`
                            w-20 h-20 rounded-full flex items-center justify-center text-3xl transition-all duration-300 border-4 border-[#0d1426]
                            ${state === 'listening'
                                ? 'bg-red-500 text-white shadow-[0_0_30px_rgba(239,68,68,0.5)] animate-pulse'
                                : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg'}
                        `}
                    >
                        {state === 'listening' ? '⏹' : '🎙️'}
                    </button>

                    {/* Manual Input */}
                    <div className="flex-grow">
                        <input
                            type="text"
                            placeholder="Escribe tu consulta aquí..."
                            disabled={state === 'listening'}
                            className="w-full bg-transparent border-none text-white text-lg placeholder-white/30 focus:ring-0 focus:outline-none px-4"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                    handleQuery(e.currentTarget.value.trim());
                                    e.currentTarget.value = '';
                                }
                            }}
                        />
                    </div>

                    {/* Send Icon */}
                    <div className="text-white/20 text-xl">↵</div>
                </div>

                {/* VISIBLE DISCLAIMER (Always visible) */}
                <div className="mt-6 text-center">
                    <p className="text-xs text-white/30 font-medium tracking-wide border-b border-white/5 pb-1 inline-block">
                        ⚠️ La respuesta por IA puede contener errores.
                    </p>
                </div>

            </div>

            {/* MODAL (Same as before, just z-index fix) */}
            <AnimatePresence>
                {isModalOpen && (
                    <motion.div
                        className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md"
                        onClick={() => setIsModalOpen(false)}
                    >
                        {/* Simplified Modal Content for Kiosk */}
                        <div className="bg-[#1e293b] rounded-[2rem] p-12 max-w-4xl w-full border border-white/10" onClick={e => e.stopPropagation()}>
                            <h2 className="text-4xl text-white mb-8">Ejemplos de Preguntas</h2>
                            <div className="grid grid-cols-2 gap-6">
                                {["Vacaciones", "Seguro Médico", "Horarios", "Permisos"].map((topic, i) => (
                                    <button
                                        key={i}
                                        onClick={() => { setIsModalOpen(false); handleQuery(topic); }}
                                        className="p-8 bg-white/5 hover:bg-white/10 rounded-2xl text-left text-2xl text-blue-200 transition-colors border border-white/5"
                                    >
                                        {topic}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default VoiceChat;
