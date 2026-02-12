import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import {
    Play, Pause, X, Minimize2, Maximize2, Volume2, VolumeX,
    SkipBack, SkipForward, GripVertical, PictureInPicture2, Maximize
} from 'lucide-react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { usePlayer } from '@/contexts/PlayerContext';

export function FloatingPlayer() {
    const {
        currentMedia,
        playlist,
        isPlaying,
        currentTime,
        duration,
        volume,
        isMuted,
        isMinimized,
        togglePlay,
        pause,
        next,
        previous,
        seek,
        setVolume,
        toggleMute,
        close,
        minimize,
        maximize,
        updateTime,
        updateDuration,
        videoRef,
    } = usePlayer();

    const dragControls = useDragControls();
    const containerRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isPiP, setIsPiP] = useState(false);

    // Handle PiP events
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handlePiPEnter = () => setIsPiP(true);
        const handlePiPExit = () => setIsPiP(false);

        video.addEventListener('enterpictureinpicture', handlePiPEnter);
        video.addEventListener('leavepictureinpicture', handlePiPExit);

        return () => {
            video.removeEventListener('enterpictureinpicture', handlePiPEnter);
            video.removeEventListener('leavepictureinpicture', handlePiPExit);
        };
    }, [videoRef]);

    const togglePiP = async () => {
        const video = videoRef.current;
        if (!video || currentMedia?.type !== 'video') return;

        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else if (document.pictureInPictureEnabled) {
                await video.requestPictureInPicture();
            }
        } catch (err) {
            console.error('PiP error:', err);
        }
    };

    // Auto-play when video element is ready
    useEffect(() => {
        const video = videoRef.current;
        if (!video || currentMedia?.type !== 'video' || !isPlaying) return;

        video.play().catch(() => { });
    }, [currentMedia, isPlaying, videoRef]);

    const formatTime = (time: number) => {
        if (!isFinite(time)) return '0:00';
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const skip = (seconds: number) => {
        seek(Math.max(0, Math.min(duration, currentTime + seconds)));
    };

    const location = useLocation();

    if (!currentMedia || location.pathname === '/party') return null;

    // When in PiP mode, show only a small indicator
    if (isPiP) {
        return (
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
                    <span className="text-sm">Return to player</span>
                </Button>
            </motion.div>
        );
    }

    return (
        <AnimatePresence>
            <motion.div
                ref={containerRef}
                drag
                dragControls={dragControls}
                dragMomentum={false}
                dragElastic={0}
                onDragEnd={(_, info) => {
                    setPosition(prev => ({
                        x: prev.x + info.offset.x,
                        y: prev.y + info.offset.y,
                    }));
                }}
                initial={{ opacity: 0, scale: 0.9, y: 50 }}
                animate={{
                    opacity: 1,
                    scale: 1,
                    y: 0,
                    width: isMinimized ? 320 : (currentMedia.type === 'video' ? 480 : 400),
                    height: isMinimized ? 80 : 'auto',
                }}
                exit={{ opacity: 0, scale: 0.9, y: 50 }}
                style={{ x: position.x, y: position.y }}
                className="fixed bottom-6 right-6 z-50 rounded-2xl bg-black/95 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden"
            >
                {/* Drag Handle */}
                <div
                    className="absolute top-2 left-1/2 -translate-x-1/2 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-white/10 z-10"
                    onPointerDown={(e) => dragControls.start(e)}
                >
                    <GripVertical className="w-4 h-4 text-white/50" />
                </div>

                {/* Video Area (only for video, when not minimized) */}
                {currentMedia.type === 'video' && !isMinimized && (
                    <div className="relative aspect-video bg-black">
                        <video
                            ref={videoRef}
                            src={currentMedia.src}
                            className="w-full h-full object-contain"
                            onClick={togglePlay}
                            onTimeUpdate={(e) => updateTime(e.currentTarget.currentTime)}
                            onLoadedMetadata={(e) => updateDuration(e.currentTarget.duration)}
                            onEnded={pause}
                            playsInline
                        />

                        {!isPlaying && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <div
                                    className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center cursor-pointer hover:bg-white/30"
                                    onClick={togglePlay}
                                >
                                    <Play className="w-7 h-7 text-white ml-1" />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Controls */}
                <div className={`p-4 ${isMinimized ? 'flex items-center gap-3' : 'space-y-3'}`}>
                    {/* Thumbnail + Title (minimized mode) */}
                    {isMinimized && (
                        <>
                            {currentMedia.thumbnail ? (
                                <img
                                    src={currentMedia.thumbnail}
                                    alt=""
                                    className="w-12 h-12 rounded-lg object-cover"
                                />
                            ) : (
                                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/50 to-accent/50 flex items-center justify-center">
                                    <Volume2 className="w-5 h-5 text-white" />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{currentMedia.title}</p>
                                <p className="text-xs text-white/50">{formatTime(currentTime)} / {formatTime(duration)}</p>
                            </div>
                        </>
                    )}

                    {/* Title (expanded mode) */}
                    {!isMinimized && (
                        <div className="flex items-center gap-3">
                            {currentMedia.type === 'audio' && currentMedia.thumbnail && (
                                <img
                                    src={currentMedia.thumbnail}
                                    alt=""
                                    className="w-14 h-14 rounded-lg object-cover"
                                />
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-white truncate">{currentMedia.title}</p>
                            </div>
                        </div>
                    )}

                    {/* Progress Bar (expanded mode) */}
                    {!isMinimized && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-white/70 w-10">{formatTime(currentTime)}</span>
                            <Slider
                                value={[currentTime]}
                                max={duration || 100}
                                step={0.1}
                                onValueChange={([val]) => seek(val)}
                                className="flex-1"
                            />
                            <span className="text-xs text-white/70 w-10 text-right">{formatTime(duration)}</span>
                        </div>
                    )}

                    {/* Playback Controls */}
                    <div className={`flex items-center ${isMinimized ? '' : 'justify-between'}`}>
                        <div className="flex items-center gap-1">
                            {!isMinimized && playlist.length > 1 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={previous}
                                    className="text-white hover:bg-white/10"
                                    title="Previous track"
                                >
                                    <SkipBack className="w-4 h-4" />
                                </Button>
                            )}

                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={togglePlay}
                                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
                            >
                                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                            </Button>

                            {!isMinimized && playlist.length > 1 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={next}
                                    className="text-white hover:bg-white/10"
                                    title="Next track"
                                >
                                    <SkipForward className="w-4 h-4" />
                                </Button>
                            )}
                        </div>

                        {/* Volume (expanded mode) */}
                        {!isMinimized && (
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={toggleMute}
                                    className="text-white hover:bg-white/10"
                                >
                                    {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                                </Button>
                                <Slider
                                    value={[isMuted ? 0 : volume]}
                                    max={1}
                                    step={0.01}
                                    onValueChange={([val]) => setVolume(val)}
                                    className="w-20"
                                />
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1 ml-auto">
                            {currentMedia.type === 'video' && !isMinimized && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        const video = videoRef.current;
                                        if (!video) return;
                                        if (document.fullscreenElement) {
                                            document.exitFullscreen();
                                        } else {
                                            video.requestFullscreen().catch(() => { });
                                        }
                                    }}
                                    className="text-white hover:bg-white/10"
                                    title="Fullscreen"
                                >
                                    <Maximize className="w-4 h-4" />
                                </Button>
                            )}
                            {currentMedia.type === 'video' && document.pictureInPictureEnabled && !isMinimized && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={togglePiP}
                                    className="text-white hover:bg-white/10"
                                    title="Picture-in-Picture"
                                >
                                    <PictureInPicture2 className="w-4 h-4" />
                                </Button>
                            )}

                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={isMinimized ? maximize : minimize}
                                className="text-white hover:bg-white/10"
                                title={isMinimized ? "Expand" : "Minimize"}
                            >
                                {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                            </Button>

                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={close}
                                className="text-white/60 hover:text-white hover:bg-white/10"
                                title="Close"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
