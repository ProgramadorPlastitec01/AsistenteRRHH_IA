import { useState, useEffect, useRef, useReducer } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import notebookLMClient from '../utils/notebookLMClient';
import IntentEngine from '../utils/NexusIntentEngine';
import logger from '../utils/logger';
import conversationStore from '../utils/conversationStore';
import { API_BASE_URL } from '../utils/apiConfig';
import NexusCore from './NexusCore';
import CompanyLogo from './CompanyLogo';
import TypewriterText from './TypewriterText';
import AnalyticsDashboard from './AnalyticsDashboard';
import FAQSection from './FAQSection';

const initialState = {
    appState: 'INIT', // INIT, IDLE, LISTENING, PROCESSING, RESPONDING, ERROR
    transcript: '',
    response: '',
    error: null,
    processingStep: 0, // 1: Recibiendo, 2: Analizando, 3: Generando
};

function chatReducer(state, action) {
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
            if (state.appState === 'PROCESSING' && !action.force) return state;
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

    const [showAnalytics, setShowAnalytics] = useState(false);
    const [performanceMetrics, setPerformanceMetrics] = useState(null);
    const secretClickRef = useRef(0);

    const [showPinModal, setShowPinModal] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [pinError, setPinError] = useState('');
    const [pinLoading, setPinLoading] = useState(false);

    const handleSecretClick = (e) => {
        if (e) e.stopPropagation();
        secretClickRef.current += 1;
        if (navigator.vibrate) navigator.vibrate(20);
        if (secretClickRef.current >= 5) {
            secretClickRef.current = 0;
            setPinInput('');
            setPinError('');
            setShowPinModal(true);
        }
        if (secretClickRef.current === 1) {
            setTimeout(() => { secretClickRef.current = 0; }, 2500);
        }
    };

    const handlePinSubmit = async () => {
        if (!pinInput.trim()) { setPinError('Ingresa el PIN'); return; }
        setPinLoading(true);
        setPinError('');
        try {
            const res = await fetch(`${API_BASE_URL}/api/verify-pin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin: pinInput.trim() })
            });
            const data = await res.json();
            if (data.success) {
                setShowPinModal(false);
                setPinInput('');
                window.open('/?dashboard=true', '_blank');
            } else {
                setPinError(data.error || 'PIN incorrecto');
            }
        } catch {
            setPinError('Error de conexión.');
        } finally {
            setPinLoading(false);
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
    const metricsRef = useRef({});
    const animationFrameRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const currentUtteranceRef = useRef(null);

    const stateRef = useRef(appState);
    useEffect(() => { stateRef.current = appState; }, [appState]);

    const mountedRef = useRef(true);
    const isLocked = useRef(false);
    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    const isMobileDevice = useRef(/iPhone|iPad|iPod|Android|webOS/i.test(navigator.userAgent) || window.innerWidth <= 768);

    useEffect(() => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            setIsSupported(false);
            return;
        }
        notebookLMClient.initialize();
        notebookLMClient.resetConversation();
    }, []);

    useEffect(() => {
        const handleInteraction = () => { if (response && stateRef.current === 'IDLE') setTimeLeft(25); };
        window.addEventListener('mousemove', handleInteraction);
        window.addEventListener('touchstart', handleInteraction);
        window.addEventListener('keydown', handleInteraction);
        return () => {
            window.removeEventListener('mousemove', handleInteraction);
            window.removeEventListener('touchstart', handleInteraction);
            window.removeEventListener('keydown', handleInteraction);
        };
    }, [response]);

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
            setTimeLeft(25);
        }
        return () => clearInterval(interval);
    }, [response, appState]);

    const speakText = async (text) => {
        if (!synthRef.current) return;
        synthRef.current.cancel();
        const cleanText = text.replace(/[#*`_~|]/g, '').replace(/[-•]/g, ' ').replace(/\s+/g, ' ').trim();
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'es-MX';
        utterance.rate = 1.05;
        utterance.onstart = () => { ttsInProgressRef.current = true; dispatch({ type: 'START_RESPONDING' }); };
        utterance.onend = () => { ttsInProgressRef.current = false; dispatch({ type: 'RESET_IDLE' }); };
        utterance.onerror = () => { ttsInProgressRef.current = false; dispatch({ type: 'RESET_IDLE' }); };
        const voices = synthRef.current.getVoices();
        const preferredVoice = voices.find(v => v.lang.includes('es-MX')) || voices.find(v => v.lang.includes('es')) || voices[0];
        if (preferredVoice) utterance.voice = preferredVoice;
        currentUtteranceRef.current = utterance;
        synthRef.current.speak(utterance);
    };

    const handleQuery = async (queryText) => {
        if (!queryText || queryText.trim().length < 2 || isLocked.current) return;
        isLocked.current = true;
        const qStart = performance.now();
        const cachedResponse = conversationStore.getCachedResponse(queryText);
        if (cachedResponse) {
            dispatch({ type: 'START_PROCESSING', payload: queryText });
            await new Promise(r => setTimeout(r, 600));
            dispatch({ type: 'SET_RESPONSE', payload: cachedResponse });
            speakText(cachedResponse);
            isLocked.current = false;
            return;
        }
        dispatch({ type: 'START_PROCESSING', payload: queryText });
        const step2Timer = setTimeout(() => dispatch({ type: 'SET_PROCESSING_STEP', payload: 2 }), 800);
        const step3Timer = setTimeout(() => dispatch({ type: 'SET_PROCESSING_STEP', payload: 3 }), 3500);
        try {
            abortControllerRef.current = new AbortController();
            const result = await notebookLMClient.query(queryText, { signal: abortControllerRef.current.signal });
            if (!mountedRef.current) return;
            const qLatency = Math.round(performance.now() - qStart);
            setPerformanceMetrics({ micMs: 0, recMs: 0, transMs: 0, aiMs: qLatency, totalMs: qLatency });
            conversationStore.setCachedResponse(queryText, result);
            dispatch({ type: 'SET_RESPONSE', payload: result });
            speakText(result);
        } catch (err) {
            if (err.name !== 'AbortError') dispatch({ type: 'SET_ERROR', payload: err.message || 'Error' });
        } finally {
            clearTimeout(step2Timer); clearTimeout(step3Timer);
            isLocked.current = false;
        }
    };

    const startListening = (isRetry = false) => {
        if (!isSupported || isLocked.current || (stateRef.current !== 'IDLE' && !isRetry)) return;
        if (synthRef.current) synthRef.current.cancel();
        dispatch({ type: 'START_LISTENING' });
        if (isMobileDevice.current && streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.lang = 'es-MX';
        recognitionRef.current.onresult = (e) => {
            const text = e.results[e.results.length - 1][0].transcript;
            if (e.results[e.results.length - 1].isFinal) {
                recognitionRef.current.stop();
                handleQuery(text);
            } else {
                dispatch({ type: 'UPDATE_TRANSCRIPT', payload: text });
            }
        };
        recognitionRef.current.onerror = (e) => {
            if (e.error !== 'no-speech') dispatch({ type: 'SET_ERROR', payload: e.error });
            dispatch({ type: 'RESET_IDLE' });
        };
        recognitionRef.current.onend = () => { if (stateRef.current === 'LISTENING' && !isLocked.current) dispatch({ type: 'RESET_IDLE' }); };
        try { recognitionRef.current.start(); } catch (e) { dispatch({ type: 'RESET_IDLE' }); }
    };

    const stopListening = () => {
        if (recognitionRef.current) recognitionRef.current.stop();
        if (abortControllerRef.current) abortControllerRef.current.abort();
        dispatch({ type: 'RESET_IDLE', force: true });
    };

    const getStateConfig = () => {
        switch (appState) {
            case 'LISTENING': return { icon: '🎙️', text: 'Te escucho...', subtext: 'Habla ahora', color: 'text-green-400' };
            case 'PROCESSING':
                let stepText = 'Procesando...';
                if (processingStep === 1) stepText = 'Recibiendo...';
                if (processingStep === 2) stepText = 'Analizando...';
                if (processingStep === 3) stepText = 'Generando...';
                return { icon: '🧠', text: stepText, subtext: 'Buscando...', color: 'text-blue-400' };
            case 'RESPONDING': return { icon: '🗣️', text: 'Respondiendo', subtext: 'Escucha', color: 'text-purple-400' };
            case 'ERROR': return { icon: '⚠️', text: 'Error', subtext: 'Fallo', color: 'text-red-400' };
            default: return { icon: '✨', text: 'Bienvenido', subtext: 'Toca el micro para iniciar', color: 'text-white' };
        }
    };

    const config = getStateConfig();

    const activateApp = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            analyserRef.current = audioContextRef.current.createAnalyser();
            const source = audioContextRef.current.createMediaStreamSource(stream);
            source.connect(analyserRef.current);
            dispatch({ type: 'RESET_IDLE', force: true });
        } catch (e) {
            dispatch({ type: 'SET_ERROR', payload: 'Error de micrófono.' });
        }
    };

    return (
        <div className="h-screen w-full bg-[#0d1426] overflow-hidden relative font-sans text-white">
            {appState === 'INIT' ? (
                /* ── VISTA INICIAL ── */
                <div className="h-full w-full flex flex-col items-center justify-center cursor-pointer relative" onClick={activateApp}>
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
                        <div className="mt-12 px-10 py-6 bg-gradient-to-r from-blue-600 to-blue-500 rounded-full text-white text-xl font-bold shadow-[0_0_30px_rgba(37,99,235,0.4)] transition-all animate-pulse">
                            TOCAR PARA INICIAR 👆
                        </div>
                    </div>
                </div>
            ) : (
                /* ── VISTA PRINCIPAL ── */
                <div className="h-full flex flex-col p-6 md:p-12 relative z-10">
                    {/* Visualizer Background */}
                    <div className={`absolute inset-0 flex items-center justify-center -z-10 transition-all duration-1000 ${response ? 'opacity-10 scale-150' : 'opacity-30 scale-100'}`}>
                        <NexusCore status={appState.toLowerCase()} volume={volume} />
                    </div>

                    {/* Header */}
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4 bg-black/40 backdrop-blur-2xl p-3 pr-8 rounded-full border border-white/10 shadow-2xl">
                            <div onClick={handleSecretClick} className="cursor-pointer active:scale-95 transition-transform">
                                <CompanyLogo className="w-12 h-12" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs text-blue-300 font-bold uppercase tracking-wider">Asistente RRHH IA</span>
                                <span className="text-[10px] text-white/40 uppercase tracking-widest">Panel de Control</span>
                            </div>
                        </div>
                        <button onClick={() => setIsModalOpen(true)} className="w-12 h-12 flex items-center justify-center bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all text-xl shadow-lg">ℹ️</button>
                    </div>

                    {/* Content */}
                    <div className="flex-grow flex flex-col items-center justify-center relative">
                        {!response ? (
                            <div className="text-center space-y-8">
                                <div className="text-8xl mb-6">{config.icon}</div>
                                <h2 className={`text-6xl font-light mb-2 ${config.color}`}>{config.text}</h2>
                                <p className="text-white/40 text-2xl tracking-[0.2em] uppercase">{config.subtext}</p>
                                {appState === 'IDLE' && <FAQSection onSelect={handleQuery} />}
                            </div>
                        ) : (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-5xl bg-[#1a2333]/90 backdrop-blur-3xl border border-white/10 rounded-[3.5rem] p-12 shadow-3xl flex flex-col relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-white/5">
                                    <motion.div className="h-full bg-blue-500" animate={{ width: `${(timeLeft / 25) * 100}%` }} transition={{ duration: 1 }} />
                                </div>
                                <div className="overflow-y-auto max-h-[50vh] pr-4 custom-scrollbar">
                                    <h3 className="text-blue-400 text-sm font-bold uppercase tracking-widest mb-6 sticky top-0 bg-[#1a2333]/80 py-2">Respuesta del Asistente</h3>
                                    <TypewriterText text={response} speed={18} />
                                </div>
                                <div className="mt-8 pt-8 border-t border-white/10 flex justify-between items-center">
                                    <div className="text-white/30 text-xs italic truncate max-w-[60%]">"{transcript}"</div>
                                    <button onClick={() => dispatch({ type: 'CLEAR_RESPONSE' })} className="px-10 py-4 bg-blue-600 hover:bg-blue-500 rounded-full text-white font-bold transition-all shadow-xl">Entendido ({timeLeft}s)</button>
                                </div>
                            </motion.div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="mt-auto w-full max-w-4xl mx-auto">
                        <div className="bg-black/60 backdrop-blur-3xl border border-white/10 rounded-full p-4 flex items-center gap-6 shadow-3xl">
                            <button onClick={() => appState === 'LISTENING' ? stopListening() : startListening()} className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl transition-all ${appState === 'LISTENING' ? 'bg-red-500 scale-110' : 'bg-blue-600 hover:bg-blue-500'}`}>{appState === 'LISTENING' ? '⏹' : '🎙️'}</button>
                            <input type="text" placeholder="Escribe tu consulta..." className="flex-grow bg-transparent border-none text-white text-2xl placeholder-white/15 focus:ring-0" onKeyDown={e => { if (e.key === 'Enter' && e.target.value.trim()) { handleQuery(e.target.value); e.target.value = ''; } }} />
                        </div>
                    </div>
                </div>
            )}

            {/* Modales Globales */}
            <AnimatePresence>
                {showPinModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[500] flex items-center justify-center bg-black/95 backdrop-blur-xl" onClick={() => setShowPinModal(false)}>
                        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-[#111827] border border-white/10 rounded-2xl p-8 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                            <h3 className="text-white font-bold mb-6 text-center">Panel Administrativo</h3>
                            <input type="password" value={pinInput} onChange={e => setPinInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handlePinSubmit()} placeholder="PIN de acceso" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-center text-2xl tracking-[0.5em] mb-4" autoFocus />
                            {pinError && <p className="text-red-400 text-xs text-center mb-4">{pinError}</p>}
                            <div className="flex gap-4">
                                <button onClick={() => setShowPinModal(false)} className="flex-1 py-3 bg-white/5 rounded-xl text-white/50 transition-colors hover:bg-white/10">Cancelar</button>
                                <button onClick={handlePinSubmit} disabled={pinLoading} className="flex-1 py-3 bg-blue-600 rounded-xl text-white font-bold transition-all hover:bg-blue-500">{pinLoading ? '...' : 'Entrar'}</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {isModalOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/95 backdrop-blur-2xl" onClick={() => setIsModalOpen(false)}>
                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[#1a2333]/95 border border-white/10 rounded-[3rem] p-12 max-w-4xl w-full shadow-4xl" onClick={e => e.stopPropagation()}>
                            <h2 className="text-4xl text-white mb-10 font-light tracking-tight text-center">Temas de Consulta Frecuentes</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {[
                                    { t: "Tipos de contratos y periodo de prueba", s: "Diferencias entre contrato fijo, indefinido, obra o labor y aprendizaje." },
                                    { t: "Periodo de prueba", s: "Duración máxima y condiciones aplicables." },
                                    { t: "Jornadas de trabajo y horarios", s: "Horas semanales, turnos y jornada flexible." },
                                    { t: "Horas extras y recargos", s: "Porcentajes para trabajo nocturno, extra y dominical." }
                                ].map((topic, i) => (
                                    <button key={i} onClick={() => { setIsModalOpen(false); handleQuery(topic.t); }} className="group p-8 bg-white/5 hover:bg-blue-600/20 active:scale-95 rounded-3xl text-left transition-all border border-white/10 hover:border-blue-500/30">
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

                {error && (
                    <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="fixed bottom-10 left-0 w-full flex justify-center z-[500]">
                        <div className="bg-red-500 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-4">
                            <span>⚠️ {error}</span>
                            <button onClick={() => dispatch({ type: 'CLEAR_ERROR' })} className="bg-white/10 px-2 rounded-full">✕</button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default VoiceChat;
