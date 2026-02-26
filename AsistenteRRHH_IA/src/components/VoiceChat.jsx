import { useState, useEffect, useRef, useReducer } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import notebookLMClient from '../utils/notebookLMClient';
import IntentEngine from '../utils/NexusIntentEngine'; // Updated import
import logger from '../utils/logger';
import { API_BASE_URL } from '../utils/apiConfig';
import NexusCore from './NexusCore';
import CompanyLogo from './CompanyLogo';
import TypewriterText from './TypewriterText';
import AnalyticsDashboard from './AnalyticsDashboard';

const initialState = {
    appState: 'INIT', // INIT, IDLE, LISTENING, PROCESSING, RESPONDING, ERROR
    transcript: '',
    response: '',
    error: null,
    processingStep: 0, // 1: Recibiendo, 2: Analizando, 3: Generando
};

function chatReducer(state, action) {
    // Log for tablet debugging
    console.log(`[State Transition] ${state.appState} -> ${action.type}`, action.payload !== undefined ? action.payload : '');

    switch (action.type) {
        case 'SET_INIT':
            return { ...initialState, appState: 'INIT' };
        case 'START_LISTENING':
            return { ...state, appState: 'LISTENING', transcript: '', response: '', error: null };
        case 'UPDATE_TRANSCRIPT':
            return { ...state, transcript: action.payload };
        case 'START_PROCESSING':
            return { ...state, appState: 'PROCESSING', processingStep: 1, transcript: action.payload, error: null };
        case 'SET_PROCESSING_STEP':
            return { ...state, processingStep: action.payload };
        case 'SET_RESPONSE':
            return { ...state, response: action.payload, processingStep: 0 };
        case 'START_RESPONDING':
            return { ...state, appState: 'RESPONDING' };
        case 'SET_ERROR':
            return { ...state, appState: 'ERROR', error: action.payload, processingStep: 0 };
        case 'RESET_IDLE':
            // GUARD: Prevent premature reset if processing is active (WebKit fix)
            if (state.appState === 'PROCESSING' && !action.force) {
                console.warn('[Reducer] Guard: Blocked reset to IDLE because processing is active');
                return state;
            }
            return { ...state, appState: 'IDLE', processingStep: 0 };
        case 'CLEAR_RESPONSE':
            return { ...state, response: '', appState: 'IDLE' };
        case 'CLEAR_ERROR':
            return { ...state, error: null, appState: state.appState === 'ERROR' ? 'IDLE' : state.appState };
        default:
            return state;
    }
}

