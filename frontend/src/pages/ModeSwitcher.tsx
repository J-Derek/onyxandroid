/**
 * Onyx - Mode Switcher
 * Entry point to choose between Download, Streaming, and Party modes
 */
import { motion } from "framer-motion";
import { Download, Music, Sparkles, PartyPopper, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function ModeSwitcher() {
    const navigate = useNavigate();
    const { isAuthenticated, isLoading, user } = useAuth();

    const handleStreamingClick = () => {
        if (isAuthenticated) {
            navigate("/streaming");
        } else {
            navigate("/login?returnUrl=/streaming");
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-950 to-black">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-background p-4 relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute inset-0 -z-10">
                <div className="absolute top-1/3 left-1/4 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[150px]" />
                <div className="absolute bottom-1/4 right-1/3 w-[500px] h-[500px] rounded-full bg-accent/10 blur-[120px]" />
            </div>
            {/* Auth Header */}
            <header className="flex justify-end p-4">
                {isAuthenticated && user ? (
                    <button
                        onClick={() => navigate("/streaming")}
                        className="flex items-center gap-2 px-4 py-2 rounded-full glass hover:bg-white/10 transition-colors"
                    >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-black font-bold text-sm">
                            {user.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium">{user.username}</span>
                    </button>
                ) : (
                    <button
                        onClick={() => navigate("/login?returnUrl=/")}
                        className="flex items-center gap-2 px-4 py-2 rounded-full glass hover:bg-white/10 transition-colors text-sm font-medium"
                    >
                        <User className="w-4 h-4" />
                        Register / Sign In
                    </button>
                )}
            </header>

            {/* Main Content - Centered */}
            <div className="flex-1 flex flex-col items-center justify-center">
                {/* Logo */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="mb-12"
                >
                    <img
                        src="/onyx-prism-v3.png"
                        alt="Onyx"
                        className="w-24 h-24 drop-shadow-[0_0_20px_rgba(34,211,238,0.4)]"
                    />
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-5xl md:text-6xl font-bold mb-4 text-center tracking-tight"
                >
                    Welcome to <span className="text-primary">Onyx</span>
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-xl text-muted-foreground mb-12 text-center max-w-xl"
                >
                    Choose your experience
                </motion.p>

                {/* Mode Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-4xl">
                    {/* Download Mode */}
                    <motion.button
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => navigate("/download")}
                        className="glass rounded-2xl p-6 text-left hover:bg-white/5 transition-colors group"
                    >
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Download className="w-6 h-6 text-white" />
                        </div>
                        <h2 className="text-lg font-bold mb-2">Download</h2>
                        <p className="text-xs text-muted-foreground">
                            Download videos and audio from YouTube. Quick and simple.
                        </p>
                    </motion.button>

                    {/* Streaming Mode */}
                    <motion.button
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleStreamingClick}
                        className="glass rounded-2xl p-6 text-left hover:bg-white/5 transition-colors group relative overflow-hidden"
                    >
                        {/* Premium badge */}
                        <div className="absolute top-3 right-3 flex items-center gap-1 text-xs text-amber-400">
                            <Sparkles className="w-3 h-3" />
                            <span>Full</span>
                        </div>

                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Music className="w-6 h-6 text-white" />
                        </div>
                        <h2 className="text-lg font-bold mb-2">Streaming</h2>
                        <p className="text-xs text-muted-foreground">
                            Full library experience. Playlists, queue, profiles.
                        </p>
                    </motion.button>

                    {/* Party Mode */}
                    <motion.button
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => navigate("/party")}
                        className="glass rounded-2xl p-6 text-left hover:bg-white/5 transition-colors group relative overflow-hidden border border-primary/20"
                    >
                        {/* Party badge */}
                        <div className="absolute top-3 right-3 flex items-center gap-1 text-xs text-primary">
                            <PartyPopper className="w-3 h-3" />
                            <span>Live</span>
                        </div>

                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <PartyPopper className="w-6 h-6 text-black" />
                        </div>
                        <h2 className="text-lg font-bold mb-2">Party Mode</h2>
                        <p className="text-xs text-muted-foreground">
                            Anonymous jukebox. Anyone can add music. No login.
                        </p>
                    </motion.button>
                </div>

                {/* Footer */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    className="text-xs text-muted-foreground mt-12"
                >
                    Onyx v2.0 • Your personal media platform
                </motion.p>
            </div>
        </div>
    );
}
