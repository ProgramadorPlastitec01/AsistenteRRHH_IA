/**
 * IntentEngine.js
 * Motor de clasificación de intención ligera basado en reglas (Rule-Based NLU).
 * Objetivo: Responder en <5ms a interacciones triviales sin tocar la red.
 */

const QUICK_RESPONSES = {
    greeting: [
        "¡Hola! 👋 Soy tu asistente de RRHH IA. ¿En qué puedo ayudarte hoy?",
        "¡Bienvenido! Estoy listo para responder tus dudas sobre el reglamento interno.",
        "¡Hola! Cuéntame, ¿qué necesitas saber sobre tus beneficios o normativas?"
    ],
    identity: [
        "Hola, soy el Asistente Virtual de RRHH IA del Departamento de Desarrollo y el Área de TI. Mi función es guiarte a través de las políticas internas y beneficios de la empresa.",
        "Este es un sistema de inteligencia artificial entrenado con los documentos oficiales de Recursos Humanos para responder tus dudas al instante."
    ],
    capabilities: [
        "Puedo informarte sobre: \n1. Vacaciones y permisos. \n2. Seguros médicos. \n3. Horarios y home office. \n4. Código de vestimenta y conducta.",
        "Estoy capacitado para responder dudas sobre el reglamento interno, procesos de solicitud de vacaciones, licencias médicas y beneficios corporativos."
    ],
    gratitude: [
        "¡Es un placer ayudarte! 😊",
        "¡De nada! Aquí estaré si necesitas algo más.",
        "¡Para eso estamos! Que tengas un excelente día."
    ],
    goodbye: [
        "¡Hasta luego! Que tengas una buena jornada.",
        "¡Adiós! No dudes en volver si tienes más preguntas."
    ],
    emergency: [
        "Para emergencias médicas o de seguridad, por favor contacta inmediatamente al 911 o al supervisor de planta. ¿Necesitas el número de RRHH directo?"
    ],
    unknown: [
        "No estoy seguro de entender. ¿Podrías reformular tu pregunta sobre temas de RRHH?"
    ]
};

const KNOWLEDGE_BASE = [];

// Normalizador de texto para mejorar el matching
const normalize = (text) => {
    return text
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "") // Eliminar puntuación
        .trim();
};

const getRandomResponse = (key) => {
    const responses = QUICK_RESPONSES[key];
    return responses[Math.floor(Math.random() * responses.length)];
};

class IntentEngine {
    analyze(text) {
        if (!text || text.length < 2) return { type: 'void', response: null };

        const normalized = normalize(text);

        // 1. Detección de Saludos
        if (/^(hola|buenos dias|buenas tardes|buenas noches|que tal|hi|hello)$/.test(normalized) ||
            normalized.startsWith('hola ')) {
            return { type: 'greeting', response: getRandomResponse('greeting'), confidence: 1.0 };
        }

        // 2. Detección de Identidad
        if (/(quien eres|como te llamas|cual es tu nombre|presentate)/.test(normalized)) {
            return { type: 'identity', response: getRandomResponse('identity'), confidence: 1.0 };
        }

        // 4. Capacidades (Meta-preguntas)
        if (/(que puedes hacer|que sabes|en que ayudas|para que sirves|para que sirve|ayuda|help|menu|opciones)/.test(normalized)) {
            return { type: 'capabilities', response: getRandomResponse('capabilities'), confidence: 1.0 };
        }

        // 5. Agradecimiento
        if (/(gracias|te agradezco|muy amable|ok gracias)/.test(normalized)) {
            return { type: 'gratitude', response: getRandomResponse('gratitude'), confidence: 1.0 };
        }

        // 6. Despedida
        if (/(adios|chao|hasta luego|nos vemos|bye|cerrar)/.test(normalized)) {
            return { type: 'goodbye', response: getRandomResponse('goodbye'), confidence: 1.0 };
        }

        // 7. Emergencia (Filtro de seguridad básico)
        if (/(accidente|fuego|incendio|policia|ambulancia|robo|emergencia)/.test(normalized)) {
            return { type: 'emergency', response: getRandomResponse('emergency'), confidence: 1.0 };
        }

        // Si no coincide con nada trivial, delegamos a NotebookLM (Backend)
        return { type: 'unknown', response: null, confidence: 0 };
    }
}

export default new IntentEngine();
