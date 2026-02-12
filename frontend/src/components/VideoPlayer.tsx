import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Volume2, VolumeX, X, Maximize2, Minimize2, PictureInPicture2 } from "lucide-react";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";

interface VideoPlayerProps {
    src: string;
    title: string;
    thumbnail?: string;
    onClose: () => void;
    isVisible: boolean;
}

export function VideoPlayer({ src, title, thumbnail, onClose, isVisible }: VideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0.8);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isPiP, setIsPiP] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const updateTime = () => setCurrentTime(video.currentTime);
        const updateDuration = () => setDuration(video.duration || 0);
        const handleEnded = () => setIsPlaying(false);

        video.addEventListener("timeupdate", updateTime);
        video.addEventListener("loadedmetadata", updateDuration);
        video.addEventListener("ended", handleEnded);

        return () => {
            video.removeEventListener("timeupdate", updateTime);
            video.removeEventListener("loadedmetadata", updateDuration);
            video.removeEventListener("ended", handleEnded);
        };
    }, [src]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        if (isPlaying) {
            video.play().catch(() => setIsPlaying(false));
        } else {
            video.pause();
        }
    }, [isPlaying]);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.volume = isMuted ? 0 : volume;
        }
    }, [volume, isMuted]);

    // Auto-play when modal opens
    useEffect(() => {
        if (isVisible && videoRef.current) {
            setIsPlaying(true);
        }
    }, [isVisible, src]);

    const togglePlay = () => setIsPlaying(!isPlaying);
    const toggleMute = () => setIsMuted(!isMuted);

    const handleSeek = (value: number[]) => {
        const newTime = value[0];
        if (videoRef.current) {
            videoRef.current.currentTime = newTime;
            setCurrentTime(newTime);
        }
    };

    const handleVolumeChange = (value: number[]) => {
        setVolume(value[0]);
        setIsMuted(false);
    };

    const toggleFullscreen = async () => {
        if (!containerRef.current) return;

        if (!isFullscreen) {
            try {
                await containerRef.current.requestFullscreen();
                setIsFullscreen(true);
            } catch (err) {
                console.error("Fullscreen error:", err);
            }
        } else {
            try {
                await document.exitFullscreen();
                setIsFullscreen(false);
            } catch (err) {
                console.error("Exit fullscreen error:", err);
            }
        }
    };

    // Listen for fullscreen changes
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, []);

    // Listen for PiP changes
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handlePiPEnter = () => setIsPiP(true);
        const handlePiPExit = () => setIsPiP(false);

        video.addEventListener("enterpictureinpicture", handlePiPEnter);
        video.addEventListener("leavepictureinpicture", handlePiPExit);

        return () => {
            video.removeEventListener("enterpictureinpicture", handlePiPEnter);
            video.removeEventListener("leavepictureinpicture", handlePiPExit);
        };
    }, []);

    const togglePiP = async () => {
        const video = videoRef.current;
        if (!video) return;

        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else if (document.pictureInPictureEnabled) {
                await video.requestPictureInPicture();
            }
        } catch (err) {
            console.error("PiP error:", err);
        }
    };

    const formatTime = (time: number) => {
        if (!isFinite(time)) return "0:00";
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const handleVideoClick = () => {
        togglePlay();
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <>
                    {/* Minimized indicator when PiP is active */}
                    {isPiP && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className="fixed bottom-4 right-4 z-50"
                        >
                            <Button
                                onClick={togglePiP}
                                className="bg-black/90 hover:bg-black text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2"
                            >
                                <PictureInPicture2 className="w-4 h-4" />
                                <span className="text-sm">Return to full player</span>
                            </Button>
                        </motion.div>
                    )}

                    {/* Full modal (hidden when PiP is active) */}
                    {!isPiP && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
                            onClick={onClose}
                        >

                            <motion.div
                                ref={containerRef}
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                className="relative w-full max-w-4xl rounded-xl overflow-hidden bg-black shadow-2xl"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Video */}
                                <div className="relative aspect-video bg-black">
                                    <video
                                        ref={videoRef}
                                        src={src}
                                        className="w-full h-full object-contain"
                                        poster={thumbnail}
                                        onClick={handleVideoClick}
                                        playsInline
                                    />

                                    {/* Play overlay when paused */}
                                    {!isPlaying && (
                                        <div
                                            className="absolute inset-0 flex items-center justify-center cursor-pointer"
                                            onClick={handleVideoClick}
                                        >
                                            <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors">
                                                <Play className="w-10 h-10 text-white ml-1" />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Controls */}
                                <div className="p-4 bg-gradient-to-t from-black/90 to-transparent">
                                    {/* Title */}
                                    <p className="text-white font-medium truncate mb-3">{title}</p>

                                    {/* Progress bar */}
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className="text-xs text-white/70 w-12">{formatTime(currentTime)}</span>
                                        <Slider
                                            value={[currentTime]}
                                            max={duration || 100}
                                            step={0.1}
                                            onValueChange={handleSeek}
                                            className="flex-1"
                                        />
                                        <span className="text-xs text-white/70 w-12 text-right">{formatTime(duration)}</span>
                                    </div>

                                    {/* Control buttons */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {/* Play/Pause */}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={togglePlay}
                                                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
                                            >
                                                {isPlaying ? (
                                                    <Pause className="w-5 h-5" />
                                                ) : (
                                                    <Play className="w-5 h-5 ml-0.5" />
                                                )}
                                            </Button>

                                            {/* Volume */}
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={toggleMute}
                                                    className="text-white hover:bg-white/10"
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
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {/* Picture-in-Picture */}
                                            {document.pictureInPictureEnabled && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={togglePiP}
                                                    className={isPiP ? "text-primary hover:bg-white/10" : "text-white hover:bg-white/10"}
                                                    title={isPiP ? "Exit Picture-in-Picture" : "Picture-in-Picture"}
                                                >
                                                    <PictureInPicture2 className="w-4 h-4" />
                                                </Button>
                                            )}

                                            {/* Fullscreen */}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={toggleFullscreen}
                                                className="text-white hover:bg-white/10"
                                            >
                                                {isFullscreen ? (
                                                    <Minimize2 className="w-4 h-4" />
                                                ) : (
                                                    <Maximize2 className="w-4 h-4" />
                                                )}
                                            </Button>

                                            {/* Close */}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={onClose}
                                                className="text-white hover:bg-white/10"
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </>
            )}
        </AnimatePresence>
    );
}
