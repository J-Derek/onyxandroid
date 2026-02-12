import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Plus, Loader2 } from "lucide-react";
import type { VideoCard } from "@/types";

interface VideoPreviewModalProps {
    video: VideoCard | null;
    isOpen: boolean;
    isLoading?: boolean;
    onClose: () => void;
    onDownload: (video: VideoCard) => void;
    onAddToQueue: (video: VideoCard) => void;
}

export function VideoPreviewModal({
    video,
    isOpen,
    isLoading = false,
    onClose,
    onDownload,
    onAddToQueue,
}: VideoPreviewModalProps) {
    if (!video) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] glass border-white/10">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold line-clamp-1">{video.title}</DialogTitle>
                            <DialogDescription className="text-muted-foreground">
                                {video.uploader} • {video.views} • {video.duration}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 my-4">
                            <div className="relative aspect-video rounded-xl overflow-hidden shadow-2xl">
                                <img
                                    src={video.thumbnail}
                                    alt={video.title}
                                    className="w-full h-full object-cover"
                                />
                            </div>

                            <ScrollArea className="h-[100px] w-full rounded-md border border-white/5 bg-black/20 p-4">
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                    {video.description || "No description available."}
                                </p>
                            </ScrollArea>
                        </div>

                        <DialogFooter className="flex gap-2 sm:justify-end">
                            <Button variant="outline" onClick={() => onAddToQueue(video)}>
                                <Plus className="w-4 h-4 mr-2" />
                                Add to Queue
                            </Button>
                            <Button variant="gradient" onClick={() => onDownload(video)}>
                                <Download className="w-4 h-4 mr-2" />
                                Download Now
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
