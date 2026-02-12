import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PartyPopper, LogOut, Search, Home, Download, Headphones, Shuffle, ChevronDown, AlertTriangle, Infinity, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PartyPlaybackProvider, usePartyPlayback } from "@/contexts/PartyPlaybackContext";
import PartyNowPlaying from "@/components/party/PartyNowPlaying";
import PartyQueue from "@/components/party/PartyQueue";
import PartyControls from "@/components/party/PartyControls";
import PartySearchModal from "@/components/party/PartySearchModal";
import PartySessionShare from "@/components/party/PartySessionShare";
import HostPinDialog from "@/components/party/HostPinDialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Palette } from "lucide-react";

const THEMES = {
    onyx: {
        name: "Midnight Depth",
        bg: "bg-[#03060b]",
        bg1: "bg-primary/10",
        bg2: "bg-accent/5",
        accent: "text-primary"
    },
    vaporwave: {
        name: "Vaporwave",
        bg: "bg-[#0f0524]",
        bg1: "bg-fuchsia-500/20",
        bg2: "bg-cyan-400/20",
        accent: "text-fuchsia-400"
    },
    forest: {
        name: "Deep Forest",
        bg: "bg-[#051a0f]",
        bg1: "bg-emerald-500/20",
        bg2: "bg-amber-400/10",
        accent: "text-emerald-400"
    },
    sunrise: {
        name: "Sunrise",
        bg: "bg-[#1a0f05]",
        bg1: "bg-orange-500/20",
        bg2: "bg-rose-500/10",
        accent: "text-orange-400"
    }
};

type ThemeKey = keyof typeof THEMES;

export default function PartyMode() {
    return (
        <PartyPlaybackProvider>
            <PartyModeContent />
        </PartyPlaybackProvider>
    );
}

