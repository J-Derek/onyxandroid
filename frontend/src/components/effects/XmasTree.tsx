import { motion } from "framer-motion";

interface XmasTreeProps {
    size?: number;
}

export function XmasTree({ size = 200 }: XmasTreeProps) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative flex items-center justify-center"
            style={{ width: size, height: size * 1.2 }}
        >
            <svg
                viewBox="0 0 100 120"
                className="w-full h-full drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
            >
                {/* Trunk with Texture */}
                <rect x="44" y="100" width="12" height="15" fill="#451a03" />
                <rect x="44" y="100" width="4" height="15" fill="#713f12" opacity="0.3" />

                {/* Bottom Layer - Pine Texture */}
                <path d="M10 100 L50 40 L90 100 Z" fill="#064e3b" />
                <path d="M15 100 L50 50 L85 100 Z" fill="#14532d" />
                {/* Snow Dusting on Bottom */}
                <path d="M10 100 Q 20 95 30 100 Q 40 95 50 100 Q 60 95 70 100 Q 80 95 90 100" fill="none" stroke="white" strokeWidth="2" opacity="0.2" />

                {/* Middle Layer */}
                <path d="M20 75 L50 25 L80 75 Z" fill="#065f46" />
                <path d="M25 75 L50 35 L75 75 Z" fill="#166534" />
                {/* Snow Dusting Middle */}
                <path d="M20 75 Q 35 70 50 75 Q 65 70 80 75" fill="none" stroke="white" strokeWidth="1.5" opacity="0.15" />

                {/* Top Layer */}
                <path d="M30 45 L50 10 L70 45 Z" fill="#059669" />
                <path d="M35 45 L50 20 L65 45 Z" fill="#15803d" />

                {/* Realistic Star (React Symbol Inspiration) */}
                <motion.g
                    animate={{
                        rotate: 360,
                        filter: ["drop-shadow(0 0 5px #fde047)", "drop-shadow(0 0 15px #fbbf24)", "drop-shadow(0 0 5px #fde047)"]
                    }}
                    transition={{ rotate: { duration: 10, repeat: Infinity, ease: "linear" }, filter: { duration: 2, repeat: Infinity } }}
                >
                    <path
                        d="M50 0 L55 10 L65 10 L57 16 L60 26 L50 20 L40 26 L43 16 L35 10 L45 10 Z"
                        fill="#facc15"
                    />
                    <circle cx="50" cy="13" r="1.5" fill="white" />
                </motion.g>

                {/* Detailed Ornaments */}
                {[
                    { x: 35, y: 85, color: "#ef4444", delay: 0 },
                    { x: 65, y: 85, color: "#3b82f6", delay: 0.5 },
                    { x: 50, y: 65, color: "#fbbf24", delay: 1 },
                    { x: 40, y: 55, color: "#ec4899", delay: 1.5 },
                    { x: 60, y: 55, color: "#8b5cf6", delay: 2 },
                ].map((orn, i) => (
                    <g key={i}>
                        <motion.circle
                            cx={orn.x}
                            cy={orn.y}
                            r="3"
                            fill={orn.color}
                            animate={{ filter: ["brightness(1)", "brightness(1.3)", "brightness(1)"] }}
                            transition={{ duration: 2, repeat: Infinity, delay: orn.delay }}
                        />
                        {/* Highlight on ornament */}
                        <circle cx={orn.x - 1} cy={orn.y - 1} r="0.8" fill="white" opacity="0.6" />
                    </g>
                ))}

                {/* Garland */}
                <motion.path
                    d="M32 48 Q 50 55 68 48"
                    fill="none"
                    stroke="#fde047"
                    strokeWidth="0.5"
                    strokeDasharray="1 2"
                    animate={{ opacity: [0.3, 0.8, 0.3] }}
                    transition={{ duration: 3, repeat: Infinity }}
                />
                <motion.path
                    d="M22 78 Q 50 88 78 78"
                    fill="none"
                    stroke="#fde047"
                    strokeWidth="0.5"
                    strokeDasharray="1 2"
                    animate={{ opacity: [0.3, 0.8, 0.3] }}
                    transition={{ duration: 3, repeat: Infinity, delay: 1 }}
                />
            </svg>
        </motion.div>
    );
}
