/**
 * Onyx Streaming - Now Playing
 * Immersive full-screen playback experience with queue panel.
 */
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronDown, Play, Pause, SkipBack, SkipForward,
    Shuffle, Repeat, Volume2, VolumeX, ListMusic, Music,
    MoreVertical, Share2, Heart, DownloadCloud, ShieldCheck, Loader2,
    X, GripVertical, Trash2, ListPlus, Palette
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AudioVisualizer } from "./AudioVisualizer";
import { usePlayback, Track } from "@/contexts/PlaybackContext";
import { useCache } from "@/contexts/CacheContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useState, useEffect, useCallback } from "react";
import AddToPlaylistModal from "../playlists/AddToPlaylistModal";
import { DownloadOptionsModal } from "./DownloadOptionsModal";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";

// Drag-and-drop imports
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAudioOutputDevice } from "@/hooks/useAudioOutputDevice";
import { AudioOutputSelector } from "@/components/AudioOutputSelector";

const THEMES = {
    onyx: {
        name: "Classic Onyx",
        bg: "bg-black",
        bg1: "bg-primary/10",
        bg2: "bg-accent/10",
        accent: "bg-primary",
        text: "text-primary"
    },
    vaporwave: {
        name: "Vaporwave",
        bg: "bg-[#0f0524]",
        bg1: "bg-fuchsia-500/20",
        bg2: "bg-cyan-400/20",
        accent: "bg-fuchsia-400",
        text: "text-fuchsia-400"
    },
    forest: {
        name: "Deep Forest",
        bg: "bg-[#051a0f]",
        bg1: "bg-emerald-500/20",
        bg2: "bg-amber-400/10",
        accent: "bg-emerald-400",
        text: "text-emerald-400"
    },
    sunrise: {
        name: "Sunrise",
        bg: "bg-[#1a0f05]",
        bg1: "bg-orange-500/20",
        bg2: "bg-rose-500/10",
        accent: "bg-orange-400",
        text: "text-orange-400"
    }
};

type ThemeKey = keyof typeof THEMES;

interface NowPlayingProps {
    onClose?: () => void;
    isTab?: boolean;
}