const VoiceChat = () => {
    const [state, dispatch] = useReducer(chatReducer, initialState);
    const { appState, transcript, response, error, processingStep } = state;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [timeLeft, setTimeLeft] = useState(25);

    // Analytics & Debug
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [performanceMetrics, setPerformanceMetrics] = useState(null);
    const secretClickRef = useRef(0);

    const handleSecretClick = (e) => {
        if (e) e.stopPropagation();
        secretClickRef.current += 1;

        // Vibration feedback for secret clicks if available
        if (navigator.vibrate) navigator.vibrate(20);

        if (secretClickRef.current >= 5) {
            // Opening in a new window/tab as requested
            window.open('/?dashboard=true', '_blank');
            secretClickRef.current = 0;
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
            audio.play().catch(() => { });
        }

        // Clear counter if not finished in 2 seconds
        if (secretClickRef.current === 1) {
            setTimeout(() => { secretClickRef.current = 0; }, 2500);
        }
    };

    const [isSupported, setIsSupported] = useState(true);
    const volume = useMotionValue(0);
    const visualizerScale = useTransform(volume, [0, 100], [1, 1.8]);
    const visualizerOpacity = useTransform(volume, [0, 20], [0, 0.4]);


    const recognitionRef = useRef(null);
    const synthRef = useRef(window.speechSynthesis);
    const streamRef = useRef(null);
    const ttsInProgressRef = useRef(false);
    const abortControllerRef = useRef(null);

    // Performance Tracking Refs
    const metricsRef = useRef({});

    // Mobile Optimizations
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordingTimeoutRef = useRef(null);
    const forceWebSpeechMode = useRef(false);
    const animationFrameRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const currentUtteranceRef = useRef(null);

    // stateRef: mirrors `appState` but is always up-to-date inside async callbacks
    const stateRef = useRef(appState);
    useEffect(() => { stateRef.current = appState; }, [appState]);

    // mountedRef: prevents setState calls after the component has been unmounted.
    const mountedRef = useRef(true);
    const isLocked = useRef(false); // Mutex lock to prevent duplicate queries or starts
    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    // Device detection
    const isMobileDevice = useRef((() => {
        const ua = navigator.userAgent;
        return /iPhone|iPad|iPod|Android|webOS/i.test(ua) || window.innerWidth <= 768;
    })());

    useEffect(() => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            setIsSupported(false);
            console.error('[VoiceChat] Navegador no soporta Web Speech API');
            return;
        }
        notebookLMClient.initialize();
        notebookLMClient.resetConversation(); // Clear cache on startup to avoid 'Sy' bug
        logger.startSession();
    }, []);


    // 🕰️ INACTIVITY & RESPONSE TIMER
    useEffect(() => {
        // Movement listeners: reset auto-close timer when user interacts
        const handleInteraction = () => {
            if (response && stateRef.current === 'IDLE') {
                setTimeLeft(25); // Reset timer on user interaction
            }
        };

        window.addEventListener('mousemove', handleInteraction);
        window.addEventListener('touchstart', handleInteraction);
        window.addEventListener('keydown', handleInteraction);

        return () => {
            window.removeEventListener('mousemove', handleInteraction);
            window.removeEventListener('touchstart', handleInteraction);
            window.removeEventListener('keydown', handleInteraction);
        };
    }, [response]);


    // Dedicated Response Auto-Close Timer
    useEffect(() => {
        let interval = null;
        if (response && appState === 'IDLE') {
            interval = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        dispatch({ type: 'CLEAR_RESPONSE' });
                        return 25;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            setTimeLeft(25); // Reset while speaking/thinking
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [response, appState]);

    // Cleanup tracks on unmount
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close();
            }
        };
    }, []);

    const speakText = async (text) => {
        if (!synthRef.current) return;
        synthRef.current.cancel();

        // 🧹 Limpiar texto para una voz más fluida
        const cleanText = text
            .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '') // Emojis
            .replace(/[#*`_~|]/g, '') // Símbolos Markdown
            .replace(/[-•]/g, ' ') // Guiones y viñetas por pausas suaves
            .replace(/\s+/g, ' ') // Espacios múltiples
            .trim();

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'es-MX';

        // Ajustes para mayor fluidez y naturalidad
        utterance.rate = 1.05; // Un toque más rápido para que suene menos robótico
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        utterance.onstart = () => {
            ttsInProgressRef.current = true;
            dispatch({ type: 'START_RESPONDING' });
        };
        utterance.onend = () => {
            ttsInProgressRef.current = false;
            dispatch({ type: 'RESET_IDLE' });
        };
        utterance.onerror = () => {
            ttsInProgressRef.current = false;
            dispatch({ type: 'RESET_IDLE' });
        };

        // Intentar seleccionar la mejor voz en español si está disponible
        const voices = synthRef.current.getVoices();
        const preferredVoice = voices.find(v => v.lang.includes('es-MX') && v.name.includes('Google')) ||
            voices.find(v => v.lang.includes('es')) ||
            voices[0];
        if (preferredVoice) utterance.voice = preferredVoice;

        // Chrome bug: store in ref to prevent GC
        currentUtteranceRef.current = utterance;
        synthRef.current.speak(utterance);
    };

    const handleQuery = async (queryText) => {
        if (!queryText || queryText.trim().length < 2) return;

        // GHOSTING PROTECTION: Prevent multiple simultaneous queries
        if (isLocked.current) {
            console.warn(`[VoiceChat] Ignored concurrent query - Lock active: "${queryText}"`);
            return;
        }
        isLocked.current = true;

        const qStart = performance.now();
        console.log(`[Timing] 0ms — handleQuery started: "${queryText}"`);

        // Telemetry
        logger.startConversation(queryText);
        logger.endPhase('transcription');
        logger.startPhase('backend');

        // FORCE PROCESSING STATE IMMEDIATELY (Critical to prevent onend race condition)
        dispatch({ type: 'START_PROCESSING', payload: queryText });

        // Timers para cambios de estado dinámicos (basados en tiempos promedio observados)
        const step2Timer = setTimeout(() => dispatch({ type: 'SET_PROCESSING_STEP', payload: 2 }), 800);  // Analizando
        const step3Timer = setTimeout(() => dispatch({ type: 'SET_PROCESSING_STEP', payload: 3 }), 3500); // Generando

        try {
            abortControllerRef.current = new AbortController();
            console.log(`[Timing] ${(performance.now() - qStart).toFixed(0)}ms — sending to backend`);
            const result = await notebookLMClient.query(queryText, {
                signal: abortControllerRef.current.signal
            });
            console.log(`[Timing] ${(performance.now() - qStart).toFixed(0)}ms — backend responded`);

            if (!mountedRef.current) return;

            let finalResult = result.trim();

            // 🛡️ ANTI-CHAR-REMOVAL PROTECTION (Force restore common keywords)
            if (finalResult.toLowerCase() === 'sy') finalResult = 'Soy';
            if (finalResult.toLowerCase().startsWith('sy ')) finalResult = 'Soy ' + finalResult.substring(3);
            if (finalResult.toLowerCase().startsWith('sy, ')) finalResult = 'Soy, ' + finalResult.substring(4);
            if (finalResult.toLowerCase() === 'ete') finalResult = 'Este';
            if (finalResult.toLowerCase().startsWith('ete ')) finalResult = 'Este ' + finalResult.substring(4);
            if (finalResult.toLowerCase().startsWith('te ')) finalResult = 'Este ' + finalResult.substring(3);
            if (finalResult.toLowerCase().startsWith('soy ') && !finalResult.startsWith('Soy')) finalResult = 'Soy' + finalResult.substring(3);
            if (finalResult.toLowerCase().startsWith('este ') && !finalResult.startsWith('Este')) finalResult = 'Este' + finalResult.substring(4);

            const qLatency = Math.round(performance.now() - qStart);
            logger.endPhase('backend');

            // Find source (local vs remote)
            const isLocal = finalResult.includes('[Local') || finalResult.includes('Resuelto localmente');

            setPerformanceMetrics({
                micMs: logger.timers.phases['transcription'] || 0,
                recMs: 0,
                transMs: 0,
                aiMs: qLatency,
                totalMs: Math.round(performance.now() - logger.timers.total)
            });

            await logger.logConversation({
                query: queryText,
                status: 'success',
                source: isLocal ? 'local' : 'remote'
            });

            dispatch({ type: 'SET_RESPONSE', payload: finalResult });
            // State will be set to RESPONDING by speakText -> utterance.onstart
            speakText(finalResult);
            console.log(`[VoiceChat] ✅ Respuesta recibida en ${qLatency}ms`);

        } catch (err) {
            if (err.name === 'AbortError') return;

            // Report to structured logger
            logger.logError(
                err.name === 'TimeoutError' ? 'TIMEOUT_ERROR' : 'BACKEND_ERROR',
                'handleQuery',
                err.message,
                err.stack,
                { query: queryText }
            );

            dispatch({ type: 'SET_ERROR', payload: err.message || 'Error al procesar solicitud' });
        } finally {
            clearTimeout(step2Timer);
            clearTimeout(step3Timer);
            isLocked.current = false; // 🔓 UNLOCK AFTER ALL IS DONE
        }
    };

    const stopAnims = () => {
        if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        volume.set(0);
    };

    const startRecording = async () => {
        // Esta función ahora solo se encarga de cambiar el estado visual y preparar la escucha nativa
        startListening();
    };

    const startListening = (isRetry = false) => {
        if (!isSupported) return;

        // 🔒 LOCK CHECK
        if (isLocked.current && !isRetry) {
            console.warn('[VoiceChat] startListening blocked by lock');
            return;
        }

        if (stateRef.current !== 'IDLE' && !isRetry) {
            console.warn('[VoiceChat] startListening blocked: state not idle');
            return;
        }

        if (synthRef.current) synthRef.current.cancel();
        dispatch({ type: 'START_LISTENING' });

        // 1. Manejo de Conflicto de Hardware (Especialmente para Safari/iOS)
        // Forzamos la liberación del micro ANTES de empezar el reconocimiento en móviles
        // para asegurar que el motor nativo tenga acceso exclusivo.
        if (isMobileDevice.current && streamRef.current) {
            console.log('[Mic] Mobile detected: Proactively releasing visualizer stream for recognition');
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }

        // Si es un reintento (aunque no sea móvil), detenemos el stream por seguridad
        if (isRetry && streamRef.current) {
            console.log('[Mic] Retry detected: Releasing visualizer stream to avoid hardware conflict');
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }

        // 2. Reiniciar visualizador si el stream está vivo (feedback de volumen)
        if (analyserRef.current && streamRef.current) {
            const bufferLength = analyserRef.current.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const updateVol = () => {
                if (analyserRef.current && stateRef.current === 'LISTENING' && streamRef.current) {
                    analyserRef.current.getByteFrequencyData(dataArray);
                    let sum = 0;
                    for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
                    volume.set((sum / bufferLength) * 1.5);
                    animationFrameRef.current = requestAnimationFrame(updateVol);
                }
            };
            updateVol();
        } else if (stateRef.current === 'LISTENING' || stateRef.current === 'RESPONDING') {
            // FALLBACK: Animación de pulso si no hay stream (Modo Bajo Conflicto o Habla IA)
            let phase = 0;
            const pulseVol = () => {
                if ((stateRef.current === 'LISTENING' || stateRef.current === 'RESPONDING') && !streamRef.current) {
                    phase += 0.1;
                    const val = 15 + Math.sin(phase) * 10;
                    volume.set(val);
                    animationFrameRef.current = requestAnimationFrame(pulseVol);
                }
            };
            pulseVol();
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            dispatch({ type: 'SET_ERROR', payload: 'Tu navegador no soporta reconocimiento de voz nativo.' });
            return;
        }

        if (recognitionRef.current) {
            try {
                recognitionRef.current.onresult = null;
                recognitionRef.current.onend = null;
                recognitionRef.current.onerror = null;
                recognitionRef.current.abort();
            } catch (e) { /* ignore */ }
        }

        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.lang = 'es-MX';
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.maxAlternatives = 1;

        console.log(`[Mic] Recognition start (isRetry: ${isRetry})`);
        logger.startPhase('transcription');

        recognitionRef.current.onresult = (e) => {
            const last = e.results.length - 1;
            const text = e.results[last][0].transcript;
            const isFinal = e.results[last].isFinal;

            if (isFinal) {
                console.log('[Mic] Final transcription:', text);
                // 🛑 IMMEDIATE STOP TO PREVENT DUPLICATES
                recognitionRef.current.stop();
                handleQuery(text);
            } else {
                dispatch({ type: 'UPDATE_TRANSCRIPT', payload: text });
            }
        };

        recognitionRef.current.onerror = async (e) => {
            console.error('[Mic] Native Recognition Error:', e.error);

            if (!mountedRef.current) return;

            // 3. Lógica de Reintento Silencioso para errores comunes en Mobile
            if ((e.error === 'audio-capture' || e.error === 'no-speech') && !isRetry) {
                console.log(`[Mic] Attempting silent retry for error: ${e.error}`);
                recognitionRef.current.stop();
                // Breve pausa para que el sistema operativo libere el hardware
                await new Promise(r => setTimeout(r, 300));
                startListening(true);
                return;
            }

            if (e.error !== 'no-speech') {
                dispatch({ type: 'SET_ERROR', payload: `Reconocimiento: ${e.error}` });
                logger.logError('VOICE_ERROR', 'NativeSpeech', e.error, null, {
                    phase: 'NativeRecognition',
                    isRetry,
                    errorDetails: e.message || 'No details'
                });
            }
            dispatch({ type: 'RESET_IDLE' });
        };

        recognitionRef.current.onend = () => {
            console.log('[Mic] Recognition session ended');
            // GUARD: Only reset to IDLE if there's no query processing or lock active
            if (stateRef.current === 'LISTENING' && !isLocked.current && mountedRef.current) {
                console.log('[Mic] Safe to reset to IDLE');
                dispatch({ type: 'RESET_IDLE' });
                stopAnims();
            } else {
                console.log('[Mic] Blocked reset to IDLE - Logic in transition or processing');
            }
        };

        try {
            recognitionRef.current.start();
        } catch (e) {
            console.error('[Mic] Critical start failure:', e);
            if (!isRetry) startListening(true);
            else dispatch({ type: 'RESET_IDLE' });
        }
    };

    const stopListening = () => {
        if (recognitionRef.current) recognitionRef.current.stop();
        stopAnims();
        if (abortControllerRef.current) abortControllerRef.current.abort();
        dispatch({ type: 'RESET_IDLE', force: true });
    };

    const reportError = (...args) => logger.logError(...args);

    const getStateConfig = () => {
        switch (appState) {
            case 'LISTENING': return { icon: '🎙️', text: 'Te escucho...', subtext: 'Habla ahora', color: 'text-green-400' };
            case 'PROCESSING':
                // Sub-estados dinámicos durante el procesamiento
                let stepText = 'Procesando...';
                if (processingStep === 1) stepText = 'Recibiendo solicitud...';
                if (processingStep === 2) stepText = 'Analizando información...';
                if (processingStep === 3) stepText = 'Generando respuesta...';
                return { icon: '🧠', text: stepText, subtext: 'Buscando respuesta...', color: 'text-blue-400' };
            case 'RESPONDING': return { icon: '🗣️', text: 'Respondiendo', subtext: 'Escucha con atención', color: 'text-purple-400' };
            case 'ERROR': return { icon: '⚠️', text: 'Error', subtext: 'Algo salió mal', color: 'text-red-400' };
            default: return { icon: '✨', text: 'Bienvenido', subtext: 'Toca el micrófono para comenzar', color: 'text-white' };
        }
    };

    const config = getStateConfig();

    const activateApp = async () => {
        console.log('🚀 Activating app via direct user interaction...');

        try {
            // 1. Solicitar permisos DIRECTAMENTE en el evento de click
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            if (!stream || stream.getAudioTracks().length === 0) {
                throw new Error('No se detectaron pistas de audio');
            }

            const track = stream.getAudioTracks()[0];

            // 2. Validar que el hardware esté realmente 'live'
            // Esperamos un momento para estabilización en tablets
            await new Promise(r => setTimeout(r, 100));

            if (track.readyState !== 'live') {
                throw new Error(`Estado de hardware inconsistente: ${track.readyState}`);
            }

            console.log('✅ Microfono validado y activo');

            // 3. Persistir el stream y configurar el AudioContext de una vez
            streamRef.current = stream;
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            analyserRef.current = audioContextRef.current.createAnalyser();
            const source = audioContextRef.current.createMediaStreamSource(stream);
            source.connect(analyserRef.current);
            analyserRef.current.fftSize = 128;

            // 4. Solo tras éxito total, cambiar de vista
            dispatch({ type: 'RESET_IDLE', force: true });

        } catch (e) {
            console.error('[Mic] Error crítico en activación:', e.message);
            reportError('Mic', 'activateApp', e.message, e.stack, {
                phase: 'CriticalActivation',
                errorName: e.name,
                isSecure: window.isSecureContext
            });

            // Si falla, al menos dejamos entrar para escritura manual
            dispatch({ type: 'SET_ERROR', payload: 'No pudimos activar el micrófono. Usando modo teclado.' });
        }
    };

    if (appState === 'INIT') {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#0d1426] cursor-pointer overflow-hidden transition-all duration-500" onClick={activateApp}>
                <div className="absolute inset-0 z-0 opacity-40">
                    <NexusCore status="idle" volume={0} />
                </div>
                <div className="relative z-10 text-center space-y-8 glass-effect p-12 rounded-[3.5rem] border border-white/10 shadow-3xl max-w-lg w-full">
                    <div onClick={handleSecretClick} className="cursor-pointer active:scale-95 transition-transform mb-4">
                        <CompanyLogo size={180} />
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-4xl font-light text-white tracking-[0.4em] uppercase">Asistente <span className="font-bold text-blue-400">RRHH IA</span></h1>
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-yellow-500/10 border border-yellow-400/30 rounded-full">
                            <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
                            <span className="text-[10px] font-bold text-yellow-300 tracking-widest uppercase">Versión Demo</span>
                        </div>
                    </div>

                    <div className="mt-12 px-10 py-6 bg-gradient-to-r from-blue-600 to-blue-500 rounded-full text-white text-xl font-bold shadow-[0_0_30px_rgba(37,99,235,0.4)] hover:shadow-[0_0_40px_rgba(37,99,235,0.6)] transition-all animate-pulse">
                        TOCAR PARA INICIAR 👆
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen w-full bg-[#0d1426] overflow-hidden relative font-sans text-white">
            {/* Visualizer Background */}
            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-1000 ${response ? 'opacity-10 scale-150' : 'opacity-30 scale-100'}`}>
                <NexusCore status={appState.toLowerCase()} volume={volume} />
            </div>

            <div className="relative z-10 h-full flex flex-col p-6 md:p-12">
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4 bg-black/40 backdrop-blur-2xl p-3 pr-8 rounded-full border border-white/10 shadow-2xl">
                        <div onClick={handleSecretClick} className="cursor-pointer active:scale-95 transition-transform">
                            <CompanyLogo className="w-12 h-12" />
                        </div>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-blue-300 font-bold uppercase tracking-wider">Asistente RRHH IA</span>
                                <span className="px-1.5 py-0.5 bg-yellow-500/20 border border-yellow-500/40 rounded text-[8px] text-yellow-400 font-bold">DEMO</span>
                            </div>
                            <span className="text-[10px] text-white/40 uppercase tracking-widest"></span>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="w-12 h-12 flex items-center justify-center bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all text-xl shadow-lg"
                    >
                        ℹ️
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="flex-grow flex flex-col items-center justify-center relative">
                    {!response ? (
                        <div className="text-center space-y-8 animate-in fade-in zoom-in duration-700">
                            <motion.div
                                animate={appState === 'LISTENING' ? { scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] } : {}}
                                transition={{ repeat: Infinity, duration: 1.5 }}
                                className="text-8xl mb-6 drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                            >
                                {config.icon}
                            </motion.div>
                            <h2 className={`text-6xl font-light mb-2 transition-colors duration-500 ${config.color}`}>{config.text}</h2>
                            <p className="text-white/40 text-2xl tracking-[0.2em] font-light">{config.subtext}</p>
                        </div>
                    ) : (
                        <>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 50 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                className="w-full max-w-5xl bg-[#1a2333]/90 backdrop-blur-3xl border border-white/10 rounded-[3.5rem] p-12 shadow-3xl relative overflow-hidden flex flex-col max-h-[75vh]"
                            >
                                {/* Progress Bar */}
                                <div className="absolute top-0 left-0 w-full h-1.5 bg-white/5">
                                    <motion.div className="h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)]" animate={{ width: `${(timeLeft / 25) * 100}%` }} transition={{ ease: "linear", duration: 1 }} />
                                </div>

                                <div className="overflow-y-auto custom-scrollbar flex-grow pr-6">
                                    <h3 className="text-blue-400 text-sm font-bold uppercase tracking-[0.3em] mb-8 sticky top-0 bg-[#1a2333]/80 backdrop-blur-md py-4 z-20 border-b border-white/5">Respuesta del Asistente</h3>
                                    <div className="text-2xl md:text-4xl font-light leading-relaxed text-slate-100 whitespace-pre-wrap pb-12">
                                        <TypewriterText text={response} speed={18} />
                                    </div>
                                </div>

                                <div className="mt-8 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-6 bg-transparent">
                                    <div className="text-white/30 text-xs italic truncate w-full md:max-w-[50%] bg-black/20 px-4 py-2 rounded-lg border border-white/5 capitalize">
                                        "{transcript}"
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (synthRef.current) synthRef.current.cancel();
                                            dispatch({ type: 'CLEAR_RESPONSE' });
                                        }}
                                        className="px-10 py-4 bg-white/10 hover:bg-white/20 active:scale-95 rounded-full text-white font-bold transition-all border border-white/10 flex items-center gap-3 shadow-xl group whitespace-nowrap"
                                    >
                                        <span>Entendido</span>
                                        <span className="bg-blue-600/40 px-3 py-1 rounded-full text-xs font-mono group-hover:bg-blue-600/60 transition-colors">{timeLeft}s</span>
                                    </button>
                                </div>




                            </motion.div>

                            {/* IA Disclaimer Section - Moved OUTSIDE the main response box */}
                            <div className="mt-6 p-4 bg-blue-500/5 backdrop-blur-md border border-white/5 rounded-2xl flex items-center gap-4 w-full max-w-2xl animate-in fade-in slide-in-from-bottom duration-700">
                                <div className="w-8 h-8 flex-shrink-0 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-400 text-xs shadow-inner">
                                    ℹ️
                                </div>
                                <p className="text-[11px] leading-relaxed text-blue-100/40 uppercase tracking-widest font-medium">
                                    La respuesta generada por la IA puede contener imprecisiones. Por favor, valide la información crítica.
                                </p>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="mt-auto w-full max-w-4xl mx-auto space-y-6">
                    <div className="bg-black/60 backdrop-blur-3xl border border-white/10 rounded-full p-4 shadow-3xl flex items-center gap-6 group hover:border-white/20 transition-all">
                        <button
                            onClick={() => appState === 'LISTENING' ? stopListening() : startListening()}
                            disabled={appState === 'PROCESSING'}
                            className={`relative w-24 h-24 rounded-full flex items-center justify-center text-4xl transition-all duration-500 shadow-2xl active:scale-90 flex-shrink-0 z-30 ${appState === 'LISTENING' ? 'bg-red-500 scale-110' : 'bg-blue-600 hover:bg-blue-500 hover:shadow-blue-500/50'}`}
                        >
                            <span className="relative z-10">{appState === 'LISTENING' ? '⏹' : '🎙️'}</span>
                            {appState === 'LISTENING' && (
                                <>
                                    <motion.div className="absolute inset-0 bg-red-400 rounded-full animate-ping opacity-20" />
                                    <motion.div
                                        className="absolute -inset-3 border-2 border-green-400 rounded-full pointer-events-none"
                                        style={{ scale: visualizerScale, opacity: visualizerOpacity }}
                                    />
                                </>
                            )}
                        </button>

                        <div className="flex-grow">
                            <input
                                id="manualInput"
                                type="text"
                                placeholder="Escribe tu consulta aquí..."
                                disabled={appState === 'LISTENING' || appState === 'PROCESSING'}
                                className="w-full bg-transparent border-none text-white text-2xl placeholder-white/15 focus:ring-0 px-2"
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && e.target.value.trim()) {
                                        handleQuery(e.target.value);
                                        e.target.value = '';
                                    }
                                }}
                            />
                        </div>

                        <button
                            onClick={() => {
                                const input = document.getElementById('manualInput');
                                if (input && input.value.trim()) {
                                    handleQuery(input.value);
                                    input.value = '';
                                }
                            }}
                            disabled={appState === 'PROCESSING'}
                            className={`bg-white/5 hover:bg-white/15 active:scale-95 p-6 rounded-full transition-all mr-2 shadow-inner group-hover:bg-blue-600/20 ${appState === 'PROCESSING' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <span className={`text-2xl ${appState === 'PROCESSING' ? 'text-white/20' : 'text-white/50 group-hover:text-blue-400'} transition-colors`}>➤</span>
                        </button>
                    </div>

                    {/* Latency Dashboard (Secret Mode) */}
                    <AnimatePresence>
                        {showAnalytics && performanceMetrics && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 20 }}
                                className="p-8 bg-[#1a2333]/95 backdrop-blur-3xl border border-blue-400/20 rounded-[2.5rem] shadow-4xl font-mono"
                            >
                                <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                                    <h4 className="text-blue-300 font-bold flex items-center gap-3 text-sm">
                                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                                        CONSOLA DE ADMINISTRACIÓN <span className="text-blue-500/30 text-[10px] ml-2 font-light">SISTEMA INTEGRAL v1.2</span>
                                    </h4>
                                    <button onClick={() => setShowAnalytics(false)} className="text-white/20 hover:text-red-400 transition-colors px-3 py-1 bg-white/5 rounded text-[10px]">CERRAR</button>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
                                    <div className="flex flex-col border-l-2 border-blue-500/30 pl-4 py-2">
                                        <span className="text-white/30 text-[10px] mb-2 uppercase tracking-tighter">Mic Activo</span>
                                        <span className="text-white text-lg font-black">{performanceMetrics.micMs}ms</span>
                                    </div>
                                    <div className="flex flex-col border-l-2 border-yellow-500/30 pl-4 py-2">
                                        <span className="text-white/30 text-[10px] mb-2 uppercase tracking-tighter">Grabación</span>
                                        <span className="text-white text-lg font-black">{performanceMetrics.recMs}ms</span>
                                    </div>
                                    <div className="flex flex-col border-l-2 border-green-500/30 pl-4 py-2">
                                        <span className="text-white/30 text-[10px] mb-2 uppercase tracking-tighter">Transcripción</span>
                                        <span className="text-white text-lg font-black">{performanceMetrics.transMs}ms</span>
                                    </div>
                                    <div className="flex flex-col border-l-2 border-purple-500/30 pl-4 py-2">
                                        <span className="text-white/30 text-[10px] mb-2 uppercase tracking-tighter">NotebookLM</span>
                                        <span className="text-white text-lg font-black">Online IA</span>
                                    </div>
                                    <div className="flex flex-col border-l-2 border-blue-400 pl-4 py-2 bg-blue-500/5 rounded-r-2xl border-y border-r border-blue-500/10 shadow-inner">
                                        <span className="text-blue-300 text-[10px] mb-2 font-bold uppercase tracking-widest">TOTAL E2E</span>
                                        <span className="text-white text-xl font-black">{performanceMetrics.totalMs}ms</span>
                                    </div>
                                </div>
                                <div className="mt-6 flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                                    <button className="bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg text-[9px] text-white/40 border border-white/5 whitespace-nowrap">STATUS: BACKEND ONLINE</button>
                                    <button className="bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg text-[9px] text-white/40 border border-white/5 whitespace-nowrap">MODEL: WHISPER-1</button>
                                    <button className="bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg text-[9px] text-white/40 border border-white/5 whitespace-nowrap">MEM: {Math.round(performance.memory?.usedJSHeapSize / 1024 / 1024 || 0)}MB</button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Notifications */}
            <AnimatePresence>
                {error && (
                    <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="fixed bottom-36 left-0 w-full flex justify-center z-[100] px-6">
                        <div className="bg-red-500/95 backdrop-blur-2xl text-white px-10 py-4 rounded-full shadow-4xl border border-red-400/40 flex items-center gap-4">
                            <span className="text-xl">⚠️</span>
                            <span className="font-bold tracking-wide">{error}</span>
                            <button onClick={() => dispatch({ type: 'CLEAR_ERROR' })} className="ml-6 bg-white/10 px-3 py-1 rounded-full hover:bg-white/20 transition-colors">✕</button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Help/Examples Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl"
                        onClick={() => setIsModalOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }}
                            className="bg-[#1a2333]/90 border border-white/10 rounded-[3rem] p-12 max-w-4xl w-full shadow-4xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <h2 className="text-4xl text-white mb-10 font-light tracking-tight text-center">Temas de Consulta Frecuentes</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {[
                                    { t: "Vacaciones y Días Libres", s: "¿Cuántos días tengo y cómo los pido?" },
                                    { t: "Seguro de Gastos Médicos", s: "Cobertura y red de hospitales." },
                                    { t: "Horarios y Turnos", s: "Flexibilidad y entrada/salida." },
                                    { t: "Caja de Ahorro", s: "Préstamos y rendimientos." }
                                ].map((topic, i) => (
                                    <button
                                        key={i}
                                        onClick={() => { setIsModalOpen(false); handleQuery(topic.t); }}
                                        className="group p-8 bg-white/5 hover:bg-blue-600/20 active:scale-95 rounded-3xl text-left transition-all border border-white/10 hover:border-blue-500/30"
                                    >
                                        <div className="text-2xl text-blue-200 group-hover:text-blue-400 font-bold mb-2 transition-colors">{topic.t}</div>
                                        <div className="text-white/40 text-sm group-hover:text-white/60 transition-colors">{topic.s}</div>
                                    </button>
                                ))}
                            </div>
                            <div className="mt-12 text-center">
                                <button onClick={() => setIsModalOpen(false)} className="px-12 py-4 bg-white/5 hover:bg-white/10 rounded-full text-white/60 transition-colors">Cerrar</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
};

export default VoiceChat;
