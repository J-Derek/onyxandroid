import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { ListMusic, Trash2, Users } from "lucide-react";
import { usePartyPlayback } from "@/contexts/PartyPlaybackContext";
import PartyQueueItem from "./PartyQueueItem";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export default function PartyQueue() {
    const { queue, currentIndex, reorderQueue, clearQueue, isHost, sessionId } = usePartyPlayback();

    // Calculate remaining duration
    const remainingDuration = queue.slice(currentIndex + 1).reduce((acc, t) => acc + (t.duration || 0), 0);
    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    };

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;

        if (active.id !== over.id) {
            const oldIndex = queue.findIndex((t) => t.queueId === active.id);
            const newIndex = queue.findIndex((t) => t.queueId === over.id);
            reorderQueue(oldIndex, newIndex);
        }
    };

    if (queue.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground opacity-30">
                <ListMusic className="w-16 h-16 mb-4" />
                <p className="text-lg">The queue is currently empty.</p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-0 h-full">
            <div className="flex items-center justify-between px-6 py-6 border-b border-white/5 bg-black/20 backdrop-blur-xl shrink-0">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <ListMusic className="w-4 h-4 text-primary" />
                        </div>
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                            Up Next
                        </h3>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-lg font-black text-white tracking-tight">
                            {Math.max(0, queue.length - currentIndex - 1)} Tracks
                        </span>
                        {remainingDuration > 0 && (
                            <div className="flex items-center gap-2 bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
                                <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest">
                                    {formatDuration(remainingDuration)}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {!isHost && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/5 border border-primary/10 text-[10px] font-black text-primary uppercase tracking-widest">
                            <Users className="w-3.5 h-3.5" />
                            Guest View
                        </div>
                    )}
                    {isHost && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-11 w-11 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 transition-all"
                                    title="Clear entire queue"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-[#0a0a0a] border-white/10 rounded-[2rem] p-8 shadow-2xl backdrop-blur-3xl">
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="text-2xl font-black text-white tracking-tight">Clear Playlist?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-muted-foreground text-base mt-2">
                                        This will immediately remove all tracks from the queue and stop room playback for everyone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="mt-8 gap-3">
                                    <AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10 rounded-2xl h-12 px-6 transition-all">
                                        Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={clearQueue}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-2xl h-12 px-6 font-bold transition-all"
                                    >
                                        Clear Everything
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={isHost ? handleDragEnd : undefined}
                >
                    <SortableContext
                        items={queue.map((t) => t.queueId)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="space-y-3 pb-24">
                            {queue.map((track, index) => (
                                <PartyQueueItem
                                    key={track.queueId}
                                    track={track}
                                    index={index}
                                    isNowPlaying={index === currentIndex}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            </div>
        </div>
    );
}
