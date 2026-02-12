import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ListVideo, Video } from "lucide-react";

interface ConfirmPlaylistModalProps {
    isOpen: boolean;
    onClose: () => void;
    playlistTitle: string;
    videoCount: number;
    singleVideoTitle?: string; // Title of the specific video from URL (if available)
    onDownloadSingle: () => void;
    onDownloadPlaylist: () => void;
}

export function ConfirmPlaylistModal({
    isOpen,
    onClose,
    playlistTitle,
    videoCount,
    singleVideoTitle,
    onDownloadSingle,
    onDownloadPlaylist,
}: ConfirmPlaylistModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] glass border-white/10">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <ListVideo className="w-5 h-5 text-primary" />
                        Playlist Detected
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground pt-2" asChild>
                        <div>
                            This URL contains a playlist with <span className="font-semibold text-foreground">{videoCount} videos</span>.
                            {playlistTitle && (
                                <div className="mt-2 p-2 rounded-lg bg-black/20 border border-white/5">
                                    <span className="text-sm font-medium text-foreground line-clamp-2">{playlistTitle}</span>
                                </div>
                            )}
                        </div>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 my-4">
                    <p className="text-sm text-muted-foreground">What would you like to download?</p>

                    <Button
                        variant="outline"
                        className="w-full justify-start h-auto py-4 px-4 hover:border-primary/50"
                        onClick={() => {
                            onDownloadSingle();
                            onClose();
                        }}
                    >
                        <Video className="w-5 h-5 mr-3 flex-shrink-0" />
                        <div className="text-left">
                            <div className="font-semibold">Single Video Only</div>
                            <div className="text-xs text-muted-foreground">
                                {singleVideoTitle
                                    ? `Download: "${singleVideoTitle.length > 40 ? singleVideoTitle.substring(0, 40) + '...' : singleVideoTitle}"`
                                    : 'Download just the first video from this playlist'
                                }
                            </div>
                        </div>
                    </Button>

                    <Button
                        variant="gradient"
                        className="w-full justify-start h-auto py-4 px-4"
                        onClick={() => {
                            onDownloadPlaylist();
                            onClose();
                        }}
                    >
                        <Download className="w-5 h-5 mr-3 flex-shrink-0" />
                        <div className="text-left">
                            <div className="font-semibold">Entire Playlist ({videoCount} videos)</div>
                            <div className="text-xs opacity-90">Manage and download all videos in the playlist</div>
                        </div>
                    </Button>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