function PartyModeContent() {
    const navigate = useNavigate();
    const { queue, endlessMode, toggleEndlessMode, isHost, sessionId, setIsHost } = usePartyPlayback();
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [currentTheme, setCurrentTheme] = useState<ThemeKey>("onyx");
    const [adminPin, setAdminPin] = useState<string | null>(null);

    const handleUnlock = (pin: string) => {
        if (isHost) {
            setAdminPin(pin);
            toast.success("Host PIN set!");
        } else {
            // In a real app, verify with backend. For this ephemeral demo, 
            // we'll allow it if they know any 4-digit PIN for now or 
            // if we had a way to sync it.
            // Let's assume the PIN is "0000" or simple check.
            if (pin === "0707") { // Secret default for demo takeoff
                setIsHost(true);
                toast.success("Host controls unlocked!");
            } else {
                toast.error("Invalid PIN");
            }
        }
    };

    const theme = THEMES[currentTheme];

    // Handle exit - show confirmation if queue has items
    const handleExit = (destination: string) => {
        if (queue.length > 0) {
            setShowExitConfirm(true);
        } else {
            navigate(destination);
        }
    };

    const confirmExit = () => {
        setShowExitConfirm(false);
        navigate("/");
    };

    // Browser exit confirmation (native)
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (queue.length > 0) {
                e.preventDefault();
                e.returnValue = "";
            }
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [queue.length]);

    return (
        <div className={`h-screen ${theme.bg} text-white selection:bg-primary selection:text-primary-foreground overflow-hidden flex flex-col relative transition-colors duration-1000`}>
            {/* Background Atmosphere */}
            <div className="fixed inset-0 pointer-events-none -z-10">
                <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full ${theme.bg1} blur-[150px] transition-colors duration-1000`} />
                <div className={`absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full ${theme.bg2} blur-[180px] transition-colors duration-1000`} />
            </div>

            {/* Header */}
            <header className="flex items-center justify-between p-6 border-b border-white/5 bg-black/20 backdrop-blur-2xl z-30 sticky top-0">
                <div className="flex items-center gap-4 cursor-pointer group" onClick={() => navigate("/")}>
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                        <PartyPopper className="w-6 h-6 text-black" />
                    </div>
                    <div>
                        <h1 className="font-bold text-xl tracking-tight leading-none mb-1 group-hover:text-primary transition-colors">Party Mode</h1>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black opacity-40">
                            Anonymous Jukebox
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Share Session (Host Only) */}
                    {isHost && sessionId && (
                        <PartySessionShare sessionId={sessionId} />
                    )}

                    <div className="h-8 w-px bg-white/5 mx-2 hidden md:block" />

                    <div className="flex items-center gap-2">
                        {/* Host Access / PIN */}
                        <HostPinDialog onUnlock={handleUnlock} isHost={isHost} />

                        {/* Guest Badge */}
                        {!isHost && (
                            <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/5 border border-primary/10 text-[10px] font-black text-primary uppercase tracking-widest">
                                <Users className="w-3.5 h-3.5" />
                                Guest
                            </div>
                        )}
                    </div>

                    <div className="h-8 w-px bg-white/5 mx-2 hidden md:block" />

                    <div className="flex items-center gap-2">
                        {/* Auto-Queue Toggle (Host Only) */}
                        {isHost && (
                            <Button
                                onClick={toggleEndlessMode}
                                variant="ghost"
                                size="icon"
                                className={cn(
                                    "h-11 w-11 rounded-xl border transition-all duration-300",
                                    endlessMode
                                        ? "bg-primary/20 border-primary/30 text-primary hover:bg-primary/30"
                                        : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10 hover:text-foreground"
                                )}
                                title={endlessMode ? "Auto-queue ON: Related songs will be added" : "Auto-queue OFF: Queue will stop at end"}
                            >
                                <Infinity className="w-5 h-5" />
                            </Button>
                        )}

                        {/* Theme Switcher */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-11 w-11 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                                    title="Change Room Theme"
                                >
                                    <Palette className={cn("w-5 h-5", theme.accent)} />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52 bg-[#0a0a0a]/90 backdrop-blur-3xl border-white/10 rounded-2xl p-2 shadow-2xl">
                                <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] py-2 px-3">Room Themes</DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-white/5" />
                                {(Object.entries(THEMES) as [ThemeKey, typeof THEMES.onyx][]).map(([key, t]) => (
                                    <DropdownMenuItem
                                        key={key}
                                        onClick={() => setCurrentTheme(key)}
                                        className={cn(
                                            "rounded-xl py-2.5 px-3 cursor-pointer transition-all mb-1",
                                            currentTheme === key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                                        )}
                                    >
                                        <div className={cn("w-2 h-2 rounded-full mr-3", t.bg1.replace('/20', ''))} />
                                        <span className="font-bold text-sm tracking-tight">{t.name}</span>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Mode Switcher */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="glass" className="h-11 rounded-xl px-4 border-white/10 font-bold text-sm group">
                                    <Shuffle className="w-4 h-4 mr-2 text-primary group-hover:rotate-180 transition-transform duration-500" />
                                    Switch
                                    <ChevronDown className="w-3 h-3 ml-2 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-60 bg-[#0a0a0a]/90 backdrop-blur-3xl border-white/10 rounded-2xl p-2 shadow-2xl">
                                <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] py-3 px-4">Change Mode</DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-white/5" />
                                <DropdownMenuItem onClick={() => handleExit("/")} className="rounded-xl py-3 px-4 cursor-pointer hover:bg-white/5 transition-colors mb-1">
                                    <Home className="w-5 h-5 mr-3 text-muted-foreground" />
                                    <span className="font-bold">Mode Switcher</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExit("/download")} className="rounded-xl py-3 px-4 cursor-pointer hover:bg-white/5 transition-colors mb-1">
                                    <Download className="w-5 h-5 mr-3 text-muted-foreground" />
                                    <span className="font-bold">Download Mode</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExit("/streaming/home")} className="rounded-xl py-3 px-4 cursor-pointer hover:bg-white/5 transition-colors">
                                    <Headphones className="w-5 h-5 mr-3 text-muted-foreground" />
                                    <span className="font-bold">Streaming Mode</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Exit */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleExit("/")}
                            className="h-11 w-11 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 transition-all"
                            title="Exit Party Mode"
                        >
                            <LogOut className="w-5 h-5" />
                        </Button>
                    </div>
                </div>
            </header>

            {/* Main Content Area - No Page Scroll */}
            <main className="flex-1 flex flex-col lg:flex-row gap-4 p-4 md:p-6 lg:p-8 overflow-hidden items-stretch max-w-[1920px] mx-auto w-full h-full">

                {/* Left: Now Playing (Compact, Fixed Width, Vertically Centered) */}
                <div className="w-full lg:w-[400px] xl:w-[450px] flex flex-col items-center justify-center p-4 lg:p-8 bg-white/[0.02] border border-white/[0.05] rounded-3xl shadow-2xl shrink-0">
                    <div className="w-full flex flex-col justify-center items-center">
                        <PartyNowPlaying />
                    </div>
                    <div className="w-full pt-8 mt-8 border-t border-white/[0.05]">
                        <PartyControls />
                    </div>
                </div>

                {/* Right: The Queue (Fills Height, Scrollable) */}
                <aside className="flex-1 min-w-0 flex flex-col bg-white/[0.02] border border-white/[0.05] rounded-2xl shadow-inner overflow-hidden">
                    <PartyQueue />
                </aside>
            </main>

            {/* Floating Search Button (FAB) */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsSearchOpen(true)}
                className="fixed bottom-10 right-10 w-20 h-20 rounded-full bg-primary text-primary-foreground shadow-2xl shadow-primary/40 flex items-center justify-center z-50 group hover:shadow-primary/60 transition-all"
            >
                <Search className="w-10 h-10 group-hover:scale-110 transition-transform" />
            </motion.button>

            {/* Search Modal Container */}
            <PartySearchModal
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
            />

            {/* Exit Confirmation Modal */}
            <AnimatePresence>
                {showExitConfirm && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/80 backdrop-blur-md"
                            onClick={() => setShowExitConfirm(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative bg-surface-1 border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl"
                        >
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-14 h-14 rounded-2xl bg-red-500/20 flex items-center justify-center">
                                    <AlertTriangle className="w-7 h-7 text-red-500" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold">Leave Party Mode?</h3>
                                    <p className="text-muted-foreground text-sm">Your queue will be lost</p>
                                </div>
                            </div>
                            <p className="text-muted-foreground mb-8">
                                You have <span className="text-white font-bold">{queue.length} track{queue.length !== 1 ? 's' : ''}</span> in your queue.
                                Leaving will clear everything and cannot be undone.
                            </p>
                            <div className="flex gap-3">
                                <Button
                                    variant="ghost"
                                    onClick={() => setShowExitConfirm(false)}
                                    className="flex-1 h-12 rounded-xl"
                                >
                                    Stay
                                </Button>
                                <Button
                                    onClick={confirmExit}
                                    className="flex-1 h-12 rounded-xl bg-red-500 hover:bg-red-600 text-white"
                                >
                                    Leave &amp; Clear Queue
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Custom Scrollbar Styling */}
            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
            `}} />
        </div>
    );
}
