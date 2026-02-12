import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Book, Download, Search, ListVideo, Settings } from "lucide-react";

interface ManualModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ManualModal({ isOpen, onClose }: ManualModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] glass border-white/10 h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <Book className="w-5 h-5 text-primary" />
                        Onyx User Manual
                    </DialogTitle>
                    <DialogDescription>
                        Everything you need to know about using Onyx.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 -mx-6 px-6 my-4 pr-4">
                    <div className="space-y-8">
                        {/* 1. Getting Started */}
                        <section className="space-y-3">
                            <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                                <Search className="w-4 h-4 text-accent" />
                                1. Finding Content
                            </h3>
                            <div className="space-y-2 text-sm text-muted-foreground pl-6 border-l-2 border-white/5">
                                <p>
                                    <strong className="text-foreground">Search:</strong> Type any song name, artist, or topic in the search bar to find videos instantly.
                                </p>
                                <p>
                                    <strong className="text-foreground">Paste URL:</strong> Already have a link? Paste a YouTube URL (video or playlist) directly into the search bar.
                                </p>
                                <p>
                                    <strong className="text-foreground">Trending:</strong> Check the "Trending Now" section for the latest hits.
                                </p>
                            </div>
                        </section>

                        {/* 2. Downloading */}
                        <section className="space-y-3">
                            <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                                <Download className="w-4 h-4 text-primary" />
                                2. Downloading
                            </h3>
                            <div className="space-y-2 text-sm text-muted-foreground pl-6 border-l-2 border-white/5">
                                <p>
                                    <strong className="text-foreground">Format & Quality:</strong> Choose between <strong>Video</strong> (MP4) or <strong>Audio</strong> (MP3) and select your preferred quality before downloading.
                                </p>
                                <p>
                                    <strong className="text-foreground">Queue:</strong> Add videos to your queue to download them later in bulk.
                                </p>
                                <p>
                                    <strong className="text-foreground">Playlists:</strong> Paste a playlist link to open the Playlist Manager. You can select specific videos, bulk delete, or limit the download count.
                                </p>
                            </div>
                        </section>

                        {/* 3. Managing Downloads */}
                        <section className="space-y-3">
                            <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                                <ListVideo className="w-4 h-4 text-success" />
                                3. Managing Downloads
                            </h3>
                            <div className="space-y-2 text-sm text-muted-foreground pl-6 border-l-2 border-white/5">
                                <p>
                                    <strong className="text-foreground">Queue Tab:</strong> Monitor active downloads, check speeds, and cancel tasks if needed.
                                </p>
                                <p>
                                    <strong className="text-foreground">Library Tab:</strong> Access all your downloaded files. You can play them directly or open their folder location.
                                </p>
                            </div>
                        </section>

                        {/* 4. Tips & Tricks */}
                        <section className="space-y-3">
                            <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                                <Settings className="w-4 h-4 text-warning" />
                                4. Tips & Tricks
                            </h3>
                            <div className="space-y-2 text-sm text-muted-foreground pl-6 border-l-2 border-white/5">
                                <p>
                                    • Use the <strong>Theme Toggle</strong> (Sun/Moon icon) to switch between Light and Dark modes.
                                </p>
                                <p>
                                    • Hover over the "Back to Home" button in the Queue tab to quickly return to search.
                                </p>
                                <p>
                                    • In the Playlist Manager, type a number in the "Stop after..." box to quickly grab just the top videos.
                                </p>
                            </div>
                        </section>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
