import { motion, AnimatePresence } from "framer-motion";
import {
    Play, Pause, SkipForward, SkipBack, Shuffle, Repeat,
    Volume2, VolumeX, ListMusic, Music, Heart, Laptop2,
    Maximize2, Mic2, X, Trash2
} from "lucide-react";
import { usePlayback } from "@/contexts/PlaybackContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import NowPlaying from "./NowPlaying";

export default function SpotifyPlayer() {
    const {
        currentTrack,
        isPlaying,
        togglePlay,
        next,
        previous,
        progress,
        seek,
        currentTime,
        duration,
        volume,
        setVolume,
        isMuted,
        toggleMute,
        isShuffle,
        toggleShuffle,
        repeatMode,
        setRepeatMode,
        queue,
        currentIndex,
        removeFromQueue,
        playFromQueue
    } = usePlayback();

    const { isFavorite, toggleFavorite } = useFavorites();
    const [localProgress, setLocalProgress] = useState(progress);
    const [isDragging, setIsDragging] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [showQueue, setShowQueue] = useState(false);

    useEffect(() => {
        if (!isDragging) {
            setLocalProgress(progress);
        }
    }, [progress, isDragging]);

    // Upcoming tracks in the queue (after the current index)
    const upcomingTracks = queue.slice(currentIndex + 1);

    if (!currentTrack) {
        // Placeholder bar when no track is playing
        return (
            <div className="h-24 bg-black border-t border-white/5 px-4 flex items-center justify-center select-none">
                <div className="flex items-center gap-3 text-muted-foreground">
                    <Music className="w-5 h-5" />
                    <span className="text-sm font-medium">Click a song to start listening</span>
                </div>
            </div>
        );
    }

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <>
            <div className="h-24 bg-black border-t border-white/5 px-4 flex items-center justify-between z-50 select-none">
                {/* 1. Left Section: Track Info */}
                <div className="flex items-center gap-4 w-[30%] min-w-[180px]">
                    <div className="w-14 h-14 rounded-md overflow-hidden bg-white/5 flex-shrink-0 shadow-lg group relative cursor-pointer" onClick={() => setIsExpanded(true)}>
                        {currentTrack.thumbnail ? (
                            <img
                                src={currentTrack.thumbnail}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = `https://i.ytimg.com/vi/${currentTrack.youtube_id || currentTrack.id}/hqdefault.jpg`;
                                }}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <Music className="w-6 h-6 text-muted-foreground" />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Maximize2 className="w-4 h-4 text-white" />
                        </div>
                    </div>
                    <div className="min-w-0 pr-2">
                        <h4 className="font-bold text-sm text-white truncate hover:underline cursor-pointer" onClick={() => setIsExpanded(true)}>
                            {currentTrack.title}
                        </h4>
                        <p className="text-xs text-muted-foreground truncate hover:underline cursor-pointer hover:text-white">
                            {currentTrack.artist}
                        </p>
                    </div>
                    <button
                        onClick={() => toggleFavorite(currentTrack)}
                        className={cn(
                            "transition-colors ml-2",
                            isFavorite(currentTrack.id) ? "text-[#1DB954]" : "text-muted-foreground hover:text-white"
                        )}
                    >
                        <Heart className={cn("w-5 h-5", isFavorite(currentTrack.id) && "fill-current")} />
                    </button>
                </div>

                {/* 2. Center Section: Playback Controls & Progress */}
                <div className="flex flex-col items-center max-w-[40%] flex-1 gap-1">
                    <div className="flex items-center gap-5">
                        <button
                            onClick={toggleShuffle}
                            title="Shuffle"
                            className={cn("transition-colors", isShuffle ? "text-[#1DB954]" : "text-muted-foreground hover:text-white")}
                        >
                            <Shuffle className="w-4 h-4" />
                        </button>
                        <button onClick={previous} title="Previous" className="text-muted-foreground hover:text-white transition-colors">
                            <SkipBack className="w-5 h-5 fill-current" />
                        </button>
                        <button
                            onClick={togglePlay}
                            title={isPlaying ? "Pause" : "Play"}
                            className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform shadow-md"
                        >
                            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                        </button>
                        <button onClick={next} title="Next" className="text-muted-foreground hover:text-white transition-colors">
                            <SkipForward className="w-5 h-5 fill-current" />
                        </button>
                        <button
                            onClick={() => setRepeatMode(repeatMode === 'all' ? 'none' : 'all')}
                            title="Repeat"
                            className={cn("transition-colors", repeatMode !== 'none' ? "text-[#1DB954]" : "text-muted-foreground hover:text-white")}
                        >
                            <Repeat className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="w-full flex items-center gap-2 group">
                        <span className="text-[10px] text-muted-foreground font-medium w-8 text-right">
                            {formatTime(currentTime)}
                        </span>
                        <div className="flex-1 px-1 py-2">
                            <Slider
                                value={[localProgress]}
                                max={100}
                                step={0.1}
                                onValueChange={(val) => {
                                    setIsDragging(true);
                                    setLocalProgress(val[0]);
                                }}
                                onValueCommit={(val) => {
                                    seek((val[0] / 100) * duration);
                                    setIsDragging(false);
                                }}
                                className="spotify-slider"
                            />
                        </div>
                        <span className="text-[10px] text-muted-foreground font-medium w-8">
                            {formatTime(duration)}
                        </span>
                    </div>
                </div>

                {/* 3. Right Section: Utility */}
                <div className="flex items-center justify-end gap-3 w-[30%] min-w-[200px]">
                    <button className="text-muted-foreground hover:text-white transition-colors p-1" title="Lyrics">
                        <Mic2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setShowQueue(!showQueue)}
                        className={cn(
                            "transition-colors p-1",
                            showQueue ? "text-[#1DB954]" : "text-muted-foreground hover:text-white"
                        )}
                        title="Queue"
                    >
                        <ListMusic className="w-5 h-5" />
                    </button>
                    <button className="text-muted-foreground hover:text-white transition-colors p-1" title="Connect Device">
                        <Laptop2 className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-2 w-28 group ml-2">
                        <button onClick={toggleMute} className="text-muted-foreground hover:text-white transition-colors">
                            {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        </button>
                        <Slider
                            value={[isMuted ? 0 : volume * 100]}
                            max={100}
                            onValueChange={(val) => setVolume(val[0] / 100)}
                            className="spotify-slider flex-1"
                        />
                    </div>
                    <button
                        onClick={() => setIsExpanded(true)}
                        className="text-muted-foreground hover:text-white transition-colors p-1"
                        title="Full Screen"
                    >
                        <Maximize2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Full Screen Immersive View */}
            <AnimatePresence>
                {isExpanded && (
                    <NowPlaying onClose={() => setIsExpanded(false)} />
                )}
            </AnimatePresence>

            {/* Queue / Up Next Panel */}
            <AnimatePresence>
                {showQueue && (
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed right-0 top-0 bottom-24 w-80 bg-[#121212] border-l border-white/10 z-[60] flex flex-col shadow-2xl"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-white/10">
                            <h3 className="font-bold text-white">Queue</h3>
                            <button onClick={() => setShowQueue(false)} className="text-muted-foreground hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Now Playing */}
                        <div className="px-4 pt-4 pb-2">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Now Playing</p>
                            <div className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
                                <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-white/10">
                                    {currentTrack.thumbnail ? (
                                        <img src={currentTrack.thumbnail} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Music className="w-4 h-4 text-muted-foreground" />
                                        </div>
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-[#1DB954] truncate">{currentTrack.title}</p>
                                    <p className="text-xs text-muted-foreground truncate">{currentTrack.artist}</p>
                                </div>
                            </div>
                        </div>

                        {/* Up Next */}
                        <div className="flex-1 overflow-y-auto px-4 pb-4">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 mt-4">Next Up</p>
                            {upcomingTracks.length > 0 ? (
                                <div className="space-y-1">
                                    {upcomingTracks.map((track, i) => {
                                        const absoluteIndex = currentIndex + 1 + i;
                                        return (
                                            <div
                                                key={`q-${absoluteIndex}-${track.id}`}
                                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors group cursor-pointer"
                                                onClick={() => playFromQueue(absoluteIndex)}
                                            >
                                                <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-white/10">
                                                    {track.thumbnail ? (
                                                        <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <Music className="w-4 h-4 text-muted-foreground" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-medium text-white truncate">{track.title}</p>
                                                    <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                                                </div>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); removeFromQueue(absoluteIndex); }}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-red-400"
                                                    title="Remove from queue"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <ListMusic className="w-10 h-10 text-white/10 mb-3" />
                                    <p className="text-sm text-muted-foreground">No upcoming tracks</p>
                                    <p className="text-xs text-muted-foreground/60 mt-1">Search for songs to add to your queue</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
