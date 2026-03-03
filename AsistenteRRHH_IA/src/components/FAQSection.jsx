import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../utils/apiConfig';

/**
 * FAQSection — Componente independiente.
 * Muestra las top-5 preguntas frecuentes validadas del sistema de aprendizaje.
 * Solo visible en estado IDLE sin respuesta activa.
 * Clic en ítem dispara la consulta directamente.
 */
const FAQSection = ({ onSelect }) => {
    const [faqs, setFaqs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${API_BASE_URL}/api/faq`)
            .then(r => r.json())
            .then(data => {
                if (data.faqs && data.faqs.length > 0) setFaqs(data.faqs);
            })
            .catch(() => { }) // silencioso: no romper UI si el endpoint falla
            .finally(() => setLoading(false));
    }, []);

    if (loading || faqs.length === 0) return null;

    return (
        <div className="mt-8 w-full max-w-2xl mx-auto">
            {/* Encabezado discreto */}
            <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-grow bg-white/5" />
                <span className="text-[9px] text-white/20 uppercase tracking-widest font-bold px-2">
                    Preguntas Frecuentes Validadas
                </span>
                <div className="h-px flex-grow bg-white/5" />
            </div>

            {/* Pills de FAQs */}
            <div className="flex flex-wrap gap-2 justify-center">
                {faqs.map((faq) => (
                    <button
                        key={faq.id}
                        onClick={() => onSelect(faq.question_original)}
                        className="group flex items-center gap-1.5 px-3 py-1.5 bg-white/3 hover:bg-blue-500/10 border border-white/8 hover:border-blue-500/25 rounded-full text-[11px] text-white/35 hover:text-white/70 transition-all duration-200 active:scale-95"
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500/40 group-hover:bg-blue-400/80 transition-colors flex-shrink-0" />
                        <span className="truncate max-w-[220px]">{faq.question_original}</span>
                        {faq.usage_count >= 10 && (
                            <span className="text-[8px] bg-amber-500/15 border border-amber-500/20 text-amber-400/70 px-1 py-0.5 rounded font-bold">
                                ★
                            </span>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default FAQSection;
