import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo } from "react";
import { Power } from "lucide-react";

export function HolidayLights() {
    const [isOn, setIsOn] = useState(true);
    const lightsCount = 18; // More lights for closer density

    // Memoize random values to avoid jitters on re-renders
    const lightData = useMemo(() => {
        return Array.from({ length: lightsCount }).map((_, i) => ({
            rotation: (Math.random() - 0.5) * 40, // Random tilt between -20 and 20 deg
            delay: Math.random() * 5,
            duration: 2 + Math.random() * 2,
        }));
    }, []);

    return (
        <>
            <div className="fixed top-0 left-0 w-full overflow-hidden pointer-events-none z-40 h-32">
                <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
                    {/* Thick Dark Wire (Google Doodle Style) */}
                    <motion.path
                        d={`M 0 -2 C 100 45 300 15 500 35 C 700 15 900 45 1100 -2`}
                        fill="none"
                        stroke="#0f172a"
                        strokeWidth="3.5"
                        animate={{
                            d: [
                                `M 0 -2 C 100 47 300 17 500 37 C 700 17 900 47 1100 -2`,
                                `M 0 -2 C 100 43 300 13 500 33 C 700 13 900 43 1100 -2`,
                                `M 0 -2 C 100 47 300 17 500 37 C 700 17 900 47 1100 -2`
                            ]
                        }}
                        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                    />
                    {/* Highlight on wire */}
                    <motion.path
                        d={`M 0 -2 C 100 45 300 15 500 35 C 700 15 900 45 1100 -2`}
                        fill="none"
                        stroke="#1e293b"
                        strokeWidth="1"
                        animate={{
                            d: [
                                `M 0 -2 C 100 47 300 17 500 37 C 700 17 900 47 1100 -2`,
                                `M 0 -2 C 100 43 300 13 500 33 C 700 13 900 43 1100 -2`,
                                `M 0 -2 C 100 47 300 17 500 37 C 700 17 900 47 1100 -2`
                            ]
                        }}
                        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                        style={{ opacity: 0.5 }}
                    />
                </svg>

                <div className="absolute inset-x-0 top-0 flex justify-between px-10">
                    {lightData.map((light, i) => {
                        const bulbColors = [
                            { main: "#ff0000", glow: "#ff3333", accent: "#ffcccc" }, // Red
                            { main: "#00ff33", glow: "#33ff66", accent: "#ccffdd" }, // Green
                            { main: "#0066ff", glow: "#3399ff", accent: "#cceeff" }, // Blue
                            { main: "#ffcc00", glow: "#ffee33", accent: "#fff9cc" }, // Gold/Yellow
                            { main: "#ff33cc", glow: "#ff66dd", accent: "#ffccf2" }, // Pink
                        ];
                        const color = bulbColors[i % bulbColors.length];

                        return (
                            <div
                                key={i}
                                className="relative mt-8"
                                style={{ transform: `rotate(${light.rotation}deg)` }}
                            >
                                {/* The "Plug" connecting to wire */}
                                <div className="w-2.5 h-3 bg-[#0f172a] mx-auto -mb-1 rounded-t-full shadow-inner relative z-10" />

                                {/* Google Doodle Teardrop Bulb */}
                                <motion.div
                                    className="w-5 h-8 cursor-pointer pointer-events-auto relative"
                                    style={{
                                        borderRadius: "50% 50% 50% 50% / 80% 80% 40% 40%",
                                        background: isOn
                                            ? `radial-gradient(circle at 40% 30%, ${color.accent} 0%, ${color.main} 45%, ${color.glow} 100%)`
                                            : `radial-gradient(circle at 40% 30%, #475569 0%, #1e293b 100%)`, // Realistic glass
                                        boxShadow: isOn ? `0 0 35px 12px ${color.glow}66` : "none",
                                    }}
                                    animate={isOn ? {
                                        opacity: [0.9, 1, 0.95, 1, 0.9],
                                        filter: [
                                            `brightness(1.5) drop-shadow(0 0 10px ${color.glow})`,
                                            `brightness(2.5) drop-shadow(0 0 25px ${color.glow})`,
                                            `brightness(2.0) drop-shadow(0 0 15px ${color.glow})`,
                                            `brightness(2.8) drop-shadow(0 0 35px ${color.glow})`,
                                            `brightness(1.5) drop-shadow(0 0 10px ${color.glow})`
                                        ]
                                    } : { opacity: 0.7 }}
                                    whileHover={isOn ? {
                                        scale: 1.4,
                                        filter: `brightness(3.5) drop-shadow(0 0 50px ${color.glow})`,
                                        transition: { type: "spring", stiffness: 300, damping: 12 }
                                    } : { scale: 1.15 }}
                                    transition={{
                                        duration: light.duration,
                                        repeat: Infinity,
                                        delay: light.delay,
                                    }}
                                >
                                    {/* Secondary bloom for softness */}
                                    {isOn && (
                                        <div
                                            className="absolute inset-0 blur-xl opacity-40 rounded-full"
                                            style={{ backgroundColor: color.glow }}
                                        />
                                    )}

                                    {/* Glass Reflection Streak */}
                                    <div
                                        className="absolute top-1.5 left-1.5 w-1.5 h-3 bg-white/40 blur-[0.5px] rounded-full"
                                        style={{ transform: 'rotate(-20deg)' }}
                                    />

                                    {/* Intense Highlight Dot */}
                                    <div className="absolute top-2 left-2 w-1 h-1 bg-white rounded-full blur-[0.2px] opacity-90" />
                                </motion.div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Realistic Light Switch (Master) - OUTSIDE the lowered z-index container */}
            <motion.div
                className="fixed top-24 right-8 z-[101] pointer-events-auto"
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 1 }}
            >
                <button
                    onClick={() => setIsOn(!isOn)}
                    className={`flex items-center gap-3 px-4 py-2 rounded-xl glass border transition-all duration-500 hover:scale-105 active:scale-95 group ${isOn
                        ? "border-amber-400/50 bg-amber-400/10 shadow-[0_0_20px_rgba(251,191,36,0.2)]"
                        : "border-white/10 bg-white/5 grayscale"
                        }`}
                >
                    <div className="relative">
                        <Power className={`w-5 h-5 transition-colors duration-500 ${isOn ? "text-amber-400" : "text-zinc-500"}`} />
                        {isOn && (
                            <motion.div
                                layoutId="switch-glow"
                                className="absolute inset-0 bg-amber-400 blur-md opacity-50"
                            />
                        )}
                    </div>
                    <div className="flex flex-col items-start leading-tight">
                        <span className={`text-[10px] uppercase tracking-widest font-bold ${isOn ? "text-amber-400" : "text-zinc-500"}`}>
                            Holiday Mood
                        </span>
                        <span className="text-xs font-medium text-white">
                            {isOn ? "LIGHTS ON" : "LIGHTS OFF"}
                        </span>
                    </div>
                </button>
            </motion.div>
        </>
    );
}
