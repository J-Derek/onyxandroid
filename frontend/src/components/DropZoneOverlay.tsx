import { motion, AnimatePresence } from "framer-motion";
import { Upload } from "lucide-react";

interface DropZoneOverlayProps {
    isVisible: boolean;
}

export function DropZoneOverlay({ isVisible }: DropZoneOverlayProps) {
    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
                >
                    {/* Animated border */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="relative flex flex-col items-center justify-center w-[80%] max-w-2xl h-64 rounded-2xl"
                        style={{
                            background: "linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.1))",
                        }}
                    >
                        {/* Animated gradient border */}
                        <div className="absolute inset-0 rounded-2xl p-[2px] overflow-hidden">
                            <motion.div
                                animate={{
                                    rotate: 360,
                                }}
                                transition={{
                                    duration: 3,
                                    repeat: Infinity,
                                    ease: "linear",
                                }}
                                className="absolute inset-[-100%] bg-gradient-conic from-primary via-pink-500 to-primary"
                            />
                            <div className="absolute inset-[2px] rounded-2xl bg-background" />
                        </div>

                        {/* Content */}
                        <div className="relative z-10 flex flex-col items-center gap-4">
                            <motion.div
                                animate={{
                                    y: [0, -10, 0],
                                }}
                                transition={{
                                    duration: 1.5,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                }}
                            >
                                <div className="p-4 rounded-full bg-primary/20">
                                    <Upload className="w-12 h-12 text-primary" />
                                </div>
                            </motion.div>
                            <div className="text-center">
                                <h3 className="text-2xl font-bold text-foreground mb-2">
                                    Drop YouTube URL Here
                                </h3>
                                <p className="text-muted-foreground">
                                    Release to start checking the video
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