export default function NowPlaying({ onClose, isTab = false }: NowPlayingProps) {
    const {
        currentTrack,
        isPlaying,
        togglePlay,
        next,
        previous,
        progress,
        currentTime,
        duration,
        seek,
        volume,
        setVolume,
        isMuted,
        toggleMute,
        repeatMode,
        setRepeatMode,
        isShuffle,
        toggleShuffle,
        queue,
        currentIndex,
        removeFromQueue,
        reorderQueue,
        isLoading,
        isQueueLoading,
        playFromQueue,
        audioRef
    } = usePlayback();

    // Audio output device selection
    const {
        availableDevices,
        selectedDeviceId,
        isSupported: isDeviceSelectorSupported,
        hasPermission,
        setOutputDevice,
        refreshDevices,
        requestPermission
    } = useAudioOutputDevice(audioRef);

    const navigate = useNavigate();

    const { isCached, saveToCache } = useCache();
    const { isFavorite, toggleFavorite } = useFavorites();
    const [cached, setCached] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    // 📱 Responsive: Hide queue by default on mobile (< 1024px)
    const [showQueue, setShowQueue] = useState(() => {
        if (typeof window !== "undefined") {
            return window.innerWidth >= 1024;
        }
        return true;
    });
    const [queueWidth, setQueueWidth] = useState(320); // Resizable queue width
    const [isResizing, setIsResizing] = useState(false);
    const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
    const [isDownloadOptionsOpen, setIsDownloadOptionsOpen] = useState(false);
    const [selectedTrackForPlaylist, setSelectedTrackForPlaylist] = useState<any>(null);
    const isCurrentFavorite = currentTrack ? isFavorite(currentTrack.id) : false;

    const [currentTheme, setCurrentTheme] = useState<ThemeKey>("onyx");
    const theme = THEMES[currentTheme];

    // 🚀 Robust Seek State
    const [isDragging, setIsDragging] = useState(false);
    const [displayProgress, setDisplayProgress] = useState(0);

    // Sync display progress with context progress when not dragging
    useEffect(() => {
        if (!isDragging) {
            setDisplayProgress(progress);
        }
    }, [progress, isDragging]);

    useEffect(() => {
        if (currentTrack) {
            isCached(currentTrack.id).then(setCached);
        }
    }, [currentTrack, isCached]);

    if (!currentTrack) return null;

    const handleSaveToCache = async () => {
        if (!currentTrack || cached || isSaving) return;
        setIsSaving(true);
        try {
            // First ensure it's in library so we can track offline status
            const libResponse = await fetch("/api/library/ensure", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("onyx_access_token")}`
                },
                body: JSON.stringify({
                    youtube_id: currentTrack.youtube_id || currentTrack.id.toString().replace('yt-', ''),
                    title: currentTrack.title,
                    artist: currentTrack.artist,
                    thumbnail_url: currentTrack.thumbnail,
                    duration_sec: Math.floor(duration),
                    is_offline: true
                })
            });

            await saveToCache(currentTrack.id, currentTrack.uri);
            setCached(true);
        } catch (err) {
            console.error("Cache failed:", err);
            toast.error("Failed to save for offline playback");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadToDevice = async () => {
        if (!currentTrack) return;

        try {
            // 🔧 FIX: Properly construct YouTube URL from track metadata
            let videoUrl: string;

            if (currentTrack.youtube_id) {
                // Best case: we have the raw YouTube ID
                videoUrl = `https://youtube.com/watch?v=${currentTrack.youtube_id}`;
            } else if (typeof currentTrack.id === 'string' && currentTrack.id.includes('yt-')) {
                // Fallback: extract from yt- prefixed ID
                videoUrl = `https://youtube.com/watch?v=${currentTrack.id.replace('yt-', '')}`;
            } else if (typeof currentTrack.id === 'string' && currentTrack.id.length === 11) {
                // Fallback: raw YouTube ID as track.id (11 chars)
                videoUrl = `https://youtube.com/watch?v=${currentTrack.id}`;
            } else {
                // Last resort: use URI (but this likely won't work for backend downloads)
                videoUrl = currentTrack.uri;
            }

            console.log("[Download] Starting download for:", videoUrl);

            const result = await api.startDownload(
                videoUrl,
                "audio",
                "best",
                "mp3",
                currentTrack.title,
                currentTrack.artist,
                currentTrack.thumbnail
            );

            // 🚀 Dispatch event for DownloadIndicator
            window.dispatchEvent(new CustomEvent('onyx-download-start', {
                detail: { task_id: result.task_id, title: currentTrack.title }
            }));

            toast.success("Download started", {
                description: `Downloading ${currentTrack.title}...`,
                action: {
                    label: "Go to Queue",
                    onClick: () => {
                        if (onClose) onClose(); // Close NowPlaying
                        navigate("/download"); // Navigate to downloads page
                    }
                }
            });
        } catch (err) {
            toast.error("Download failed to start");
        }
    };

    const handleDownloadOption = (type: 'app' | 'device') => {
        setIsDownloadOptionsOpen(false);
        if (type === 'app') {
            handleSaveToCache();
        } else {
            handleDownloadToDevice();
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleAddToPlaylist = async () => {
        if (!currentTrack) return;

        // If it's a YouTube track, we need to ensure it's in the library first to get a numeric ID
        if (currentTrack.source === "youtube" || typeof currentTrack.id === 'string' && currentTrack.id.includes('yt-')) {
            try {
                const response = await fetch("/api/library/ensure", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${localStorage.getItem("onyx_access_token")}`
                    },
                    body: JSON.stringify({
                        youtube_id: currentTrack.youtube_id || currentTrack.id.toString().replace('yt-', ''),
                        title: currentTrack.title,
                        artist: currentTrack.artist,
                        thumbnail_url: currentTrack.thumbnail,
                        duration_sec: duration
                    })
                });

                if (response.ok) {
                    const libraryTrack = await response.json();
                    setSelectedTrackForPlaylist({
                        ...currentTrack,
                        id: libraryTrack.id
                    });
                    setIsPlaylistModalOpen(true);
                } else {
                    toast.error("Failed to process track for playlist");
                }
            } catch (err) {
                console.error("Error ensuring track:", err);
                toast.error("Network error");
            }
        } else {
            setSelectedTrackForPlaylist(currentTrack);
            setIsPlaylistModalOpen(true);
        }
    };

    return (
        <motion.div
            initial={isTab ? { opacity: 0 } : { y: "100%" }}
            animate={isTab ? { opacity: 1 } : { y: 0 }}
            exit={isTab ? { opacity: 0 } : { y: "100%" }}
            transition={isTab ? { duration: 0.3 } : { type: "spring", damping: 25, stiffness: 200 }}
            className={`bg-black flex flex-col lg:flex-row ${isTab ? "h-full w-full rounded-2xl overflow-hidden relative" : "fixed inset-0 z-[100] transition-colors duration-1000 " + theme.bg}`}
        >
            {/* Dynamic Background (Blurry Art) */}
            <div className="absolute inset-0 opacity-40 blur-[100px] pointer-events-none overflow-hidden">
                {currentTrack.thumbnail ? (
                    <img src={currentTrack.thumbnail} alt="" className="w-full h-full object-cover scale-150 rotate-12" />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-900 to-cyan-900" />
                )}
            </div>

            {/* Theme Atmosphere */}
            <div className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ${showQueue ? "opacity-20" : "opacity-100"}`}>
                <div className={`absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full ${theme.bg1} blur-[120px] transition-colors duration-1000`} />
                <div className={`absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full ${theme.bg2} blur-[150px] transition-colors duration-1000`} />
            </div>

            {/* Main Player - Responsive width for large screens */}
            <div className={`relative flex-1 flex flex-col p-6 mx-auto w-full max-w-lg lg:max-w-3xl xl:max-w-4xl overflow-y-auto scrollbar-hide ${showQueue ? "opacity-30 lg:opacity-100" : ""}`}>
                {/* Header */}
                <header className="flex items-center justify-between mb-6">
                    {!isTab && (
                        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                            <ChevronDown className="w-6 h-6" />
                        </Button>
                    )}
                    {isTab && <div className="w-10" />}
                    <div className="text-center min-w-0 flex-1 px-4">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-black">Now Playing</p>
                        <p className="text-sm font-bold truncate">{currentTrack.title}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Theme Switcher */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-white/60 hover:text-white"
                                    title="Change Theme"
                                >
                                    <Palette className={`w-5 h-5 ${theme.text}`} />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 bg-zinc-950 border-white/10 rounded-2xl p-2 shadow-2xl">
                                <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] py-2 px-3">Visual Themes</DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-white/5" />
                                {(Object.entries(THEMES) as [ThemeKey, typeof THEMES.onyx][]).map(([key, t]) => (
                                    <DropdownMenuItem
                                        key={key}
                                        onClick={() => setCurrentTheme(key)}
                                        className={`rounded-xl py-2 px-3 cursor-pointer transition-colors ${currentTheme === key ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"}`}
                                    >
                                        <div className={`w-2 h-2 rounded-full mr-3 ${t.accent}`} />
                                        <span className="font-medium text-sm">{t.name}</span>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setShowQueue(!showQueue)}
                            className={`rounded-full h-10 w-10 transition-all ${showQueue ? theme.text + " bg-primary/10 scale-110" : "text-white/40 hover:text-white hover:bg-white/10"}`}
                        >
                            <ListMusic className="w-5 h-5" />
                        </Button>
                    </div>
                </header>




                {/* Artwork */}
                <div className="aspect-square w-full max-w-sm lg:max-w-md xl:max-w-lg mx-auto mb-8 lg:mb-12 group relative">
                    <motion.div
                        layoutId="artwork"
                        className="w-full h-full rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden bg-white/5 relative z-10"
                    >
                        {currentTrack.thumbnail ? (
                            <img src={currentTrack.thumbnail} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <Music className="w-20 h-20 text-muted-foreground" />
                            </div>
                        )}
                    </motion.div>
                    {/* Subtle Glow */}
                    <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-75 -z-10 group-hover:scale-90 transition-transform duration-700" />
                </div>

                {/* Track Info */}
                <div className="mb-6 flex items-end justify-between gap-4">
                    <div className="min-w-0 flex-1">
                        <h2 className="text-2xl lg:text-3xl xl:text-4xl font-bold truncate mb-1">{currentTrack.title}</h2>
                        <p className={`text-lg lg:text-xl font-medium truncate ${theme.text}`}>{currentTrack.artist}</p>
                    </div>



                    <div className="flex items-center gap-2 mb-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsDownloadOptionsOpen(true)}
                            className={`rounded-full ${cached ? "text-primary" : "text-muted-foreground hover:text-white"}`}
                        >
                            {isSaving ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : cached ? (
                                <ShieldCheck className="w-5 h-5" />
                            ) : (
                                <DownloadCloud className="w-5 h-5" />
                            )}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleAddToPlaylist}
                            className="text-muted-foreground hover:text-white"
                        >
                            <ListPlus className="w-6 h-6" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => currentTrack && toggleFavorite(currentTrack)}
                            className={isCurrentFavorite ? "text-red-500" : "text-muted-foreground hover:text-red-500"}
                        >
                            <Heart className={`w-6 h-6 ${isCurrentFavorite ? "fill-current" : ""}`} />
                        </Button>
                    </div>
                </div>

                {/* Audio Visualizer - dedicated row */}
                <div className="h-12 lg:h-16 xl:h-20 w-full mb-8 lg:mb-12 opacity-40 hover:opacity-100 transition-opacity">
                    <AudioVisualizer barCount={showQueue ? 48 : 96} />
                </div>

                {/* Progress */}
                <div className="mb-6">
                    <Slider
                        value={[displayProgress]}
                        max={100}
                        step={0.1}
                        onValueChange={(val) => {
                            setIsDragging(true);
                            setDisplayProgress(val[0]);
                        }}
                        onValueCommit={(val) => {
                            seek((val[0] / 100) * duration);
                            // Delay releasing drag state to let audio engine catch up
                            setTimeout(() => setIsDragging(false), 200);
                        }}
                        className="mb-2"
                    />
                    <div className="flex justify-between text-[10px] font-bold text-muted-foreground tracking-tighter">
                        <span>{formatTime(isDragging ? (displayProgress / 100) * duration : currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-between mb-6">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleShuffle}
                        className={`rounded-full ${isShuffle ? theme.text : "text-muted-foreground"}`}
                    >
                        <Shuffle className="w-5 h-5" />
                    </Button>

                    <div className="flex items-center gap-6">
                        <Button variant="ghost" size="icon" onClick={previous} className="rounded-full h-12 w-12 text-white">
                            <SkipBack className="w-8 h-8 fill-current" />
                        </Button>

                        <Button
                            onClick={togglePlay}
                            disabled={isLoading}
                            className="h-16 w-16 rounded-full bg-white text-black hover:bg-white/90 shadow-xl relative"
                        >
                            {isLoading ? (
                                <Loader2 className="w-8 h-8 animate-spin" />
                            ) : isPlaying ? (
                                <Pause className="w-8 h-8 fill-current" />
                            ) : (
                                <Play className="w-8 h-8 ml-1 fill-current" />
                            )}
                        </Button>

                        <Button variant="ghost" size="icon" onClick={next} className="rounded-full h-12 w-12 text-white">
                            <SkipForward className="w-8 h-8 fill-current" />
                        </Button>
                    </div>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setRepeatMode(repeatMode === "all" ? "none" : "all")}
                        className={`rounded-full ${repeatMode !== "none" ? theme.text : "text-muted-foreground"}`}
                    >
                        <Repeat className="w-5 h-5" />
                    </Button>
                </div>

                {/* Volume Control - Always Visible */}
                <div className="flex items-center gap-3 bg-white/5 rounded-full px-4 py-2">
                    {/* Audio Output Device Selector */}
                    <AudioOutputSelector
                        availableDevices={availableDevices}
                        selectedDeviceId={selectedDeviceId}
                        onSelectDevice={setOutputDevice}
                        isSupported={isDeviceSelectorSupported}
                        hasPermission={hasPermission}
                        onRefreshDevices={refreshDevices}
                        onRequestPermission={requestPermission}
                    />
                    <Button variant="ghost" size="icon" onClick={toggleMute} className="text-muted-foreground h-8 w-8">
                        {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </Button>
                    <Slider
                        value={[isMuted ? 0 : volume * 100]}
                        max={100}
                        onValueChange={(val) => setVolume(val[0] / 100)}
                        className="flex-1"
                    />
                    <span className="text-xs text-muted-foreground w-8 text-right">
                        {Math.round(isMuted ? 0 : volume * 100)}%
                    </span>
                </div>
            </div>

            {/* Queue Panel - Right Side */}
            <AnimatePresence>
                {showQueue && (
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        style={{ width: queueWidth }}
                        className="bg-black/80 backdrop-blur-xl border-l border-white/10 flex flex-col absolute inset-y-0 right-0 lg:relative z-20 shadow-2xl lg:shadow-none"
                    >
                        {/* Resize Handle */}
                        <div
                            className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary transition-colors z-30"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                setIsResizing(true);
                                const startX = e.clientX;
                                const startWidth = queueWidth;

                                const handleMouseMove = (moveEvent: MouseEvent) => {
                                    const delta = startX - moveEvent.clientX;
                                    const newWidth = Math.min(Math.max(startWidth + delta, 280), 600);
                                    setQueueWidth(newWidth);
                                };

                                const handleMouseUp = () => {
                                    setIsResizing(false);
                                    document.removeEventListener('mousemove', handleMouseMove);
                                    document.removeEventListener('mouseup', handleMouseUp);
                                };

                                document.addEventListener('mousemove', handleMouseMove);
                                document.addEventListener('mouseup', handleMouseUp);
                            }}
                        />
                        {/* Queue Header */}
                        <div className="flex items-center justify-between p-4 border-b border-white/10">
                            <div className="flex items-center gap-2">
                                <ListMusic className="w-5 h-5 text-primary" />
                                <h3 className="font-bold">Up Next</h3>
                                <span className="text-xs text-muted-foreground">({queue.length - currentIndex - 1})</span>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setShowQueue(false)} className="h-8 w-8">
                                <X className="w-4 h-4" />
                            </Button>
                        </div>

                        {/* Queue List - Drag-and-drop sortable */}
                        <QueueList
                            queue={queue}
                            currentIndex={currentIndex}
                            playFromQueue={playFromQueue}
                            removeFromQueue={removeFromQueue}
                            reorderQueue={reorderQueue}
                            isFavorite={isFavorite}
                            toggleFavorite={toggleFavorite}
                            isQueueLoading={isQueueLoading}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Add to Playlist Modal */}
            {selectedTrackForPlaylist && (
                <AddToPlaylistModal
                    isOpen={isPlaylistModalOpen}
                    onClose={() => setIsPlaylistModalOpen(false)}
                    trackId={selectedTrackForPlaylist.id}
                    trackTitle={selectedTrackForPlaylist.title}
                    artist={selectedTrackForPlaylist.artist}
                />
            )}

            {/* Download Options Modal */}
            <DownloadOptionsModal
                isOpen={isDownloadOptionsOpen}
                onClose={() => setIsDownloadOptionsOpen(false)}
                onSelectDownload={handleDownloadOption}
                trackTitle={currentTrack.title}
                artist={currentTrack.artist}
            />
        </motion.div>
    );
}

// ============================================================================
// Queue List Component with Drag-and-Drop
// ============================================================================

interface QueueListProps {
    queue: Track[];
    currentIndex: number;
    playFromQueue: (index: number) => void;
    removeFromQueue: (index: number) => void;
    reorderQueue: (fromIndex: number, toIndex: number) => void;
    isFavorite: (id: string | number) => boolean;
    toggleFavorite: (track: Track) => void;
    isQueueLoading?: boolean; // 🚀 NEW: Loading state for skeleton UI
}

function QueueList({
    queue,
    currentIndex,
    playFromQueue,
    removeFromQueue,
    reorderQueue,
    isFavorite,
    toggleFavorite,
    isQueueLoading = false
}: QueueListProps) {
    const upNextTracks = queue.slice(currentIndex + 1);

    // Generate unique IDs for sortable - use stable keys
    const trackIds = upNextTracks.map((track, idx) => `${track.id}-${currentIndex + 1 + idx}`);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // 8px movement required to start drag
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = trackIds.indexOf(active.id as string);
            const newIndex = trackIds.indexOf(over.id as string);

            // Convert to absolute queue indices
            const fromQueueIndex = currentIndex + 1 + oldIndex;
            const toQueueIndex = currentIndex + 1 + newIndex;

            reorderQueue(fromQueueIndex, toQueueIndex);
        }
    };

    // 🚀 SKELETON UI: Show placeholders while loading
    if (isQueueLoading && upNextTracks.length === 0) {
        return (
            <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
                {Array(5).fill(0).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg mb-1 animate-pulse">
                        <div className="w-10 h-10 rounded bg-white/10" />
                        <div className="flex-1 space-y-2">
                            <div className="h-3 bg-white/10 rounded w-3/4" />
                            <div className="h-2 bg-white/10 rounded w-1/2" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (upNextTracks.length === 0) {
        return (
            <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
                <div className="text-center py-10 text-muted-foreground">
                    <ListMusic className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No tracks in queue</p>
                    <p className="text-xs">Add songs to play next</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext items={trackIds} strategy={verticalListSortingStrategy}>
                    {upNextTracks.map((track, idx) => (
                        <SortableQueueItem
                            key={trackIds[idx]}
                            id={trackIds[idx]}
                            track={track}
                            idx={idx}
                            actualIndex={currentIndex + 1 + idx}
                            playFromQueue={playFromQueue}
                            removeFromQueue={removeFromQueue}
                            isFavorite={isFavorite}
                            toggleFavorite={toggleFavorite}
                        />
                    ))}
                </SortableContext>
            </DndContext>
        </div>
    );
}

// ============================================================================
// Sortable Queue Item Component
// ============================================================================

interface SortableQueueItemProps {
    id: string;
    track: Track;
    idx: number;
    actualIndex: number;
    playFromQueue: (index: number) => void;
    removeFromQueue: (index: number) => void;
    isFavorite: (id: string | number) => boolean;
    toggleFavorite: (track: Track) => void;
}

function SortableQueueItem({
    id,
    track,
    idx,
    actualIndex,
    playFromQueue,
    removeFromQueue,
    isFavorite,
    toggleFavorite
}: SortableQueueItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
        opacity: isDragging ? 0.8 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 group cursor-pointer ${isDragging ? 'bg-white/10 shadow-lg ring-2 ring-primary/50' : ''
                }`}
            onClick={() => !isDragging && playFromQueue(actualIndex)}
        >
            {/* Drag Handle */}
            <div
                {...attributes}
                {...listeners}
                className="w-5 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
                onClick={(e) => e.stopPropagation()}
            >
                <GripVertical className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-primary transition-colors" />
            </div>

            {/* Thumbnail */}
            <div className="w-10 h-10 rounded bg-white/5 overflow-hidden flex-shrink-0 relative">
                {track.thumbnail ? (
                    <img
                        src={track.thumbnail}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Music className="w-4 h-4 text-muted-foreground" />
                    </div>
                )}
                {/* Play Overlay on Hover */}
                {!isDragging && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-4 h-4 text-white fill-current" />
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{track.title}</p>
                <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-red-500"
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(track);
                    }}
                >
                    <Heart className={`w-3 h-3 ${isFavorite(track.id) ? 'fill-red-500 text-red-500' : ''}`} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-red-500"
                    onClick={(e) => {
                        e.stopPropagation();
                        removeFromQueue(actualIndex);
                    }}
                >
                    <Trash2 className="w-3 h-3" />
                </Button>
            </div>
        </div>
    );
}
