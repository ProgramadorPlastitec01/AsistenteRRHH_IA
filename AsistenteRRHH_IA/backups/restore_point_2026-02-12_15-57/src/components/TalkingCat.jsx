import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

const TalkingCat = ({ status, volume }) => {
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (e) => {
            setMousePos({
                x: (e.clientX / window.innerWidth - 0.5) * 2,
                y: (e.clientY / window.innerHeight - 0.5) * 2
            });
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // 3D-like eye and head dynamics
    const eyeX = status === 'thinking' ? [-4, 4, -4] : mousePos.x * 6;
    const eyeY = status === 'thinking' ? -10 : mousePos.y * 4;
    const headRotate = status === 'listening' ? -10 : status === 'thinking' ? 6 : mousePos.x * 3;

    return (
        <div className="relative w-full h-full flex items-center justify-center pointer-events-none drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <motion.svg
                viewBox="0 0 400 400"
                className="w-full h-full relative z-10"
                initial="idle"
                animate={status}
            >
                <defs>
                    {/* Advanced 3D Lighting Gradients */}
                    <radialGradient id="catSkin" cx="45%" cy="35%" r="65%">
                        <stop offset="0%" stopColor="#ffca7a" />
                        <stop offset="40%" stopColor="#f3a73c" />
                        <stop offset="100%" stopColor="#c26d18" />
                    </radialGradient>

                    <radialGradient id="catSkinShadow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#c26d18" stopOpacity="0" />
                        <stop offset="100%" stopColor="#8a4d11" stopOpacity="0.8" />
                    </radialGradient>

                    <radialGradient id="eyeDeep" cx="40%" cy="30%" r="70%">
                        <stop offset="0%" stopColor="#2c3e50" />
                        <stop offset="100%" stopColor="#000" />
                    </radialGradient>

                    <linearGradient id="scrubsBody" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#064e3b" />
                    </linearGradient>

                    <filter id="renderBlur" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="0.8" />
                    </filter>

                    <filter id="innerShadow">
                        <feOffset dx="0" dy="2" />
                        <feGaussianBlur stdDeviation="3" result="offset-blur" />
                        <feComposite operator="out" in="SourceAlpha" in2="offset-blur" result="inverse" />
                        <feFlood floodColor="black" floodOpacity="0.4" result="color" />
                        <feComposite operator="in" in="color" in2="inverse" result="shadow" />
                        <feComposite operator="over" in="shadow" in2="SourceGraphic" />
                    </filter>
                </defs>

                {/* AMBIENT SHADOW ON FLOOR */}
                <ellipse cx="200" cy="380" rx="80" ry="15" fill="black" opacity="0.2" filter="url(#renderBlur)" />

                {/* BODY LUNGS (Breathing) */}
                <motion.g
                    animate={{ scale: [1, 1.02, 1], y: [0, -2, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                >
                    {/* Scuplted Paws/Legs */}
                    <path d="M165 330 Q165 375 195 375 Q210 375 210 330" fill="#064e3b" />
                    <path d="M205 330 Q205 375 235 375 Q250 375 250 330" fill="#064e3b" />

                    {/* Main Body (Scrubs) */}
                    <path
                        d="M140 250 Q140 215 200 215 Q260 215 260 250 L260 350 Q200 365 140 350 Z"
                        fill="url(#scrubsBody)"
                        filter="url(#innerShadow)"
                    />

                    {/* Scrub Details (V-Neck) */}
                    <path d="M175 215 L200 255 L225 215" fill="#f3a73c" />
                    <rect x="220" y="270" width="25" height="15" rx="3" fill="#ffffff20" />

                    {/* Stethoscope */}
                    <path d="M185 220 Q180 270 200 290 Q225 300 240 275" fill="none" stroke="#2c3e50" strokeWidth="5" strokeLinecap="round" />
                    <circle cx="240" cy="285" r="10" fill="#cbd5e1" stroke="#1e293b" strokeWidth="2" />
                </motion.g>

                {/* THE HEAD (The most sculpted part) */}
                <motion.g
                    animate={{
                        rotate: headRotate,
                        y: status === 'listening' ? 12 : status === 'thinking' ? -5 : 0
                    }}
                    style={{ originX: "200px", originY: "230px" }}
                >
                    {/* Sculpted Ears */}
                    <g>
                        <path d="M125 105 Q110 20 185 85 Z" fill="url(#catSkin)" stroke="#8a4d11" strokeWidth="1" />
                        <path d="M275 105 Q290 20 215 85 Z" fill="url(#catSkin)" stroke="#8a4d11" strokeWidth="1" />
                    </g>

                    {/* Main Head Shape (Complex Path for real volume) */}
                    <path
                        d="M106 160 Q106 70 200 70 Q294 70 294 160 Q294 250 200 250 Q106 250 106 160"
                        fill="url(#catSkin)"
                        filter="url(#innerShadow)"
                    />

                    {/* Shading layer for depth */}
                    <path
                        d="M106 160 Q106 70 200 70 Q294 70 294 160 Q294 250 200 250 Q106 250 106 160"
                        fill="url(#catSkinShadow)"
                        opacity="0.4"
                    />

                    {/* Forehead Stripe */}
                    <path d="M185 70 Q200 110 215 70" fill="#2c3e50" opacity="0.3" />

                    {/* EYES (Multi-layered 3D) */}
                    <motion.g filter="url(#innerShadow)">
                        {/* Left Eye */}
                        <g transform="translate(155, 145)">
                            <circle r="36" fill="url(#eyeDeep)" stroke="#000" strokeWidth="2" />
                            <motion.circle
                                r="14" fill="#3b82f6"
                                animate={{ x: eyeX, y: eyeY }}
                                transition={status === 'thinking' ? { repeat: Infinity, duration: 1.2 } : { type: "spring", stiffness: 120, damping: 15 }}
                            />
                            {/* Eye Shine */}
                            <circle cx="-12" cy="-12" r="10" fill="white" opacity="0.9" />
                            <circle cx="8" cy="12" r="4" fill="white" opacity="0.3" />
                        </g>
                        {/* Right Eye */}
                        <g transform="translate(245, 145)">
                            <circle r="36" fill="url(#eyeDeep)" stroke="#000" strokeWidth="2" />
                            <motion.circle
                                r="14" fill="#3b82f6"
                                animate={{ x: eyeX, y: eyeY }}
                                transition={status === 'thinking' ? { repeat: Infinity, duration: 1.2 } : { type: "spring", stiffness: 120, damping: 15 }}
                            />
                            {/* Eye Shine */}
                            <circle cx="-12" cy="-12" r="10" fill="white" opacity="0.9" />
                            <circle cx="8" cy="12" r="4" fill="white" opacity="0.3" />
                        </g>
                    </motion.g>

                    {/* SNOUT & NOSE (Very rounded) */}
                    <g transform="translate(200, 205)">
                        <circle cx="-15" cy="5" r="18" fill="#ffca7a" opacity="0.8" />
                        <circle cx="15" cy="5" r="18" fill="#ffca7a" opacity="0.8" />

                        {/* Tiny pink nose */}
                        <path d="M-8 -6 L8 -6 Q0 5 0 2 Z" fill="#fb7185" stroke="#be123c" strokeWidth="1" />

                        {/* MOUTH (Voice React) */}
                        <motion.ellipse
                            cx="0" cy="18"
                            rx="12"
                            ry={status === 'speaking' ? Math.max(1, volume / 1.5) : 1}
                            fill={status === 'speaking' ? "#881337" : "none"}
                            stroke={status === 'speaking' ? "none" : "#c26d18"}
                            strokeWidth="2"
                        />
                    </g>

                    {/* WHISKERS (Natural flow) */}
                    <g stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" opacity="0.6">
                        <line x1="120" y1="190" x2="70" y2="185" />
                        <line x1="120" y1="210" x2="70" y2="215" />
                        <line x1="280" y1="190" x2="330" y2="185" />
                        <line x1="280" y1="210" x2="330" y2="215" />
                    </g>
                </motion.g>

                {/* PAWS (Morphing between states) */}
                {/* Left Active Paw */}
                <motion.g
                    animate={
                        status === 'listening' ? { x: -35, y: -110, rotate: -45 } :
                            status === 'speaking' ? { y: [0, -15, 0], transition: { repeat: Infinity, duration: 1.8 } } :
                                { x: 0, y: 0, rotate: 0 }
                    }
                >
                    <circle cx="130" cy="270" r="22" fill="#fff" stroke="#c26d18" strokeWidth="2" />
                    <motion.text
                        x="124" y="278" fontSize="20"
                        animate={{ opacity: status === 'listening' ? 1 : 0 }}
                    >👂</motion.text>
                </motion.g>

                {/* Right Active Paw */}
                <motion.g
                    animate={
                        status === 'thinking' ? { x: -45, y: -65, rotate: -20 } :
                            status === 'speaking' ? { y: [0, -15, 0], transition: { repeat: Infinity, duration: 1.8, delay: 0.4 } } :
                                { x: 0, y: 0, rotate: 0 }
                    }
                >
                    <circle cx="270" cy="270" r="22" fill="#fff" stroke="#c26d18" strokeWidth="2" />
                    <motion.line
                        x1="270" y1="270" x2="350" y2="200"
                        stroke="#fb7185" strokeWidth="6" strokeLinecap="round"
                        animate={{ opacity: status === 'idle' ? 1 : 0 }}
                    />
                </motion.g>
            </motion.svg>

            {/* THINKING CLOUD */}
            <AnimatePresence>
                {status === 'thinking' && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0, rotate: -20 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        exit={{ opacity: 0, scale: 0 }}
                        className="absolute top-2 right-20 z-30"
                    >
                        <div className="bg-white/90 backdrop-blur-md px-6 py-4 rounded-[40px] shadow-[0_15px_30px_rgba(0,0,0,0.3)] border-2 border-primary-400 text-4xl">
                            🔎
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default TalkingCat;
