/**
 * PrivacyService
 * 
 * Responsable de clasificar si una consulta o respuesta contiene datos sensibles
 * que NO deben ser almacenados en la caché local (SQLite).
 */

const SENSITIVE_KEYWORDS = [
    'salario', 'sueldo', 'pago', 'nómina', 'desprendible', 'bonificación',
    'comisión', 'prestación', 'cesantía', 'documento', 'cédula', 'nit',
    'pasaporte', 'correo', 'email', 'teléfono', 'celular', 'dirección',
    'contrato', 'cláusula', 'disciplinario', 'sanción', 'falta',
    'incapacidad', 'médico', 'eps', 'arl', 'afp', 'pensión',
    'cuenta bancaria', 'clabe', 'tarjeta', 'financiero', 'deuda',
    'personal', 'privado', 'confidencial', 'cuánto gano', 'cuanto gano',
    'mis ingresos', 'mi sueldo', 'mi salario', 'pago de nómina'
];

const SENSITIVE_PATTERNS = [
    /\b\d{7,10}\b/g, // Posibles números de documento
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Emails
    /\b(?:\d[ -]*?){10}\b/g, // Posibles números de teléfono
    /\b(?:\d[ -]*?){16}\b/g, // Posibles números de tarjeta
    /\b(?:\d+\.?\d*)\b/g // Números genéricos (potencialmente salarios o fechas específicas)
];

class PrivacyService {
    /**
     * Clasifica el contenido como 'general' o 'sensitive'.
     * @param {string} text Texto a validar (pregunta o respuesta).
     * @returns {string} 'general' | 'sensitive'
     */
    static classify(text) {
        if (!text) return 'sensitive';
        const lowerText = text.toLowerCase();

        // 1. Verificación por palabras clave
        for (const keyword of SENSITIVE_KEYWORDS) {
            if (lowerText.includes(keyword)) {
                return 'sensitive';
            }
        }

        // 2. Verificación por patrones (RegEx)
        for (const pattern of SENSITIVE_PATTERNS) {
            if (pattern.test(text)) {
                return 'sensitive';
            }
        }

        return 'general';
    }

    /**
     * Determina si un par pregunta-respuesta es seguro para cachear.
     * @param {string} question 
     * @param {string} answer 
     * @returns {boolean}
     */
    static isSafeToCache(question, answer) {
        return this.classify(question) === 'general' && this.classify(answer) === 'general';
    }
}

export default PrivacyService;
