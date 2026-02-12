import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import {
    Play,
    Pause,
    SkipForward,
    SkipBack,
    RotateCcw,
    RotateCw,
    Volume2,
    VolumeX,
    Shuffle,
    Repeat,
    Repeat1,
    Infinity as InfinityIcon
} from "lucide-react";
import { usePartyPlayback } from "@/contexts/PartyPlaybackContext";
import { Button } from "@/components/ui/button";
import { useAudioOutputDevice } from "@/hooks/useAudioOutputDevice";
import { AudioOutputSelector } from "@/components/AudioOutputSelector";
import { motion } from "framer-motion";
import { useVoteToSkip } from "@/hooks/useVoteToSkip";
import { Vote } from "lucide-react";

export default function PartyControls() {
    const {
        togglePlay,
        playNext,
        playPrev,
        seekForward,
        seekBackward,
        seek,
        isPlaying,
        currentTrack,
        progress,
        currentTime,
        duration,
        volume,
        setVolume,
        // New mode states and toggles
        shuffle,
        repeatMode,
        endlessMode,
        toggleShuffle,
        cycleRepeatMode,
        toggleEndlessMode,
        audioRef,
        isHost
    } = usePartyPlayback();

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

    const {
        hasVoted,
        voteInfo,
        castVote,
        canVote
    } = useVoteToSkip();

    const progressBarRef = useRef<HTMLDivElement>(null);

    if (!currentTrack) return null;

    // Format time as M:SS
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Handle progress bar click for seeking
    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!progressBarRef.current || duration <= 0 || !isHost) return;
        const rect = progressBarRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = clickX / rect.width;
        const newTime = percentage * duration;
        seek(Math.max(0, Math.min(newTime, duration)));
    };

    // Get repeat icon based on mode
    const RepeatIcon = repeatMode === 'one' ? Repeat1 : Repeat;

    return (
        <div className="flex flex-col items-center w-full max-w-md mx-auto px-4">
            {/* Time Display */}
            <div className="w-full flex justify-between text-xs text-muted-foreground mb-2 font-mono">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
            </div>

            {/* Seekable Progress Bar */}
            <div
                ref={progressBarRef}
                onClick={handleProgressClick}
                className={cn(
                    "w-full h-2 bg-white/5 rounded-full mb-6 overflow-hidden relative transition-all duration-300",
                    isHost ? "cursor-pointer group hover:h-3" : "cursor-default"
                )}
            >
                <div
                    className="h-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-100 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                    style={{ width: `${progress}%` }}
                />
                {/* Active Indicator Glow */}
                {isPlaying && (
                    <motion.div
                        className="absolute top-0 bottom-0 w-20 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"
                        animate={{ left: ["-20%", "120%"] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    />
                )}
            </div>

            {/* Main Controls Row */}
            <div className="flex items-center justify-center gap-4">
                {/* Shuffle Toggle (Host Only) */}
                {isHost && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleShuffle}
                        className={cn(
                            "h-10 w-10 rounded-xl transition-all",
                            shuffle ? "text-primary bg-primary/10 border border-primary/20" : "hover:bg-white/5 text-muted-foreground border border-transparent"
                        )}
                        title={shuffle ? "Shuffle on" : "Shuffle off"}
                    >
                        <Shuffle className="w-4 h-4" />
                    </Button>
                )}

                {/* Previous Track (Host Only) */}
                {isHost && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={playPrev}
                        className="h-11 w-11 rounded-xl hover:bg-white/5 text-foreground/80"
                        title="Previous track"
                    >
                        <SkipBack className="w-5 h-5 fill-current opacity-50 shadow-sm" />
                    </Button>
                )}

                {/* Play/Pause (Host Only) */}
                {isHost && (
                    <Button
                        variant="gradient"
                        size="icon"
                        onClick={togglePlay}
                        className="h-16 w-16 rounded-3xl shadow-xl shadow-primary/20 scale-110 active:scale-95 transition-all"
                    >
                        {isPlaying ? (
                            <Pause className="w-8 h-8 fill-current" />
                        ) : (
                            <Play className="w-8 h-8 ml-1 fill-current" />
                        )}
                    </Button>
                )}

                {/* Guest Playback Indicator (Guest Only) */}
                {!isHost && (
                    <div className="flex flex-col items-center gap-6 pt-4">
                        <div className="flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl">
                            {isPlaying ? (
                                <div className="flex gap-1.5 items-end h-4 w-5">
                                    {[0, 1, 2].map((i) => (
                                        <motion.div
                                            key={i}
                                            animate={{ height: [6, 16, 6] }}
                                            transition={{ repeat: Infinity, duration: 0.5 + i * 0.1, ease: "easeInOut" }}
                                            className="w-1.5 bg-primary rounded-full shadow-[0_0_8px_rgba(6,182,212,0.4)]"
                                        />
                                    ))}
                                </div>
                            ) : (
                                <Pause className="w-4 h-4 text-muted-foreground/60" />
                            )}
                            <span className="text-[11px] font-black text-muted-foreground tracking-[0.2em] uppercase">
                                {isPlaying ? "Vibing together" : "Session Paused"}
                            </span>
                        </div>

                        {/* Vote to Skip Button */}
                        <div className="flex items-center gap-4">
                            <Button
                                onClick={castVote}
                                disabled={!canVote}
                                className={cn(
                                    "h-12 px-8 rounded-2xl font-black transition-all flex items-center gap-3 shadow-2xl",
                                    hasVoted
                                        ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                        : "bg-primary text-primary-foreground hover:scale-105 active:scale-95 shadow-primary/20"
                                )}
                            >
                                <Vote className={cn("w-5 h-5", hasVoted ? "" : "animate-bounce-short")} />
                                {hasVoted ? "Voted to Skip" : "Vote to Skip"}
                            </Button>

                            {voteInfo && (
                                <div className="flex flex-col items-start gap-0.5 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                                    <span className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground/40">
                                        Progress
                                    </span>
                                    <span className="text-xs font-black text-white/90">
                                        {voteInfo.votes}/{voteInfo.threshold}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Next Track (Host Only) */}
                {isHost && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={playNext}
                        className="h-11 w-11 rounded-xl hover:bg-white/5 text-foreground/80"
                        title="Next track"
                    >
                        <SkipForward className="w-5 h-5 fill-current opacity-50 shadow-sm" />
                    </Button>
                )}

                {/* Repeat Toggle (Host Only) */}
                {isHost && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={cycleRepeatMode}
                        className={cn(
                            "h-10 w-10 rounded-xl transition-all",
                            repeatMode !== 'off' ? "text-primary bg-primary/10 border border-primary/20" : "hover:bg-white/5 text-muted-foreground border border-transparent"
                        )}
                        title={repeatMode === 'off' ? "Repeat off" : repeatMode === 'all' ? "Repeat all" : "Repeat one"}
                    >
                        <RepeatIcon className="w-4 h-4" />
                    </Button>
                )}
            </div>

            {/* Secondary Row: Volume and Endless Mode */}
            <div className="flex items-center justify-center gap-3 mt-4 w-full">
                {/* Endless Mode Toggle (Host Only) */}
                {isHost && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleEndlessMode}
                        className={`h-9 w-9 rounded-full transition-all ${endlessMode ? "text-primary bg-primary/10" : "hover:bg-white/10 text-muted-foreground"
                            }`}
                        title={endlessMode ? "Auto-queue on — related tracks will be added" : "Auto-queue off"}
                    >
                        <InfinityIcon className="w-4 h-4" />
                    </Button>
                )}

                {/* Volume Control */}
                <div className="flex-1 flex items-center gap-3 max-w-xs">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setVolume(volume === 0 ? 0.8 : 0)}
                        className="h-9 w-9 rounded-full hover:bg-white/10"
                        title={volume === 0 ? "Unmute" : "Mute"}
                    >
                        {volume === 0 ? (
                            <VolumeX className="w-5 h-5 text-muted-foreground" />
                        ) : (
                            <Volume2 className="w-5 h-5 text-muted-foreground" />
                        )}
                    </Button>

                    {/* Volume Slider */}
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={volume}
                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                        className="flex-1 h-1.5 appearance-none bg-white/10 rounded-full cursor-pointer
                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary
                            [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0"
                        title={`Volume: ${Math.round(volume * 100)}%`}
                    />

                    <span className="text-xs text-muted-foreground font-mono w-10 text-right">
                        {Math.round(volume * 100)}%
                    </span>

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
                </div>
            </div>

        </div>
    );
}
