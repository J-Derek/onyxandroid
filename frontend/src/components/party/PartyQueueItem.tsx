import { motion } from "framer-motion";
import { GripVertical, X, Music, Play } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PartyTrack, usePartyPlayback } from "@/contexts/PartyPlaybackContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PartyQueueItemProps {
    track: PartyTrack;
    index: number;
    isNowPlaying: boolean;
}

export default function PartyQueueItem({ track, index, isNowPlaying }: PartyQueueItemProps) {
    const { removeFromQueue, playTrackAt, isHost, isPlaying } = usePartyPlayback();

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: track.queueId });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
    };

    return (
        <motion.div
            ref={setNodeRef}
            style={style}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, delay: index * 0.02 }}
            className={cn(
                "group flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 relative overflow-hidden border",
                isHost ? "cursor-pointer active:scale-[0.99]" : "cursor-default",
                isNowPlaying
                    ? "bg-primary/10 border-primary/30 ring-1 ring-primary/20"
                    : "bg-white/[0.03] border-white/5 hover:bg-white/[0.08] hover:border-white/10",
                isDragging ? "shadow-2xl scale-[1.02] z-50 ring-2 ring-primary bg-surface-1 border-primary/50" : ""
            )}
            onClick={() => isHost && playTrackAt(index)}
        >
            {/* Active Glow */}
            {isNowPlaying && (
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />
            )}

            {/* Drag Handle (Host Only) */}
            {isHost && (
                <div
                    {...attributes}
                    {...listeners}
                    onClick={(e) => e.stopPropagation()}
                    className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground/40 hover:text-primary transition-colors shrink-0"
                >
                    <GripVertical className="w-5 h-5" />
                </div>
            )}

            {/* Thumbnail */}
            <div className="w-14 h-14 rounded-xl bg-white/5 overflow-hidden flex-shrink-0 relative shadow-inner">
                {track.thumbnail ? (
                    <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Music className="w-6 h-6 text-muted-foreground/40" />
                    </div>
                )}

                {isNowPlaying && isPlaying && (
                    <div className="absolute inset-0 bg-primary/20 backdrop-blur-[2px] flex items-center justify-center">
                        <div className="flex gap-1 items-end h-4">
                            {[0, 1, 2].map((i) => (
                                <motion.div
                                    key={i}
                                    animate={{ height: [6, 16, 8, 14, 6][i] || 10 }}
                                    transition={{ duration: 0.6 + i * 0.2, repeat: Infinity, ease: "easeInOut" }}
                                    className="w-1 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Track Info */}
            <div className="flex-1 min-w-0">
                <p className={cn(
                    "text-base font-bold truncate leading-tight transition-colors",
                    isNowPlaying ? "text-primary" : "text-foreground group-hover:text-primary"
                )}>
                    {track.title}
                </p>
                <div className="flex items-center gap-3 mt-1 text-sm">
                    <span className={cn(
                        "truncate font-black uppercase tracking-widest text-[10px] opacity-40 transition-opacity",
                        isNowPlaying ? "opacity-100 text-primary/80" : "group-hover:opacity-80"
                    )}>
                        {track.artist}
                    </span>
                    {track.duration > 0 && (
                        <>
                            <span className="w-1 h-1 rounded-full bg-white/10" />
                            <span className="flex-shrink-0 font-mono text-[11px] font-medium opacity-30">
                                {Math.floor(track.duration / 60)}:{(Math.floor(track.duration % 60)).toString().padStart(2, '0')}
                            </span>
                        </>
                    )}
                </div>
            </div>

            {/* Actions (Host Only) */}
            {isHost && (
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                            e.stopPropagation();
                            removeFromQueue(track.queueId);
                        }}
                        className="opacity-0 group-hover:opacity-100 h-10 w-10 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                    >
                        <X className="w-5 h-5" />
                    </Button>
                </div>
            )}
        </motion.div>
    );
}

