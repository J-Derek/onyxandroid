/**
 * Onyx - Streaming Mode
 * Main streaming experience container
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Home, Search, Library, Settings, LogOut, User, Play,
    Music, Clock, Heart, ListMusic, Plus, PlayCircle, Lock, Loader2, Download, Shuffle, PartyPopper, ChevronDown, Wifi, WifiOff
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayback, Track as PlayerTrack } from "@/contexts/PlaybackContext";
import { useCache } from "@/contexts/CacheContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import HomeView from "@/components/streaming/HomeView";
import SearchView from "@/components/streaming/SearchView";
import LibraryView from "@/components/streaming/LibraryView";
import MiniPlayer from "@/components/streaming/MiniPlayer";
import NowPlaying from "@/components/streaming/NowPlaying";
import { DownloadIndicator } from "@/components/streaming/DownloadIndicator";

type StreamingTab = "home" | "search" | "library" | "player" | "settings";


import NavSidebar from "@/components/streaming/NavSidebar";
import SpotifyPlayer from "@/components/streaming/SpotifyPlayer";

export default function StreamingMode() {
    const navigate = useNavigate();
    const { activeProfile, logout, isAuthenticated, isLoading } = useAuth();
    const { isOfflineMode, setIsOfflineMode } = usePlayback();
    const location = useLocation();

    // 🚀 URL-based Tab Management (Spotify Style)
    // This derived state ensures the UI always matches the current URL path.
    const activeTab = ((): StreamingTab => {
        const path = location.pathname.split("/").filter(Boolean).pop();
        if (["home", "search", "library", "player", "settings"].includes(path || "")) {
            return path as StreamingTab;
        }
        return "home";
    })();

    // 🚀 Sidebar Resize Logic
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        const saved = localStorage.getItem("onyx_sidebar_width");
        return saved ? parseInt(saved) : 330; // Default 330px (~15% wider than 288px)
    });
    const [isResizing, setIsResizing] = useState(false);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            const newWidth = Math.max(260, Math.min(450, e.clientX));
            setSidebarWidth(newWidth);
        };

        const handleMouseUp = () => {
            if (isResizing) {
                setIsResizing(false);
                localStorage.setItem("onyx_sidebar_width", sidebarWidth.toString());
            }
        };

        if (isResizing) {
            window.addEventListener("mousemove", handleMouseMove);
            window.addEventListener("mouseup", handleMouseUp);
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
        }

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        };
    }, [isResizing, sidebarWidth]);

    const setActiveTab = (tab: StreamingTab) => {
        navigate(`/streaming/${tab}`);
    };

    // Redirect if not authenticated or no profile selected
    useEffect(() => {
        if (!isLoading) {
            if (!isAuthenticated) {
                navigate("/login?returnUrl=/streaming");
            } else if (!activeProfile) {
                navigate("/streaming");
            }
        }
    }, [isAuthenticated, activeProfile, isLoading, navigate]);

    if (isLoading || !activeProfile) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    return (
        <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
            {/* Main Shell: Sidebar + Content */}
            <div className="flex-1 flex overflow-hidden p-2 gap-2">
                {/* Desktop Sidebar */}
                <NavSidebar
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    className="hidden lg:flex shrink-0 animate-in fade-in slide-in-from-left duration-500"
                    style={{ width: `${sidebarWidth}px` }}
                />

                {/* Resize Handle */}
                <div
                    className={cn(
                        "hidden lg:block w-1 hover:w-1.5 transition-all cursor-col-resize active:bg-primary/50 hover:bg-white/10 rounded-full z-50",
                        isResizing && "bg-primary w-1.5"
                    )}
                    onMouseDown={() => setIsResizing(true)}
                />

                {/* Content View Area */}
                <div className="flex-1 bg-[#121212] rounded-xl relative overflow-hidden flex flex-col group/content">
                    {/* Background Gradient (Spotify style) */}
                    <div className="absolute inset-0 bg-gradient-to-b from-[#222222] via-[#121212] to-[#121212] opacity-40 pointer-events-none" />

                    {/* Integrated Header inside content area (Spotify style) */}
                    <header className="p-4 flex items-center justify-between z-40 sticky top-0 bg-[#121212]/0 backdrop-blur-none transition-all duration-300 group-scroll/content:bg-[#121212]/80 group-scroll/content:backdrop-blur-md">
                        <div className="flex items-center gap-2">
                            {/* Navigation Arrows */}
                            <div className="hidden lg:flex items-center gap-2 mr-4">
                                <button
                                    onClick={() => navigate(-1)}
                                    className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white/70 hover:bg-black/60 transition-colors disabled:opacity-30"
                                    title="Go back"
                                >
                                    <ChevronDown className="w-5 h-5 rotate-90" />
                                </button>
                                <button
                                    onClick={() => navigate(1)}
                                    className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white/70 hover:bg-black/60 transition-colors disabled:opacity-30"
                                    title="Go forward"
                                >
                                    <ChevronDown className="w-5 h-5 -rotate-90" />
                                </button>
                            </div>

                            {/* Logo for Mobile */}
                            <div className="lg:hidden flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
                                <img src="/onyx-prism-v3.png" alt="Onyx" className="w-6 h-6" />
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Offline Mode Indicator */}
                            {isOfflineMode && (
                                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-black uppercase tracking-widest border border-amber-500/20">
                                    <WifiOff className="w-3 h-3" />
                                    Offline
                                </div>
                            )}

                            {/* Mode Switcher */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 hover:bg-black/60 text-sm font-bold transition-all border border-white/5">
                                        <Shuffle className="w-4 h-4 text-[#1DB954]" />
                                        <ChevronDown className="w-3 h-3" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48 bg-[#282828] border-white/5 shadow-2xl">
                                    <DropdownMenuItem onClick={() => navigate("/")} className="text-white hover:bg-white/10 cursor-pointer">Mode Switcher</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => navigate("/download")} className="text-white hover:bg-white/10 cursor-pointer">Download Mode</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => navigate("/party")} className="text-white hover:bg-white/10 cursor-pointer">Party Mode</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>

                            {/* Profile */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="w-8 h-8 rounded-full bg-black/40 p-0.5 border border-white/10 hover:scale-105 transition-transform overflow-hidden">
                                        <div className="w-full h-full rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-black font-bold text-[10px]">
                                            {activeProfile.name.charAt(0).toUpperCase()}
                                        </div>
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48 bg-[#282828] border-white/5 shadow-2xl">
                                    <DropdownMenuLabel className="text-white">Account</DropdownMenuLabel>
                                    <DropdownMenuSeparator className="bg-white/5" />
                                    <DropdownMenuItem onClick={() => setActiveTab("settings")} className="text-white hover:bg-white/10 cursor-pointer">Settings</DropdownMenuItem>
                                    <DropdownMenuItem onClick={handleLogout} className="text-red-400 hover:bg-red-400/10 cursor-pointer">Sign Out</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </header>

                    {/* View Scroll Area */}
                    <main className="flex-1 overflow-y-auto px-6 pb-24 z-10 scroll-smooth">
                        {activeTab === "home" && <HomeView onNavigateToPlaylists={() => setActiveTab("library")} />}
                        {activeTab === "search" && <SearchView />}
                        {activeTab === "library" && <LibraryView />}
                        {activeTab === "player" && <PlayerView />}
                        {activeTab === "settings" && <SettingsView />}
                    </main>
                </div>
            </div>

            {/* Global Fixed Player (Spotify Style) */}
            <SpotifyPlayer />

            {/* Mobile Navigation (Bottom Bar) */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-xl border-t border-white/5 pb-safe">
                <div className="flex justify-around items-center h-16">
                    <NavButton icon={Home} label="Home" active={activeTab === "home"} onClick={() => setActiveTab("home")} />
                    <NavButton icon={Search} label="Search" active={activeTab === "search"} onClick={() => setActiveTab("search")} />
                    <NavButton icon={Library} label="Library" active={activeTab === "library"} onClick={() => setActiveTab("library")} />
                    <NavButton icon={Settings} label="Settings" active={activeTab === "settings"} onClick={() => setActiveTab("settings")} />
                </div>
            </nav>

            <DownloadIndicator />
        </div>
    );
}

function SettingsView() {
    const { activeProfile, logout } = useAuth();
    const navigate = useNavigate();
    const { getCacheSize, clearCache } = useCache();
    const [cacheSize, setCacheSize] = useState<number>(0);

    useEffect(() => {
        getCacheSize().then(setCacheSize);
    }, [getCacheSize]);

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    const handleClearCache = async () => {
        await clearCache();
        setCacheSize(0);
    };

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 py-8"
        >
            <h2 className="text-2xl font-bold">Settings</h2>



            <div className="glass rounded-xl p-6 space-y-8">
                {/* Profile Section */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-black font-bold text-2xl">
                            {activeProfile?.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="font-bold text-lg">{activeProfile?.name}</p>
                            <p className="text-sm text-muted-foreground">Active Profile</p>
                        </div>
                    </div>
                    <Button variant="glass" onClick={() => navigate("/streaming")}
                    >
                        Switch Profile
                    </Button>
                </div>

                <div className="border-t border-white/5" />

                {/* PIN Protection Section */}
                <PinProtectionSettings />

                <div className="border-t border-white/5" />

                {/* Cache Management */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary" />
                        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Storage & Offline</h3>
                    </div>

                    <div className="glass bg-white/5 rounded-xl p-4 flex items-center justify-between">
                        <div>
                            <p className="font-medium">Offline Cache</p>
                            <p className="text-xs text-muted-foreground">Saved tracks and temporary streams</p>
                            <p className="text-sm font-bold text-primary mt-1">{formatBytes(cacheSize)} Used</p>
                        </div>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleClearCache}
                            disabled={cacheSize === 0}
                            className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border-none"
                        >
                            Clear Cache
                        </Button>
                    </div>
                </div>

                <div className="border-t border-white/5" />

                {/* Crossfade Section */}
                <CrossfadeSettings />

                <div className="border-t border-white/5" />

                {/* Account Section */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-primary" />
                        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Account</h3>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 w-full text-left text-red-400 hover:bg-red-500/10 p-3 rounded-xl transition-colors font-medium border border-transparent hover:border-red-500/20"
                    >
                        <LogOut className="w-5 h-5" />
                        <span>Sign Out of Onyx</span>
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

function PinProtectionSettings() {
    const { activeProfile, refreshProfiles } = useAuth();
    const [showPinModal, setShowPinModal] = useState(false);
    const [pinInput, setPinInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const hasPin = activeProfile?.has_pin || false;

    const handleSetPin = async () => {
        if (!activeProfile || pinInput.length < 4) return;
        setIsLoading(true);
        try {
            const { setProfilePin } = await import("@/lib/auth");
            await setProfilePin(activeProfile.id, pinInput);
            await refreshProfiles();
            toast.success("PIN set successfully!");
            setShowPinModal(false);
            setPinInput("");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to set PIN");
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemovePin = async () => {
        if (!activeProfile) return;
        setIsLoading(true);
        try {
            const { removeProfilePin } = await import("@/lib/auth");
            await removeProfilePin(activeProfile.id);
            await refreshProfiles();
            toast.success("PIN removed!");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to remove PIN");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Security</h3>
                </div>

                <div className="glass bg-white/5 rounded-xl p-4 flex items-center justify-between">
                    <div>
                        <p className="font-medium">Profile PIN</p>
                        <p className="text-xs text-muted-foreground">
                            {hasPin ? "PIN protection is enabled" : "Protect this profile with a PIN"}
                        </p>
                    </div>
                    {hasPin ? (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleRemovePin}
                            disabled={isLoading}
                            className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border-none"
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Remove PIN"}
                        </Button>
                    ) : (
                        <Button
                            variant="glass"
                            size="sm"
                            onClick={() => setShowPinModal(true)}
                        >
                            Set PIN
                        </Button>
                    )}
                </div>
            </div>

            {/* Set PIN Modal */}
            <AnimatePresence>
                {showPinModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowPinModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="glass rounded-2xl p-6 w-full max-w-sm text-center"
                            onClick={e => e.stopPropagation()}
                        >
                            <Lock className="w-12 h-12 mx-auto mb-4 text-primary" />
                            <h2 className="text-xl font-bold mb-2">Set Profile PIN</h2>
                            <p className="text-sm text-muted-foreground mb-6">
                                Enter a 4-6 digit PIN to protect {activeProfile?.name}
                            </p>

                            <Input
                                type="password"
                                placeholder="Enter PIN"
                                value={pinInput}
                                onChange={e => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                className="mb-4 text-center text-2xl tracking-widest"
                                maxLength={6}
                                autoFocus
                                onKeyDown={e => e.key === "Enter" && pinInput.length >= 4 && handleSetPin()}
                            />

                            <div className="flex gap-2">
                                <Button
                                    variant="ghost"
                                    className="flex-1"
                                    onClick={() => { setShowPinModal(false); setPinInput(""); }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    className="flex-1 gradient-accent"
                                    onClick={handleSetPin}
                                    disabled={isLoading || pinInput.length < 4}
                                >
                                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Set PIN"}
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

function CrossfadeSettings() {
    const { crossfadeMs, setCrossfadeMs } = usePlayback();

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Playback</h3>
            </div>

            <div className="glass bg-white/5 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-medium">Crossfade</p>
                        <p className="text-xs text-muted-foreground">Smooth transition between tracks</p>
                    </div>
                    <span className="text-sm font-bold text-primary">
                        {crossfadeMs === 0 ? "Off" : `${(crossfadeMs / 1000).toFixed(1)}s`}
                    </span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="12000"
                    step="500"
                    value={crossfadeMs}
                    onChange={(e) => setCrossfadeMs(parseInt(e.target.value))}
                    className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
                />
            </div>
        </div>
    );
}

// Helper Components
function NavButton({
    icon: Icon,
    label,
    active,
    onClick
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${active ? "text-primary" : "text-muted-foreground hover:text-white"
                }`}
        >
            <Icon className="w-5 h-5" />
            <span className="text-xs">{label}</span>
        </button>
    );
}

function QuickActionCard({
    icon: Icon,
    label,
    description,
    gradient
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    description: string;
    gradient: string;
}) {
    return (
        <button className="glass rounded-xl p-4 text-left hover:bg-white/5 transition-colors group">
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                <Icon className="w-5 h-5 text-white" />
            </div>
            <p className="font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
        </button>
    );
}

function getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour < 12) return "morning";
    if (hour < 17) return "afternoon";
    return "evening";
}
function PlayerView() {
    const { currentTrack } = usePlayback();

    if (!currentTrack) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-muted-foreground">
                <Music className="w-16 h-16 mb-4 opacity-20" />
                <p>No track is playing</p>
                <p className="text-sm">Start listening to use the player</p>
            </div>
        );
    }

    return (
        <div className="h-[75vh] w-full max-w-5xl mx-auto overflow-hidden">
            <NowPlaying isTab={true} />
        </div>
    );
}
