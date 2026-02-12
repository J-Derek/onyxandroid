import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Volume2, VolumeX, X, SkipBack, SkipForward } from "lucide-react";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { useAudioOutputDevice } from "@/hooks/useAudioOutputDevice";
import { AudioOutputSelector } from "@/components/AudioOutputSelector";

interface AudioPlayerProps {
    src: string;
    title: string;
    thumbnail?: string;
    onClose: () => void;
    isVisible: boolean;
}

export function AudioPlayer({ src, title, thumbnail, onClose, isVisible }: AudioPlayerProps) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0.8);
    const [isMuted, setIsMuted] = useState(false);

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

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const updateTime = () => setCurrentTime(audio.currentTime);
        const updateDuration = () => setDuration(audio.duration || 0);
        const handleEnded = () => setIsPlaying(false);

        audio.addEventListener("timeupdate", updateTime);
        audio.addEventListener("loadedmetadata", updateDuration);
        audio.addEventListener("ended", handleEnded);

        return () => {
            audio.removeEventListener("timeupdate", updateTime);
            audio.removeEventListener("loadedmetadata", updateDuration);
            audio.removeEventListener("ended", handleEnded);
        };
    }, [src]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
            audio.play().catch(() => setIsPlaying(false));
        } else {
            audio.pause();
        }
    }, [isPlaying]);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = isMuted ? 0 : volume;
        }
    }, [volume, isMuted]);

    const togglePlay = () => setIsPlaying(!isPlaying);
    const toggleMute = () => setIsMuted(!isMuted);

    const handleSeek = (value: number[]) => {
        const newTime = value[0];
        if (audioRef.current) {
            audioRef.current.currentTime = newTime;
            setCurrentTime(newTime);
        }
    };

    const handleVolumeChange = (value: number[]) => {
        setVolume(value[0]);
        setIsMuted(false);
    };

    const skip = (seconds: number) => {
        if (audioRef.current) {
            audioRef.current.currentTime = Math.max(0, Math.min(duration, currentTime + seconds));
        }
    };

    const formatTime = (time: number) => {
        if (!isFinite(time)) return "0:00";
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ type: "spring", bounce: 0.1, duration: 0.6 }}
                    className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-6"
                >
                    <div className="max-w-4xl mx-auto rounded-3xl bg-[#03060b]/80 backdrop-blur-3xl border border-white/10 shadow-[0_-20px_50px_-12px_rgba(0,0,0,0.5)] p-5 relative overflow-hidden">
                        {/* Interactive Background Glow */}
                        <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

                        <audio ref={audioRef} src={src} preload="metadata" />

                        <div className="flex items-center gap-4">
                            {/* Thumbnail */}
                            {thumbnail ? (
                                <img
                                    src={thumbnail}
                                    alt={title}
                                    className="w-14 h-14 rounded-lg object-cover"
                                />
                            ) : (
                                <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-primary/50 to-purple-500/50 flex items-center justify-center">
                                    <Volume2 className="w-6 h-6 text-white" />
                                </div>
                            )}

                            {/* Info & Controls */}
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-foreground truncate text-base mb-2 tracking-tight">{title}</p>

                                {/* Progress Slider */}
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-mono font-bold text-muted-foreground/60 w-10">
                                        {formatTime(currentTime)}
                                    </span>
                                    <Slider
                                        value={[currentTime]}
                                        max={duration || 100}
                                        step={0.1}
                                        onValueChange={handleSeek}
                                        className="flex-1"
                                    />
                                    <span className="text-[10px] font-mono font-bold text-muted-foreground/60 w-10 text-right">
                                        {formatTime(duration)}
                                    </span>
                                </div>
                            </div>

                            {/* Playback Controls */}
                            <div className="flex items-center gap-2 px-2">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => skip(-10)}
                                    className="text-muted-foreground hover:text-foreground hover:bg-white/5 h-10 w-10 rounded-xl"
                                >
                                    <SkipBack className="w-5 h-5 fill-current opacity-50" />
                                </Button>

                                <Button
                                    variant="gradient"
                                    size="icon"
                                    onClick={togglePlay}
                                    className="w-14 h-14 rounded-2xl shadow-lg shadow-primary/20 scale-110 active:scale-95 transition-transform"
                                >
                                    {isPlaying ? (
                                        <Pause className="w-6 h-6 fill-current" />
                                    ) : (
                                        <Play className="w-6 h-6 ml-1 fill-current" />
                                    )}
                                </Button>

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => skip(10)}
                                    className="text-muted-foreground hover:text-foreground hover:bg-white/5 h-10 w-10 rounded-xl"
                                >
                                    <SkipForward className="w-5 h-5 fill-current opacity-50" />
                                </Button>
                            </div>

                            {/* Volume Control */}
                            <div className="flex items-center gap-3 w-40 pl-4 border-l border-white/5">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={toggleMute}
                                    className="text-muted-foreground hover:text-foreground hover:bg-white/5 h-9 w-9 rounded-lg"
                                >
                                    {isMuted || volume === 0 ? (
                                        <VolumeX className="w-4 h-4" />
                                    ) : (
                                        <Volume2 className="w-4 h-4" />
                                    )}
                                </Button>
                                <Slider
                                    value={[isMuted ? 0 : volume]}
                                    max={1}
                                    step={0.01}
                                    onValueChange={handleVolumeChange}
                                    className="w-20"
                                />

                                <AudioOutputSelector
                                    availableDevices={availableDevices}
                                    selectedDeviceId={selectedDeviceId}
                                    onSelectDevice={setOutputDevice}
                                    isSupported={isDeviceSelectorSupported}
                                    hasPermission={hasPermission}
                                    onRefreshDevices={refreshDevices}
                                    onRequestPermission={requestPermission}
                                    className="h-9 w-9 text-muted-foreground hover:text-foreground"
                                />
                            </div>

                            {/* Close Button */}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onClose}
                                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-10 w-10 rounded-xl ml-2"
                            >
                                <X className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
