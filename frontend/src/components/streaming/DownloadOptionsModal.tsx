import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Smartphone, Cloud, X, Check, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/button';

interface DownloadOptionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectDownload: (type: 'app' | 'device') => void;
    trackTitle: string;
    artist: string;
}

export const DownloadOptionsModal = ({
    isOpen,
    onClose,
    onSelectDownload,
    trackTitle,
    artist
}: DownloadOptionsModalProps) => {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
            const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
            setIsMobile(mobileRegex.test(userAgent.toLowerCase()));
        };
        checkMobile();
    }, []);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="glass w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-8 border-b border-white/5 relative">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="absolute right-6 top-6 rounded-full hover:bg-white/10"
                        >
                            <X className="w-5 h-5" />
                        </Button>

                        <div className="flex flex-col items-center text-center">
                            <div className="p-4 bg-primary/20 rounded-3xl mb-4">
                                <Download className="w-8 h-8 text-primary" />
                            </div>
                            <h3 className="text-2xl font-black mb-1">Download Options</h3>
                            <p className="text-sm text-muted-foreground truncate max-w-full italic px-4">
                                {trackTitle} - {artist}
                            </p>
                        </div>
                    </div>

                    {/* Options */}
                    <div className="p-6 grid gap-4">
                        {/* Option 1: In-App Offline (Mobile Only) */}
                        {isMobile && (
                            <button
                                onClick={() => onSelectDownload('app')}
                                className="group relative flex items-center gap-5 p-6 rounded-[2rem] bg-white/5 hover:bg-primary/10 border border-white/5 hover:border-primary/30 transition-all duration-300 text-left"
                            >
                                <div className="p-4 bg-white/5 group-hover:bg-primary/20 rounded-2xl transition-colors">
                                    <Smartphone className="w-6 h-6 group-hover:text-primary" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-lg group-hover:text-primary transition-colors">In-App (Offline)</h4>
                                    <p className="text-xs text-muted-foreground group-hover:text-muted-foreground/80">Save within Onyx for instant offline playback.</p>
                                </div>
                                <ArrowRight className="w-5 h-5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary" />
                            </button>
                        )}

                        {/* Option 2: Full Device Download */}
                        <button
                            onClick={() => onSelectDownload('device')}
                            className="group relative flex items-center gap-5 p-6 rounded-[2rem] bg-white/5 hover:bg-cyan-500/10 border border-white/5 hover:border-cyan-500/30 transition-all duration-300 text-left"
                        >
                            <div className="p-4 bg-white/5 group-hover:bg-cyan-500/20 rounded-2xl transition-colors">
                                <Cloud className="w-6 h-6 group-hover:text-cyan-400" />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-lg group-hover:text-cyan-400 transition-colors">To Device</h4>
                                <p className="text-xs text-muted-foreground group-hover:text-muted-foreground/80">Download to your file system (Downloads folder).</p>
                            </div>
                            <ArrowRight className="w-5 h-5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-cyan-400" />
                        </button>

                        {!isMobile && (
                            <p className="text-[10px] text-center text-muted-foreground/40 mt-2">
                                In-App offline caching is currently optimized for mobile devices.
                            </p>
                        )}
                    </div>

                    <div className="p-6 pt-0 text-center">
                        <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.2em] font-bold">
                            Choose your preferred storage method
                        </p>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};
