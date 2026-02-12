/**
 * Onyx Streaming - Mini Player
 * Persistent playback bar that expands into full screen.
 */
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, SkipForward, Maximize2, Volume2, Music } from "lucide-react";
import { usePlayback } from "@/contexts/PlaybackContext";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useState } from "react";
import NowPlaying from "./NowPlaying";

export default function MiniPlayer() {
    const {
        currentTrack,
        isPlaying,
        togglePlay,
        next,
        previous,
        progress,
        seek,
        currentTime,
        duration
    } = usePlayback();

    const [isExpanded, setIsExpanded] = useState(false);

    if (!currentTrack) return null;

    return (
        <>
            <motion.div
                initial={{ y: 100 }}
                animate={{ y: 0 }}
                className="fixed bottom-20 left-0 right-0 z-[60] px-4 pointer-events-none"
            >
                <motion.div
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.6}
                    onDragEnd={(_, info) => {
                        const threshold = 100;
                        if (info.offset.x > threshold) {
                            previous();
                        } else if (info.offset.x < -threshold) {
                            next();
                        }
                    }}
                    onClick={() => setIsExpanded(true)}
                    className="max-w-5xl mx-auto glass rounded-2xl p-2 flex items-center gap-4 cursor-pointer hover:bg-white/5 transition-colors pointer-events-auto shadow-2xl border border-white/10 relative overflow-hidden active:scale-[0.98] transition-all"
                >
                    {/* Progress Bar (Thin top line) */}
                    <div className="absolute top-0 left-2 right-2 h-1 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-primary"
                            initial={false}
                            animate={{ width: `${progress}%` }}
                        />
                    </div>

                    {/* Track Info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                            {currentTrack.thumbnail ? (
                                <img src={currentTrack.thumbnail} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Music className="w-6 h-6 text-muted-foreground" />
                                </div>
                            )}
                        </div>
                        <div className="min-w-0">
                            <h4 className="font-medium text-sm truncate">{currentTrack.title}</h4>
                            <p className="text-xs text-muted-foreground truncate">{currentTrack.artist}</p>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-1 pr-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 text-muted-foreground hover:text-white"
                            onClick={togglePlay}
                        >
                            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 text-muted-foreground hover:text-white"
                            onClick={next}
                        >
                            <SkipForward className="w-5 h-5" />
                        </Button>
                    </div>
                </motion.div>
            </motion.div>

            {/* Full Screen Immersive View */}
            <AnimatePresence>
                {isExpanded && (
                    <NowPlaying onClose={() => setIsExpanded(false)} />
                )}
            </AnimatePresence>
        </>
    );
}

