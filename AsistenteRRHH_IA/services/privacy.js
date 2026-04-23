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

export const CATEGORIES = {
    REGLAMENTO: 'reglamento',
    CONFIDENCIAL: 'confidencial',
    FUERA_DE_DOMINIO: 'fuera_de_dominio',
    CASUAL: 'casual',
    MALICIOSA: 'maliciosa'
};

const SENSITIVE_KEYWORDS = [
    // --- CATEGORÍA: CONFIDENCIAL ---
    'mi salario', 'mi sueldo', 'mi pago', 'mi nómina', 'mi contrato',
    'cuánto gano', 'cuanto gano', 'mis ingresos', 'salario exacto',
    'desprendible de pago', 'comprobante de pago',
    'salario de', 'sueldo de', 'cuánto gana', 'cuanto gana',
    'bonificación personal', 'comisión personal',
    'mi cuenta bancaria', 'mi tarjeta', 'mi nit', 'mi cédula', 'mi cedula',
    'mi dirección', 'mi telefono', 'mi correo personal'
];

const CASUAL_KEYWORDS = ['hola', 'buen día', 'buenos días', 'buenas tardes', 'buenas noches', 'gracias', 'gracias!', 'ok', 'perfecto', 'quién eres', 'quien eres'];

class PrivacyService {
    /**
     * Clasifica el contenido en uno de los 5 niveles.
     * @param {string} text Texto a analizar.
     * @param {string} aiClassification Clasificación sugerida por la IA (opcional).
     * @returns {string} Categoría final.
     */
    static classify(text, aiClassification = null) {
        if (!text || typeof text !== 'string') return CATEGORIES.MALICIOSA;

        const lowerText = text.toLowerCase().trim();

        // 1. Detección de Malicia (Heurística simple ante inyecciones o comandos)
        if (lowerText.includes('drop table') || lowerText.includes('delete from') || lowerText.includes('<script') || lowerText.startsWith('/')) {
            return CATEGORIES.MALICIOSA;
        }

        // 2. Si la IA ya clasificó, confiamos en su juicio semántico si coincide con nuestros tiers
        if (aiClassification && Object.values(CATEGORIES).includes(aiClassification)) {
            return aiClassification;
        }

        // 3. Verificación manual por Keywords (Fallback o Refuerzo)
        for (const keyword of SENSITIVE_KEYWORDS) {
            if (lowerText.includes(keyword)) return CATEGORIES.CONFIDENCIAL;
        }

        for (const casual of CASUAL_KEYWORDS) {
            if (lowerText === casual || lowerText.startsWith(casual + ' ')) {
                // Solo si es predominantemente casual
                if (lowerText.length < casual.length + 10) return CATEGORIES.CASUAL;
            }
        }

        // Por defecto, si llegamos aquí y no hay una consulta del RIT clara, 
        // la IA debería haber determinado si es reglamento o fuera_de_dominio.
        return CATEGORIES.REGLAMENTO;
    }

    /**
     * Determina si un par pregunta+respuesta es seguro para persistir en SQLite.
     * SOLO la categoría 'reglamento' es segura para el Knowledge DB.
     *
     * @param {string} category Categoría detectada
     * @returns {boolean} true = seguro para guardar
     */
    static isSafeToCache(category) {
        return category === CATEGORIES.REGLAMENTO;
    }
}

export default PrivacyService;
