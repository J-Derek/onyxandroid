import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Zap, Download, PartyPopper, Headphones } from "lucide-react";
import { Button } from "../ui/button";

interface InfoModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function InfoModal({ isOpen, onClose }: InfoModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md"
                    />

                    {/* Modal Wrapper */}
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="w-full max-w-4xl pointer-events-auto"
                        >
                            <div className="relative overflow-hidden rounded-2xl bg-black border border-white/10 shadow-2xl p-6">
                                {/* Header */}
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-xl gradient-primary">
                                            <Sparkles className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-bold">Welcome to Onyx</h2>
                                            <p className="text-sm text-muted-foreground">Your all-in-one music & media platform</p>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={onClose}>
                                        <X className="w-5 h-5" />
                                    </Button>
                                </div>

                                {/* Three Modes */}
                                <section className="mb-6">
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <Zap className="w-5 h-5 text-accent" />
                                        Three Powerful Modes
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20">
                                            <Download className="w-6 h-6 text-cyan-400 mb-2" />
                                            <h4 className="font-semibold mb-1">Download Mode</h4>
                                            <p className="text-xs text-muted-foreground">Download videos & audio from YouTube. Up to 8K video and 320kbps audio. Build your offline library.</p>
                                        </div>
                                        <div className="p-4 rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20">
                                            <Headphones className="w-6 h-6 text-violet-400 mb-2" />
                                            <h4 className="font-semibold mb-1">Streaming Mode</h4>
                                            <p className="text-xs text-muted-foreground">Stream music instantly. Create profiles, favorites, and playlists. Sign in to sync across devices.</p>
                                        </div>
                                        <div className="p-4 rounded-xl bg-gradient-to-br from-pink-500/10 to-rose-500/10 border border-pink-500/20">
                                            <PartyPopper className="w-6 h-6 text-pink-400 mb-2" />
                                            <h4 className="font-semibold mb-1">Party Mode</h4>
                                            <p className="text-xs text-muted-foreground">Anonymous queue-based playback. Perfect for parties — anyone can add songs without an account.</p>
                                        </div>
                                    </div>
                                </section>

                                {/* Download Features */}
                                <section className="mb-6">
                                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                        <Download className="w-5 h-5 text-cyan-400" />
                                        Download Mode Features
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                                            <h4 className="font-medium text-sm">8K Video</h4>
                                            <p className="text-xs text-muted-foreground">Highest quality</p>
                                        </div>
                                        <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                                            <h4 className="font-medium text-sm">Hi-Fi Audio</h4>
                                            <p className="text-xs text-muted-foreground">320kbps MP3</p>
                                        </div>
                                        <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                                            <h4 className="font-medium text-sm">Smart Library</h4>
                                            <p className="text-xs text-muted-foreground">Auto-organized</p>
                                        </div>
                                        <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                                            <h4 className="font-medium text-sm">Playlists</h4>
                                            <p className="text-xs text-muted-foreground">Batch download</p>
                                        </div>
                                    </div>
                                </section>

                                {/* Pro Tips */}
                                <section>
                                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-yellow-400" />
                                        Pro Tips
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div className="flex gap-3 p-3 rounded-lg bg-white/5">
                                            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-xs font-bold text-primary">1</div>
                                            <div>
                                                <p className="text-sm font-medium">Search Smart</p>
                                                <p className="text-xs text-muted-foreground">Use "Artist Mix" or paste YouTube URLs</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3 p-3 rounded-lg bg-white/5">
                                            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-xs font-bold text-primary">2</div>
                                            <div>
                                                <p className="text-sm font-medium">Use Switch Menu</p>
                                                <p className="text-xs text-muted-foreground">Quick mode switching in the header</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3 p-3 rounded-lg bg-white/5">
                                            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-xs font-bold text-primary">3</div>
                                            <div>
                                                <p className="text-sm font-medium">Check Library</p>
                                                <p className="text-xs text-muted-foreground">All downloads saved locally</p>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                {/* Footer */}
                                <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
                                    <Button onClick={onClose} variant="gradient">
                                        Got it, let's go!
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
