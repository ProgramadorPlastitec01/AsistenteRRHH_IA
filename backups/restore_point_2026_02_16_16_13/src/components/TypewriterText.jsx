import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const TypewriterText = ({ text, speed = 15 }) => {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        setIndex(0);
        if (!text) return;

        const interval = setInterval(() => {
            setIndex((prev) => {
                if (prev < text.length) return prev + 1;
                clearInterval(interval);
                return prev;
            });
        }, speed);

        return () => clearInterval(interval);
    }, [text, speed]);

    return (
        <span className="inline leading-relaxed">
            {text.slice(0, index)}
            {index < text.length && (
                <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    className="inline-block w-2 h-5 ml-1 bg-blue-400 align-middle"
                />
            )}
        </span>
    );
};

export default TypewriterText;
