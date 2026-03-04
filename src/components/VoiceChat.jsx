import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import notebookLMClient from '../utils/notebookLMClient';
import IntentEngine from '../utils/NexusIntentEngine'; // Updated import
import { API_BASE_URL } from '../utils/apiConfig';
import NexusCore from './NexusCore';
import CompanyLogo from './CompanyLogo';
import TypewriterText from './TypewriterText';
import AnalyticsDashboard from './AnalyticsDashboard';

const VoiceChat = () => {
    const [appState, setAppState] = useState('INIT'); // INIT, IDLE, LISTENING, PROCESSING, RESPONDING, ERROR
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [response, setResponse] = useState('');
    const [error, setError] = useState(null);
    const [timeLeft, setTimeLeft] = useState(25);
    const [processingStep, setProcessingStep] = useState(0); // 1: Recibiendo, 2: Analizando, 3: Generando

    // Analytics & Debug
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [performanceMetrics, setPerformanceMetrics] = useState(null);
    const [showPinModal, setShowPinModal] = useState(false);
    const secretClickRef = useRef(0);

    const handleSecretClick = (e) => {
        if (e) e.stopPropagation();
        secretClickRef.current += 1;

        // Vibration feedback for secret clicks if available
        if (navigator.vibrate) navigator.vibrate(20);

        if (secretClickRef.current >= 5) {
            setShowPinModal(true);
            secretClickRef.current = 0;
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
            audio.play().catch(() => { });
        }

        // Clear counter if not finished in 2.5 seconds
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

    // Tablet/Kiosk Detection: Large touch device (>= 768px + Touch support)
    const isTabletOrKiosk = useRef((() => {
        const hasTouch = navigator.maxTouchPoints > 0;
        const isLargeScreen = window.innerWidth >= 768;
        return hasTouch && isLargeScreen;
    })());

    useEffect(() => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            setIsSupported(false);
            console.error('[VoiceChat] Navegador no soporta Web Speech API');
            return;
        }
        notebookLMClient.initialize();
        notebookLMClient.resetConversation(); // Clear cache on startup to avoid 'Sy' bug
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
                        setResponse('');
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
            setAppState('RESPONDING');
        };
        utterance.onend = () => {
            ttsInProgressRef.current = false;
            setAppState(prev => prev === 'RESPONDING' ? 'IDLE' : prev);
        };
        utterance.onerror = () => {
            ttsInProgressRef.current = false;
            setAppState(prev => prev === 'RESPONDING' ? 'IDLE' : prev);
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

        // FORCE PROCESSING STATE IMMEDIATELY (Critical to prevent onend race condition)
        setAppState('PROCESSING');
        setProcessingStep(1); // Paso 1: Recibiendo solicitud
        setError(null);
        setTranscript(queryText);

        // Timers para cambios de estado dinámicos (basados en tiempos promedio observados)
        const step2Timer = setTimeout(() => setProcessingStep(2), 800);  // Analizando
        const step3Timer = setTimeout(() => setProcessingStep(3), 3500); // Generando

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

            const qLatency = (performance.now() - qStart).toFixed(0);

            // Metrics update
            const total = metricsRef.current.trigger ? (performance.now() - metricsRef.current.trigger).toFixed(0) : qLatency;
            setPerformanceMetrics({
                micMs: metricsRef.current.micMs || 0,
                recMs: metricsRef.current.recMs || 0,
                transMs: metricsRef.current.transMs || 0,
                aiMs: qLatency,
                totalMs: total
            });

            setResponse(finalResult);
            // State will be set to RESPONDING by speakText -> utterance.onstart
            speakText(finalResult);
            console.log(`[VoiceChat] ✅ Respuesta recibida en ${qLatency}ms`);

        } catch (err) {
            if (err.name === 'AbortError') return;

            // Report to backend
            reportError('IA', 'handleQuery', err.message, err.stack, { query: queryText });

            setError(err.message || 'Error al procesar solicitud');
            setAppState('IDLE');
        } finally {
            clearTimeout(step2Timer);
            clearTimeout(step3Timer);
            setProcessingStep(0);
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

    const startListening = (isRetry = false, fromAutoActivate = false) => {
        if (!isSupported) return;

        // 🔒 LOCK CHECK
        if (isLocked.current && !isRetry) {
            console.warn('[VoiceChat] startListening blocked by lock');
            return;
        }

        // Allow bypassing IDLE check if we are transitioning from INIT (auto-activate)
        if (stateRef.current !== 'IDLE' && !isRetry && !fromAutoActivate) {
            console.warn(`[VoiceChat] startListening blocked: state not idle (current: ${stateRef.current})`);
            return;
        }

        if (synthRef.current) synthRef.current.cancel();
        setError(null);
        setTranscript('');
        setResponse('');
        setAppState('LISTENING');

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
            setError('Tu navegador no soporta reconocimiento de voz nativo.');
            setAppState('IDLE');
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
                setTranscript(text);
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
                setError(`Reconocimiento: ${e.error}`);
                reportError('Mic', 'NativeSpeech', e.error, null, {
                    phase: 'NativeRecognition',
                    isRetry,
                    errorDetails: e.message || 'No details'
                });
            }
            setAppState('IDLE');
        };

        recognitionRef.current.onend = () => {
            console.log('[Mic] Recognition session ended');
            // GUARD: Only reset to IDLE if there's no query processing or lock active
            if (stateRef.current === 'LISTENING' && !isLocked.current && mountedRef.current) {
                console.log('[Mic] Safe to reset to IDLE');
                setAppState('IDLE');
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
            else setAppState('IDLE');
        }
    };

    const stopListening = () => {
        if (recognitionRef.current) recognitionRef.current.stop();
        stopAnims();
        if (abortControllerRef.current) abortControllerRef.current.abort();
        setAppState('IDLE');
    };

    const reportError = async (type, module, message, stack = null, details = {}) => {
        try {
            const errorMetadata = {
                userAgent: navigator.userAgent,
                isSecure: window.isSecureContext,
                screen: `${window.screen.width}x${window.screen.height}`,
                language: navigator.language,
                state: stateRef.current,
                ...details
            };

            await fetch(`${API_BASE_URL}/api/report-error`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type,
                    module,
                    message,
                    stack,
                    details: errorMetadata
                })
            });
        } catch (e) {
            console.warn('Could not report error to backend:', e.message);
        }
    };

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
            setAppState('IDLE');

            // 📱 UX IMPROVEMENT: Auto-trigger voice if Tablet/Kiosk (reduced click)
            if (isTabletOrKiosk.current) {
                console.log('📱 Tablet/Kiosk detected — triggering auto-voice...');
                startListening(false, true);
            }

        } catch (e) {
            console.error('[Mic] Error crítico en activación:', e.message);
            reportError('Mic', 'activateApp', e.message, e.stack, {
                phase: 'CriticalActivation',
                errorName: e.name,
                isSecure: window.isSecureContext
            });

            // Si falla, al menos dejamos entrar para escritura manual
            setError('No pudimos activar el micrófono. Usando modo teclado.');
            setAppState('IDLE');
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
                                            setResponse('');
                                            setAppState('IDLE');
                                        }}
                                        className="px-10 py-4 bg-white/10 hover:bg-white/20 active:scale-95 rounded-full text-white font-bold transition-all border border-white/10 flex items-center gap-3 shadow-xl group whitespace-nowrap"
                                    >
                                        <span>Entendido</span>
                                        <span className="bg-blue-600/40 px-3 py-1 rounded-full text-xs font-mono group-hover:bg-blue-600/60 transition-colors">{timeLeft}s</span>
                                    </button>
                                </div>
                                {/* IA Disclaimer Badge */}
                                <div className="mt-4 flex justify-center">
                                    <span className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/25 rounded text-[10px] text-blue-300/60 font-bold uppercase tracking-widest">
                                        ⚠ Asistente RRHH IA - Esta respuesta puede tener errores · Te recomendamos revisar la información importante. ⚠
                                    </span>
                                </div>




                            </motion.div>


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
                            <button onClick={() => setError(null)} className="ml-6 bg-white/10 px-3 py-1 rounded-full hover:bg-white/20 transition-colors">✕</button>
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
                            initial={{ scale: 0.92, y: 30 }} animate={{ scale: 1, y: 0 }}
                            className="bg-[#111827]/95 border border-white/10 rounded-[2.5rem] p-8 max-w-3xl w-full shadow-2xl flex flex-col max-h-[90vh]"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between mb-6 flex-shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-base">📋</div>
                                    <div>
                                        <h2 className="text-lg text-white font-bold tracking-tight">Temas de Consulta</h2>
                                        <p className="text-[10px] text-white/30 uppercase tracking-widest">Selecciona un tema para consultar</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[9px] text-blue-400 font-bold uppercase tracking-wider">10 temas</span>
                                    <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-white/40 hover:text-white transition-all text-sm">✕</button>
                                </div>
                            </div>

                            {/* Topic Grid — scrollable */}
                            <div className="overflow-y-auto custom-scrollbar pr-1">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {[
                                        { icon: '📄', color: 'blue', t: "Tipos de contratos y periodo de prueba", s: "Contrato fijo, indefinido, obra o labor y aprendizaje." },
                                        { icon: '⏱', color: 'violet', t: "Periodo de prueba", s: "Duración máxima y condiciones aplicables." },
                                        { icon: '🕐', color: 'sky', t: "Jornadas de trabajo y horarios", s: "Horas semanales, turnos y jornada flexible." },
                                        { icon: '💼', color: 'amber', t: "Horas extras y recargos", s: "Trabajo nocturno, extra y dominical." },
                                        { icon: '🏖', color: 'teal', t: "Descansos, vacaciones y permisos", s: "Días disponibles y cómo solicitarlos." },
                                        { icon: '🏥', color: 'green', t: "Licencias legales", s: "Maternidad, paternidad, luto y parentales." },
                                        { icon: '💰', color: 'emerald', t: "Salarios y dotación", s: "Forma de pago e igualdad salarial." },
                                        { icon: '⚖️', color: 'orange', t: "Obligaciones y régimen disciplinario", s: "Deberes, faltas y sanciones." },
                                        { icon: '🛡', color: 'red', t: "Acoso laboral y sexual", s: "Cómo denunciar y garantías de protección." },
                                        { icon: '🤝', color: 'indigo', t: "Asuntos sindicales y fueros", s: "Tipos de sindicato y estabilidad reforzada." },
                                    ].map((topic, i) => {
                                        const palette = {
                                            blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', hover: 'hover:border-blue-400/40 hover:bg-blue-500/15', icon: 'bg-blue-500/20 text-blue-300', title: 'group-hover:text-blue-300' },
                                            violet: { bg: 'bg-violet-500/10', border: 'border-violet-500/20', hover: 'hover:border-violet-400/40 hover:bg-violet-500/15', icon: 'bg-violet-500/20 text-violet-300', title: 'group-hover:text-violet-300' },
                                            sky: { bg: 'bg-sky-500/10', border: 'border-sky-500/20', hover: 'hover:border-sky-400/40 hover:bg-sky-500/15', icon: 'bg-sky-500/20 text-sky-300', title: 'group-hover:text-sky-300' },
                                            amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', hover: 'hover:border-amber-400/40 hover:bg-amber-500/15', icon: 'bg-amber-500/20 text-amber-300', title: 'group-hover:text-amber-300' },
                                            teal: { bg: 'bg-teal-500/10', border: 'border-teal-500/20', hover: 'hover:border-teal-400/40 hover:bg-teal-500/15', icon: 'bg-teal-500/20 text-teal-300', title: 'group-hover:text-teal-300' },
                                            green: { bg: 'bg-green-500/10', border: 'border-green-500/20', hover: 'hover:border-green-400/40 hover:bg-green-500/15', icon: 'bg-green-500/20 text-green-300', title: 'group-hover:text-green-300' },
                                            emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', hover: 'hover:border-emerald-400/40 hover:bg-emerald-500/15', icon: 'bg-emerald-500/20 text-emerald-300', title: 'group-hover:text-emerald-300' },
                                            orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/20', hover: 'hover:border-orange-400/40 hover:bg-orange-500/15', icon: 'bg-orange-500/20 text-orange-300', title: 'group-hover:text-orange-300' },
                                            red: { bg: 'bg-red-500/10', border: 'border-red-500/20', hover: 'hover:border-red-400/40 hover:bg-red-500/15', icon: 'bg-red-500/20 text-red-300', title: 'group-hover:text-red-300' },
                                            indigo: { bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', hover: 'hover:border-indigo-400/40 hover:bg-indigo-500/15', icon: 'bg-indigo-500/20 text-indigo-300', title: 'group-hover:text-indigo-300' },
                                        };
                                        const p = palette[topic.color];
                                        return (
                                            <button
                                                key={i}
                                                onClick={() => { setIsModalOpen(false); handleQuery(topic.t); }}
                                                className={`group flex items-start gap-4 p-5 ${p.bg} ${p.border} ${p.hover} active:scale-95 rounded-2xl text-left transition-all duration-200 border`}
                                            >
                                                <div className={`w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center text-base ${p.icon}`}>
                                                    {topic.icon}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className={`text-sm text-white/80 font-semibold mb-0.5 leading-snug transition-colors ${p.title}`}>{topic.t}</div>
                                                    <div className="text-[11px] text-white/30 group-hover:text-white/50 transition-colors leading-relaxed">{topic.s}</div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Administrador PIN Modal */}
            <AnimatePresence>
                {showPinModal && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-2xl"
                        onClick={() => setShowPinModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                            className="bg-[#1a2333] border border-white/10 rounded-[2.5rem] p-10 max-w-md w-full shadow-4xl text-center"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="mb-8">
                                <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 border border-blue-500/30">
                                    🔐
                                </div>
                                <h2 className="text-2xl font-bold text-white">Acceso Restringido</h2>
                                <p className="text-white/40 mt-2">Ingresa el PIN para acceder al Dashboard Admin</p>
                            </div>

                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                const pinInput = e.target.pin.value;
                                try {
                                    const res = await fetch(`${API_BASE_URL}/api/verify-pin`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ pin: pinInput })
                                    });
                                    const data = await res.json();
                                    if (data.success) {
                                        window.open('/?dashboard=true', '_blank');
                                        setShowPinModal(false);
                                    } else {
                                        alert('PIN Incorrecto. Intenta de nuevo.');
                                        e.target.pin.value = '';
                                    }
                                } catch (err) {
                                    console.error('Error verificando PIN:', err);
                                    alert('Error de conexión con el servidor.');
                                }
                            }}>
                                <input
                                    name="pin"
                                    type="password"
                                    autoFocus
                                    inputMode="numeric"
                                    maxLength={4}
                                    placeholder="••••"
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-6 text-4xl text-center tracking-[1em] text-blue-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all mb-6 placeholder:text-white/5"
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowPinModal(false)}
                                        className="py-4 bg-white/5 hover:bg-white/10 rounded-xl text-white/60 font-medium transition-all"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="py-4 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-bold transition-all shadow-lg shadow-blue-600/20"
                                    >
                                        Validar
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
};

export default VoiceChat;
