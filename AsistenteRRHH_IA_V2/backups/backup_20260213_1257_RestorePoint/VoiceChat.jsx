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
    const [debugLogs, setDebugLogs] = useState([]);
    const [showDebug, setShowDebug] = useState(false);

    // Sistema de logs en pantalla
    const addLog = (message, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString();
        const icon = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
        const newLog = `${icon} [${timestamp}] ${message}`;

        console.log(message); // Mantener consola original
        setDebugLogs(prev => [newLog, ...prev].slice(0, 100)); // Guardar últimos 100 logs
    };

    const recognitionRef = useRef(null);
    const synthRef = useRef(window.speechSynthesis);
    const recognitionTimeoutRef = useRef(null); // Timeout de seguridad para móviles
    const hasReceivedResultRef = useRef(false); // Para detectar si hubo resultados en la sesión actual
    const lastInterimResultRef = useRef(''); // Para guardar el último resultado parcial

    // Refs recuperados
    const streamRef = useRef(null);
    const inactivityTimerRef = useRef(null);
    const ttsInProgressRef = useRef(false);

    // Refs para visualizador
    const animationFrameRef = useRef(null);
    const analyserRef = useRef(null);
    const audioContextRef = useRef(null);

    // Función auxiliar para iniciar visualizador
    const startVisualizer = (stream) => {
        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioContextRef.current.state === 'suspended') {
                audioContextRef.current.resume();
            }

            // Si ya hay analyser, reutilizarlo o recrearlo
            if (!analyserRef.current) {
                analyserRef.current = audioContextRef.current.createAnalyser();
                analyserRef.current.fftSize = 256;
            }

            const source = audioContextRef.current.createMediaStreamSource(stream);
            source.connect(analyserRef.current);

            const bufferLength = analyserRef.current.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const updateVolume = () => {
                if (analyserRef.current) {
                    analyserRef.current.getByteFrequencyData(dataArray);
                    let sum = 0;
                    for (let i = 0; i < bufferLength; i++) {
                        sum += dataArray[i];
                    }
                    const average = sum / bufferLength;
                    setVolume(average * 2.5); // Escalar para visualización
                    animationFrameRef.current = requestAnimationFrame(updateVolume);
                }
            };
            updateVolume();
            addLog('📊 Visualizador de audio iniciado', 'info');
        } catch (e) {
            console.error('Error al iniciar visualizador:', e);
            addLog(`❌ Error visualizador: ${e.message}`, 'error');
        }
    };

    // Refs para MediaRecorder (sistema híbrido)
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordingTimeoutRef = useRef(null);
    const isFallbackAttempt = useRef(false); // Control de fallback automático a Whisper
    const forceWebSpeechMode = useRef(false); // Forzar uso de Web Speech API (si Whisper no tiene cuota)
    // Detección mejorada de dispositivos móviles
    // Detección mejorada de dispositivos móviles
    const isMobileDevice = useRef((() => {
        const ua = navigator.userAgent;
        const isMobileUA = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const isSmallScreen = window.innerWidth <= 768;

        // Considerar móvil si cumple al menos 2 de 3 condiciones O si es Android explícitamente
        const mobileScore = (isMobileUA ? 1 : 0) + (isTouchDevice ? 1 : 0) + (isSmallScreen ? 1 : 0);
        const isMobile = mobileScore >= 2 || /Android/i.test(ua); // Forzar Android como móvil

        // Log solo una vez (safe for render)
        if (typeof window !== 'undefined') {
            console.log('🔍 DETECCIÓN DE DISPOSITIVO (MEJORADA):');
            console.log('   - User Agent móvil:', isMobileUA);
            console.log('   - Es Android:', /Android/i.test(ua));
            console.log('   - Touch device:', isTouchDevice);
            console.log('   - Pantalla pequeña:', isSmallScreen, `(${window.innerWidth}px)`);
            console.log('   - Score:', mobileScore, '/3');
            console.log('   - RESULTADO FINAL:', isMobile ? '📱 MÓVIL' : '🖥️ DESKTOP');
            console.log('   - User Agent:', ua);
        }

        return isMobile;
    })());

    useEffect(() => {
        // Check browser support for Web Speech API
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            setIsSupported(false);
            addLog('Navegador no soporta Web Speech API', 'error');
            setError('Tu navegador no soporta reconocimiento de voz. Por favor usa Chrome o Edge.');
            return;
        }

        addLog('Iniciando VoiceChat...', 'info');
        addLog(`User Agent: ${navigator.userAgent}`, 'info');

        // Initialize NotebookLM client
        notebookLMClient.initialize();

        return () => {
            if (recognitionRef.current) recognitionRef.current.stop();
            if (synthRef.current) synthRef.current.cancel();
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            if (audioContextRef.current) audioContextRef.current.close();
            if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
            if (recognitionTimeoutRef.current) clearTimeout(recognitionTimeoutRef.current);
        };
    }, []);

    // INACTIVITY LOGIC (30 Seconds)
    const resetInactivityTimer = () => {
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);

        // Solo aplicar si el sistema está activado
        if (!isActivated) return;

        // NO reiniciar por inactividad si está pensando o hablando
        if (state === 'thinking' || state === 'speaking') {
            console.log(`⏱️ Inactividad pausada por estado: ${state}`);
            return;
        }

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

    // ═══════════════════════════════════════════════════════════════
    // SISTEMA HÍBRIDO: MediaRecorder + Whisper (para móviles)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Iniciar grabación de audio usando MediaRecorder
     * Usado en dispositivos móviles donde Web Speech API no funciona bien
     */
    const startRecording = async () => {
        try {
            console.log('\n🎙️ ========================================');
            console.log('📱 INICIANDO GRABACIÓN (MediaRecorder + Whisper)');
            console.log('   - Dispositivo: MÓVIL');
            console.log('========================================\n');

            setError('');
            setTranscript('');
            setResponse('');
            setState('listening');

            // Solicitar permiso de micrófono
            console.log('📱 Solicitando permiso de micrófono...');
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            streamRef.current = stream;
            console.log('✅ Permiso de micrófono concedido');

            // Configurar visualización de audio
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

            // Crear MediaRecorder
            audioChunksRef.current = [];



            // Determinar el tipo MIME soportado con logs detallados
            const possibleTypes = [
                'audio/webm',
                'audio/mp4',
                'audio/ogg',
                'audio/wav',
                'audio/aac'
            ];

            let mimeType = '';
            console.log('🔍 Verificando soporte de MIME types:');

            for (const type of possibleTypes) {
                if (MediaRecorder.isTypeSupported(type)) {
                    console.log(`   ✅ Soportado: ${type}`);
                    if (!mimeType) mimeType = type; // Seleccionar el primero soportado como default
                } else {
                    console.log(`   ❌ No soportado: ${type}`);
                }
            }

            // Preferencia explícita: MP4 para iOS/Safari, WEBM para otros
            if (MediaRecorder.isTypeSupported('audio/mp4')) {
                mimeType = 'audio/mp4';
                console.log('🌟 Seleccionado audio/mp4 (preferido para iOS)');
            } else if (MediaRecorder.isTypeSupported('audio/webm')) {
                mimeType = 'audio/webm';
                console.log('🌟 Seleccionado audio/webm (estándar)');
            } else if (!mimeType) {
                console.warn('⚠️ Ningún tipo MIME estándar soportado. Dejando al navegador decidir.');
                mimeType = ''; // Dejar vacío para que el navegador decida
            }

            console.log('🔧 Configuración FINAL de MediaRecorder:');
            console.log('   - MIME type:', mimeType || 'default (navegador)');

            const options = mimeType ? { mimeType } : {};

            mediaRecorderRef.current = new MediaRecorder(stream, options);

            // Evento: cuando hay datos disponibles
            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                    console.log('📦 Chunk de audio recibido:', event.data.size, 'bytes');
                }
            };

            // Evento: cuando la grabación se detiene
            mediaRecorderRef.current.onstop = async () => {
                addLog('🏁 Grabación FINALIZADA', 'success');
                console.log('🏁 Grabación FINALIZADA');
                console.log('   - Total de chunks:', audioChunksRef.current.length);

                // Detener stream
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                    streamRef.current = null;
                }

                // Detener visualización de audio
                if (animationFrameRef.current) {
                    cancelAnimationFrame(animationFrameRef.current);
                }
                if (audioContextRef.current) {
                    audioContextRef.current.close();
                }
                setVolume(0);

                // Crear blob de audio
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                addLog(`🎵 Blob creado: ${audioBlob.size} bytes`, 'info');
                console.log('🎵 Blob de audio creado:', audioBlob.size, 'bytes');

                // Enviar a transcripción
                await transcribeAudio(audioBlob);
            };

            // Iniciar grabación
            mediaRecorderRef.current.start();
            addLog('✅ Grabación INICIADA (MediaRecorder)', 'success');
            console.log('✅ Grabación INICIADA');

            // Timeout de seguridad (10 segundos)
            recordingTimeoutRef.current = setTimeout(() => {
                console.warn('⏱️ TIMEOUT: Deteniendo grabación después de 10 segundos');
                stopRecording();
            }, 10000);

        } catch (err) {
            console.error('\n❌ ========================================');
            console.error('ERROR AL INICIAR GRABACIÓN:');
            console.error('   - Mensaje:', err.message);
            console.error('   - Stack:', err.stack);
            console.error('========================================\n');

            // Detener stream si se creó
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }

            // Mensajes específicos según el error
            if (err.name === 'NotAllowedError') {
                setError('❌ Permiso de micrófono denegado. Por favor permite el acceso en la configuración de tu navegador.');
            } else if (err.name === 'NotFoundError') {
                setError('❌ No se encontró micrófono. Verifica que tu dispositivo tenga micrófono.');
            } else if (err.name === 'NotSupportedError') {
                setError('❌ Tu navegador no soporta grabación de audio.');
            } else {
                setError('❌ Error al iniciar el micrófono. Por favor intenta de nuevo.');
            }

            setState('idle');
        }
    };

    /**
     * Detener grabación de audio
     */
    const stopRecording = () => {
        console.log('🛑 Deteniendo grabación...');

        // Limpiar timeout
        if (recordingTimeoutRef.current) {
            clearTimeout(recordingTimeoutRef.current);
            recordingTimeoutRef.current = null;
        }

        // Detener MediaRecorder
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
    };

    /**
     * Transcribir audio usando OpenAI Whisper API
     */
    const transcribeAudio = async (audioBlob) => {
        try {
            console.log('\n🔄 ========================================');
            console.log('📤 ENVIANDO AUDIO A WHISPER API');
            console.log('   - Tamaño:', (audioBlob.size / 1024).toFixed(2), 'KB');
            console.log('========================================\n');

            setState('thinking');

            // Crear FormData
            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.webm');

            // Enviar a backend
            const response = await fetch('/api/transcribe', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();

                // FALLBACK AUTOMÁTICO POR CUOTA AGOTADA
                if (errorData.fallbackToWebSpeech) {
                    console.warn('⚠️ Cuota Whisper agotada. Activando Modo Nativo Ilimitado.');
                    forceWebSpeechMode.current = true;

                    // Mostrar mensaje temporal al usuario
                    setError('⚠️ Límite de API alcanzado. Cambiando a reconocimiento ilimitado del navegador.');
                    setState('idle');

                    // REINTENTO AUTOMÁTICO CON WEB SPEECH API
                    setTimeout(() => {
                        console.log('🔄 Reintentando con Web Speech API...');
                        startListening();
                    }, 1500); // Pequeña pausa para que el usuario lea el mensaje
                    return;
                }

                throw new Error(errorData.error || 'Error al transcribir audio');
            }

            const data = await response.json();
            const transcript = data.transcript;

            console.log('✅ TRANSCRIPCIÓN EXITOSA');
            console.log('   - Texto:', transcript);
            console.log('========================================\n');

            // Actualizar transcript
            setTranscript(transcript);

            // Enviar al backend (NotebookLM)
            console.log('🚀 Enviando al backend:', transcript);
            await handleQuery(transcript);

        } catch (err) {
            console.error('\n❌ ========================================');
            console.error('ERROR EN TRANSCRIPCIÓN:');
            console.error('   - Mensaje:', err.message);
            console.error('========================================\n');

            setError(`❌ Error al transcribir: ${err.message}`);
            setState('idle');
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // SISTEMA ORIGINAL: Web Speech API (para desktop)
    // ═══════════════════════════════════════════════════════════════

    const startListening = async () => {
        if (!isSupported) return;

        addLog('🚀 Intentando iniciar reconocimiento...', 'info');
        console.log('\n🎤 ========================================');
        console.log('🚀 INICIANDO RECONOCIMIENTO DE VOZ');
        const isMobile = isMobileDevice.current;
        console.log('   - Dispositivo:', isMobile ? 'MÓVIL' : 'ESCRITORIO');
        console.log('   - User Agent:', navigator.userAgent);
        console.log('========================================\n');

        // ═══════════════════════════════════════════════════════════════
        // SISTEMA ESTÁNDAR: Web Speech API (Nativo para todos)
        // ═══════════════════════════════════════════════════════════════

        // Eliminada lógica híbrida por solicitud del usuario.
        // Ahora usamos EXCLUSIVAMENTE la API nativa del navegador.

        console.log('🖥️ Usando Web Speech API (Estándar)');

        setError('');
        setTranscript('');
        setResponse('');
        setState('listening');
        hasReceivedResultRef.current = false; // Reset flag

        setTranscript('');
        setResponse('');
        setState('listening');
        hasReceivedResultRef.current = false; // Reset flag
        lastInterimResultRef.current = ''; // Reset interim

        // Timeout de seguridad EXTENDIDO para móviles (15 segundos)
        recognitionTimeoutRef.current = setTimeout(() => {
            console.warn('⏱️ TIMEOUT: No se detectó resultado final');

            // Si hay algo en el interim, usarlo!
            if (lastInterimResultRef.current && lastInterimResultRef.current.trim().length > 0) {
                console.log('⏱️ Timeout disparado, pero hay texto interim. Usándolo.');
                if (recognitionRef.current) recognitionRef.current.stop();
            } else {
                if (recognitionRef.current) recognitionRef.current.stop();
                if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
                setState('idle');
                addLog('⚠️ No se detectó voz (timeout)', 'warning');
            }
        }, 15000);

        try {
            // 1. GESTIÓN DE MICRÓFONO (DIFERENCIADA MÓVIL vs DESKTOP)
            // En Android/Móvil, pedir getUserMedia antes de start() puede causar conflicto de recursos.
            // SpeechRecognition maneja su propio acceso al micrófono.

            if (!isMobile) {
                // DESKTOP: Pedimos permiso explícito y mostramos visualizador
                addLog('Solicitando permisos de micrófono (Desktop)...', 'info');
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });
                streamRef.current = stream;
                addLog('✅ Permiso concedido', 'success');

                // INICIAR VISUALIZADOR (Solo Desktop)
                startVisualizer(stream);
            } else {
                addLog('📱 Modo Móvil: Usando micrófono nativo de Speech API', 'info');
                // En móvil NO pedimos getUserMedia explícito para no bloquear el mic al SpeechRecognition
            }

            // 2. CONFIGURAR RECONOCIMIENTO DE VOZ
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

            if (!SpeechRecognition) {
                throw new Error('SpeechRecognition no disponible en este navegador');
            }

            recognitionRef.current = new SpeechRecognition();

            // ⚠️ CONFIGURACIÓN
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.maxAlternatives = 1;
            recognitionRef.current.lang = navigator.language || 'es-ES'; // Usar idioma del dispositivo

            console.log('🔧 Configuración de reconocimiento:');
            console.log('   - continuous:', recognitionRef.current.continuous);
            console.log('   - interimResults:', recognitionRef.current.interimResults);
            console.log('   - lang:', recognitionRef.current.lang);

            // 3. EVENTO: onstart
            recognitionRef.current.onstart = () => {
                addLog('✅ Reconocimiento INICIADO (onstart)', 'success');
                console.log('✅ Reconocimiento INICIADO');
                setState('listening');
            };

            // 4. EVENTO: onresult (LÓGICA MEJORADA PARA INTERIM RESULTS)
            recognitionRef.current.onresult = (event) => {
                // Limpiar timeout de seguridad si detectamos CUALQUIER actividad
                if (recognitionTimeoutRef.current) {
                    clearTimeout(recognitionTimeoutRef.current);
                    // Reiniciar timeout para dar más tiempo si sigue hablando
                    recognitionTimeoutRef.current = setTimeout(() => {
                        console.log('⏱️ Timeout renovado (silencio post-habla)');
                        if (recognitionRef.current) recognitionRef.current.stop();
                    }, 5000);
                }

                if (event.results.length === 0) return;

                // Obtener el último resultado (el más reciente)
                const resultIndex = event.results.length - 1;
                const result = event.results[resultIndex];
                const transcriptText = result[0].transcript;
                const isFinal = result.isFinal;

                // Guardar como interim SIEMPRE
                lastInterimResultRef.current = transcriptText;

                // Mostrar en tiempo real en UI si se desea (opcional)
                // setTranscript(transcriptText); 
                addLog(`🗣️ [${isFinal ? 'FINAL' : 'PARCIAL'}] "${transcriptText}"`, 'info');

                // Si es final, procesar INMEDIATAMENTE
                if (isFinal) {
                    console.log('✅ Resultado FINAL detectado:', transcriptText);
                    hasReceivedResultRef.current = true;

                    if (recognitionRef.current) recognitionRef.current.stop();
                    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());

                    setTranscript(transcriptText);
                    setState('thinking');
                    handleQuery(transcriptText);
                }
            };

            // 5. EVENTO: onerror (MANEJO ESPECÍFICO PARA MÓVILES + FALLBACK)
            recognitionRef.current.onerror = async (event) => {
                addLog(`❌ Error WebSpeech: ${event.error}`, 'error');
                console.error('\n❌ ========================================');
                console.error('ERROR EN RECONOCIMIENTO DE VOZ');
                console.error('   - Tipo de error:', event.error);
                console.error('   - Mensaje:', event.message);
                console.error('========================================\n');

                clearTimeout(recognitionTimeoutRef.current);

                // Detener stream de Web Speech API
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                }

                // Manejo específico por tipo de error
                switch (event.error) {
                    case 'no-speech':
                        setError('No se detectó voz. Por favor habla más cerca del micrófono.');
                        break;
                    case 'audio-capture':
                        setError('No se pudo acceder al micrófono. Verifica los permisos.');
                        break;
                    case 'not-allowed':
                        setError('Permiso de micrófono denegado. Por favor permite el acceso.');
                        break;
                    case 'network':
                        setError('Error de red. Verifica tu conexión a internet.');
                        break;
                    case 'aborted':
                        console.log('Reconocimiento abortado por el usuario');
                        break;
                    default:
                        setError(`Error: ${event.error}. Por favor intenta de nuevo.`);
                }

                setState('idle');
            };

            // 6. EVENTO: onend (LIMPIEZA Y VERIFICACIÓN DE ESTADO)
            recognitionRef.current.onend = () => {
                addLog('🏁 Reconocimiento FINALIZADO (onend)', 'info');
                console.log('🏁 Reconocimiento FINALIZADO');

                // Limpiar timeout
                if (recognitionTimeoutRef.current) {
                    clearTimeout(recognitionTimeoutRef.current);
                    recognitionTimeoutRef.current = null;
                }

                // Detener stream y visualizador
                if (streamRef.current) {
                    try {
                        streamRef.current.getTracks().forEach(track => track.stop());
                        streamRef.current = null;
                    } catch (e) {
                        console.warn('⚠️ Error al detener stream:', e.message);
                    }
                }
                if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
                setVolume(0);

                // ⚠️ CRÍTICO: Si terminó y NO hubo resultado FINAL, usar el INTERIM
                if (!hasReceivedResultRef.current) {
                    if (lastInterimResultRef.current && lastInterimResultRef.current.trim().length > 0) {
                        console.log('✅ onend: Usando resultado PARCIAL recuperado:', lastInterimResultRef.current);
                        addLog(`🏁 Usando parcial: "${lastInterimResultRef.current}"`, 'success');

                        setTranscript(lastInterimResultRef.current);
                        setState('thinking');
                        handleQuery(lastInterimResultRef.current);
                    } else {
                        console.warn('⚠️ onend: No hay texto recuperable.');
                        addLog('⚠️ No se detectó voz clara', 'warning');
                        setState('idle');
                    }
                } else {
                    console.log('✅ Limpieza completada (resultado final ya procesado)');
                }
            };

            // 7. VISUALIZACIÓN YA INICIADA CON startVisualizer(stream)

            // 8. INICIAR RECONOCIMIENTO

            // 8. INICIAR RECONOCIMIENTO
            console.log('🎬 Iniciando reconocimiento...');
            recognitionRef.current.start();
            console.log('✅ start() ejecutado correctamente\n');

        } catch (err) {
            console.error('\n❌ ========================================');
            console.error('ERROR AL INICIAR RECONOCIMIENTO:');
            console.error('   - Mensaje:', err.message);
            console.error('   - Stack:', err.stack);
            console.error('========================================\n');

            clearTimeout(recognitionTimeoutRef.current);

            // Detener stream si se creó
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }

            // Mensajes específicos según el error
            if (err.name === 'NotAllowedError') {
                setError('❌ Permiso de micrófono denegado. Por favor permite el acceso en la configuración de tu navegador.');
            } else if (err.name === 'NotFoundError') {
                setError('❌ No se encontró micrófono. Verifica que tu dispositivo tenga micrófono.');
            } else if (err.name === 'NotSupportedError') {
                setError('❌ Tu navegador no soporta reconocimiento de voz. Usa Chrome o Safari.');
            } else {
                setError('❌ Error al iniciar el micrófono. Por favor intenta de nuevo.');
            }

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

            {/* 2. OVERLAY CONTENT LAYER - RESPONSIVE */}
            <div className="relative z-10 h-full flex flex-col p-4 md:p-6 lg:p-12">

                {/* HEADER - OPTIMIZADO PARA MÓVILES */}
                <div className="flex justify-between items-start flex-wrap gap-3">
                    <div className="flex items-center gap-2 md:gap-4">
                        {/* Logo y Título - RESPONSIVE */}
                        <div className="flex items-center gap-3 md:gap-6 bg-black/30 backdrop-blur-md p-2 md:p-4 pr-4 md:pr-8 rounded-full border border-white/5">
                            <CompanyLogo size={window.innerWidth < 768 ? 40 : 60} />
                            <div className="flex flex-col">
                                <span className="text-[10px] md:text-xs text-blue-300 font-bold tracking-[0.2em] md:tracking-[0.3em] uppercase">Asistente Virtual</span>
                                <span className="text-[8px] md:text-[10px] text-white/40 uppercase tracking-wider">Recursos Humanos</span>
                            </div>
                        </div>

                        {/* Demo Badge - RESPONSIVE */}
                        <div className="flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-400/30 rounded-full backdrop-blur-sm">
                            <span className="w-1 md:w-1.5 h-1 md:h-1.5 bg-yellow-400 rounded-full animate-pulse"></span>
                            <span className="text-[9px] md:text-[10px] font-semibold text-yellow-300 tracking-wider uppercase">Demo</span>
                        </div>
                    </div>

                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-white/5 border border-white/10 rounded-full hover:bg-white/10 active:bg-white/15 transition-colors backdrop-blur-md text-lg md:text-xl"
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

                    {/* RESPONSE CARD (Shows when there is a response) - OPTIMIZADO MÓVILES */}
                    <AnimatePresence>
                        {response && (
                            <motion.div
                                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="w-full max-w-5xl bg-[#1a2333]/90 backdrop-blur-xl border border-white/10 rounded-2xl md:rounded-[3rem] p-6 md:p-10 lg:p-14 shadow-2xl flex flex-col max-h-[60vh] md:max-h-[65vh]"
                            >
                                {/* Scrollable Text Area - RESPONSIVE */}
                                <div className="overflow-y-auto custom-scrollbar pr-3 md:pr-6 space-y-4 md:space-y-6 flex-grow">
                                    <h3 className="text-xs md:text-sm font-bold text-blue-400 uppercase tracking-widest sticky top-0 bg-[#1a2333]/95 py-2 z-10">Respuesta:</h3>
                                    <div className="text-lg md:text-2xl lg:text-3xl font-light leading-relaxed text-slate-100">
                                        {response}
                                    </div>
                                </div>

                                {/* Footer con Advertencia y Transcript - RESPONSIVE */}
                                <div className="mt-6 md:mt-8 pt-4 md:pt-6 border-t border-white/5 flex flex-col gap-2 md:gap-3">
                                    <div className="text-white/30 text-[10px] md:text-xs italic flex flex-col md:flex-row justify-between gap-2">
                                        <span className="truncate">Tu consulta: "{transcript}"</span>
                                        <span className="text-right md:text-left">v1.0</span>
                                    </div>

                                    <div className="text-center">
                                        <p className="text-[10px] md:text-xs font-bold text-red-300/90 bg-red-500/10 border border-red-500/20 px-3 md:px-4 py-1.5 md:py-2 rounded-lg inline-block">
                                            ⚠️ La respuesta por IA puede contener errores.
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* BOTTOM CONTROLS BAR - OPTIMIZADO PARA MÓVILES */}
                <div className="w-full max-w-3xl mx-auto flex items-center gap-4 md:gap-6 bg-black/40 backdrop-blur-lg border border-white/10 rounded-full p-2 md:p-3 pr-4 md:pr-8 shadow-[0_10px_40px_rgba(0,0,0,0.3)]">

                    <button
                        onClick={() => {
                            if (state === 'listening') {
                                // Detener
                                if (isMobileDevice.current) {
                                    stopRecording();
                                } else {
                                    stopListening();
                                }
                            } else {
                                // Iniciar
                                startListening();
                            }
                        }}
                        disabled={state === 'thinking' || state === 'speaking'}
                        className={`
                            relative flex-shrink-0
                            w-16 h-16 md:w-20 md:h-20 
                            rounded-full 
                            flex items-center justify-center 
                            text-2xl md:text-3xl 
                            transition-all duration-300 
                            border-4 border-[#0d1426]
                            active:scale-95
                            disabled:opacity-50 disabled:cursor-not-allowed
                            ${state === 'listening'
                                ? 'bg-red-500 text-white shadow-[0_0_30px_rgba(239,68,68,0.6)] animate-pulse'
                                : state === 'thinking' || state === 'speaking'
                                    ? 'bg-gray-600 text-white cursor-not-allowed'
                                    : 'bg-blue-600 text-white hover:bg-blue-500 active:bg-blue-700 shadow-lg hover:shadow-[0_0_20px_rgba(37,99,235,0.5)]'}
                        `}
                        aria-label={state === 'listening' ? 'Detener grabación' : 'Iniciar grabación'}
                    >
                        {/* Icono principal */}
                        <span className="relative z-10">
                            {state === 'listening' ? '⏹' : '🎙️'}
                        </span>

                        {/* Animación de pulso cuando está escuchando */}
                        {state === 'listening' && (
                            <>
                                <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-75"></span>
                                <span className="absolute inset-0 rounded-full bg-red-500 animate-pulse"></span>
                            </>
                        )}

                        {/* Indicador de volumen visual */}
                        {state === 'listening' && volume > 0 && (
                            <span
                                className="absolute -inset-2 rounded-full border-2 border-green-400 opacity-50 transition-transform"
                                style={{ transform: `scale(${1 + (volume / 200)})` }}
                            ></span>
                        )}
                    </button>

                    {/* Manual Input - RESPONSIVE */}
                    <div className="flex-grow min-w-0">
                        <input
                            type="text"
                            placeholder="Escribe tu consulta aquí..."
                            disabled={state === 'listening'}
                            className="w-full bg-transparent border-none text-white text-base md:text-lg placeholder-white/30 focus:ring-0 focus:outline-none px-2 md:px-4 disabled:opacity-50"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                    handleQuery(e.currentTarget.value.trim());
                                    e.currentTarget.value = '';
                                }
                            }}
                        />
                    </div>

                    {/* Send Icon */}
                    <div className="text-white/20 text-lg md:text-xl flex-shrink-0">↵</div>
                </div>

                {/* ESTADO VISUAL MEJORADO - MÓVILES */}
                {error && (
                    <div className="mt-4 w-full max-w-3xl mx-auto">
                        <div className="bg-red-500/20 border border-red-500/50 rounded-2xl p-4 text-center backdrop-blur-sm">
                            <p className="text-red-300 text-sm md:text-base font-medium">
                                {error}
                            </p>
                        </div>
                    </div>
                )}

                {/* INDICADOR DE ESTADO ADICIONAL PARA MÓVILES */}
                {state === 'listening' && (
                    <div className="mt-4 w-full max-w-3xl mx-auto">
                        <div className="bg-green-500/20 border border-green-500/50 rounded-2xl p-4 text-center backdrop-blur-sm animate-pulse">
                            <p className="text-green-300 text-sm md:text-base font-medium flex items-center justify-center gap-2">
                                <span className="w-2 h-2 bg-green-400 rounded-full animate-ping"></span>
                                Escuchando... Habla ahora
                                <span className="w-2 h-2 bg-green-400 rounded-full animate-ping"></span>
                            </p>
                            {transcript && (
                                <p className="text-white/60 text-xs mt-2">
                                    "{transcript}"
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {state === 'thinking' && (
                    <div className="mt-4 w-full max-w-3xl mx-auto">
                        <div className="bg-blue-500/20 border border-blue-500/50 rounded-2xl p-4 text-center backdrop-blur-sm">
                            <p className="text-blue-300 text-sm md:text-base font-medium flex items-center justify-center gap-2">
                                <span className="inline-block w-2 h-2 bg-blue-400 rounded-full animate-bounce"></span>
                                <span className="inline-block w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                                <span className="inline-block w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                                <span className="ml-2">Procesando tu consulta...</span>
                            </p>
                        </div>
                    </div>
                )}

                {/* VISIBLE DISCLAIMER (Always visible) */}
                <div className="mt-6 text-center">
                    <p className="text-xs text-white/30 font-medium tracking-wide border-b border-white/5 pb-1 inline-block">
                        ⚠️ La respuesta por IA puede contener errores.
                    </p>
                </div>

            </div>

            {/* MODAL - OPTIMIZADO PARA MÓVILES */}
            <AnimatePresence>
                {isModalOpen && (
                    <motion.div
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-md"
                        onClick={() => setIsModalOpen(false)}
                    >
                        {/* Modal Content - RESPONSIVE */}
                        <div className="bg-[#1e293b] rounded-2xl md:rounded-[2rem] p-6 md:p-12 max-w-4xl w-full border border-white/10 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                            <h2 className="text-2xl md:text-4xl text-white mb-6 md:mb-8 text-center md:text-left">Ejemplos de Preguntas</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                {["Vacaciones", "Seguro Médico", "Horarios", "Permisos"].map((topic, i) => (
                                    <button
                                        key={i}
                                        onClick={() => { setIsModalOpen(false); handleQuery(topic); }}
                                        className="p-6 md:p-8 bg-white/5 hover:bg-white/10 active:bg-white/15 rounded-xl md:rounded-2xl text-left text-lg md:text-2xl text-blue-200 transition-colors border border-white/5 min-h-[60px] md:min-h-auto"
                                    >
                                        {topic}
                                    </button>
                                ))}
                            </div>

                            {/* Botón cerrar para móviles */}
                            <div className="mt-6 md:mt-8 text-center">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-6 py-3 bg-white/10 hover:bg-white/15 active:bg-white/20 rounded-full text-white text-sm md:text-base transition-colors border border-white/20"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* DEBUG CONSOLE OVERLAY */}
            <div className="fixed bottom-4 left-4 z-50 pointer-events-auto">
                <button
                    onClick={() => setShowDebug(!showDebug)}
                    className="bg-gray-800/80 backdrop-blur text-white p-3 rounded-full shadow-lg border border-white/10 hover:bg-gray-700 transition-colors"
                    title="Mostrar logs de debug"
                >
                    🐞
                </button>
            </div>

            {showDebug && (
                <div className="fixed top-0 left-0 w-full h-[40vh] bg-black/95 text-green-400 p-2 z-[200] overflow-y-auto font-mono text-xs border-b border-green-500 shadow-2xl">
                    <div className="flex justify-between items-center mb-2 sticky top-0 bg-black/95 p-2 border-b border-gray-700 z-10">
                        <span className="font-bold text-sm">🖥️ DEBUG CONSOLE</span>
                        <div>
                            <button onClick={() => setDebugLogs([])} className="text-gray-400 hover:text-white px-3 py-1 mr-2 bg-gray-800 rounded">Limpiar</button>
                            <button onClick={() => setShowDebug(false)} className="text-red-400 hover:text-white px-3 py-1 bg-gray-800 rounded font-bold">X</button>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1 p-1">
                        {debugLogs.length === 0 ? (
                            <div className="text-gray-500 italic p-4 text-center">Esperando logs de actividad...</div>
                        ) : (
                            debugLogs.map((log, index) => (
                                <div key={index} className="border-b border-gray-800 pb-1 break-words flex gap-2">
                                    {log}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default VoiceChat;
