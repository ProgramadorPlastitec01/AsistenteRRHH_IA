/**
 * PrivacyService
 *
 * Clasifica si una consulta o respuesta contiene datos sensibles
 * que NO deben almacenarse en la caché SQLite.
 *
 * CORRECCIÓN: Los RegExp ya NO usan flag `g` como literales de objeto.
 * Con el flag `g`, los objetos RegEx son stateful (lastIndex persiste entre
 * llamadas), lo que causaba que test() alternara entre true/false de forma
 * impredecible en invocaciones sucesivas con el mismo patrón.
 */

const SENSITIVE_KEYWORDS = [
    'salario', 'sueldo', 'nómina', 'nomina', 'desprendible', 'bonificación', 'bonificacion',
    'comisión', 'comision', 'prestación', 'prestacion', 'cesantía', 'cesantia',
    'documento', 'cédula', 'cedula', 'nit', 'pasaporte',
    'correo', 'email', 'teléfono', 'telefono', 'celular', 'dirección', 'direccion',
    'contrato', 'cláusula', 'clausula', 'disciplinario', 'sanción', 'sancion', 'falta',
    'incapacidad', 'médico', 'medico', 'eps', 'arl', 'afp', 'pensión', 'pension',
    'cuenta bancaria', 'clabe', 'tarjeta', 'financiero', 'deuda',
    'personal', 'privado', 'confidencial',
    'cuánto gano', 'cuanto gano', 'mis ingresos', 'mi sueldo', 'mi salario',
    'pago de nómina', 'pago de nomina', 'mi pago', 'mi contrato'
];

/**
 * Patrones RegEx para detectar datos estructurados sensibles.
 *
 * ⚠️ IMPORTANTE — Sin flag `g`:
 * Los RegExp literales con flag `g` son stateful por su propiedad `lastIndex`.
 * Al estar en un array de módulo, se reutilizan entre llamadas y pueden
 * retornar resultados alternos (true → false → true...) con la misma cadena.
 * La solución es NO usar flag `g` cuando solo se necesita .test().
 */
const SENSITIVE_PATTERNS = [
    /\b\d{7,10}\b/,        // Números de documento de identidad
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/, // Emails
    /\b\d[\d -]{8,}\d\b/,  // Números de teléfono (10+ dígitos con posibles espacios/guiones)
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Números de tarjeta (16 dígitos)
];

class PrivacyService {
    /**
     * Clasifica el contenido como 'general' o 'sensitive'.
     * @param {string} text Texto a analizar (pregunta o respuesta).
     * @returns {'general'|'sensitive'}
     */
    static classify(text) {
        if (!text || typeof text !== 'string') return 'sensitive';
        const lowerText = text.toLowerCase();

        // 1. Verificación rápida por palabras clave (O(n) sobre keywords)
        for (const keyword of SENSITIVE_KEYWORDS) {
            if (lowerText.includes(keyword)) {
                return 'sensitive';
            }
        }

        // 2. Verificación por patrones estructurados (sin flag g → siempre stateless)
        for (const pattern of SENSITIVE_PATTERNS) {
            if (pattern.test(text)) {
                return 'sensitive';
            }
        }

        return 'general';
    }

    /**
     * Determina si un par pregunta+respuesta es seguro para persistir en SQLite.
     * Ambos (pregunta Y respuesta) deben ser 'general' para aprobar.
     *
     * @param {string} question
     * @param {string} answer
     * @returns {boolean} true = seguro para guardar
     */
    static isSafeToCache(question, answer) {
        const qClass = this.classify(question);
        const aClass = this.classify(answer);

        if (qClass !== 'general') {
            console.log(`⛔ [Privacidad] Pregunta clasificada como sensible: "${question.substring(0, 50)}..."`);
            return false;
        }
        if (aClass !== 'general') {
            console.log(`⛔ [Privacidad] Respuesta clasificada como sensible (contiene datos personales).`);
            return false;
        }

        return true;
    }
}

export default PrivacyService;
