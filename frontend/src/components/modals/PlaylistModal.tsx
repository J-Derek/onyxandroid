import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Trash2, ArrowUp, ArrowDown, FolderInput, Filter, GripVertical } from "lucide-react";
import type { VideoCard, FormatType } from "@/types";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { VIDEO_QUALITIES, AUDIO_QUALITIES } from "@/types";

interface PlaylistModalProps {
    isOpen: boolean;
    onClose: () => void;
    playlistTitle: string;
    videos: VideoCard[];
    onDownloadPlaylist: (videos: VideoCard[], folderName: string, format: FormatType, quality: string) => void;
    onAddToQueue?: (video: VideoCard) => void;
}

export function PlaylistModal({
    isOpen,
    onClose,
    playlistTitle,
    videos: initialVideos,
    onDownloadPlaylist,
    onAddToQueue
}: PlaylistModalProps) {
    const [videos, setVideos] = useState<VideoCard[]>(initialVideos);
    const [folderName, setFolderName] = useState(playlistTitle);
    const [format, setFormat] = useState<FormatType>("audio");
    const [quality, setQuality] = useState("320kbps");
    const [filterOption, setFilterOption] = useState<string>("all");
    const [customCount, setCustomCount] = useState<string>("");

    const qualityOptions = format === "video" ? VIDEO_QUALITIES : AUDIO_QUALITIES;

    useEffect(() => {
        setVideos(initialVideos);
        setFolderName(playlistTitle);
    }, [initialVideos, playlistTitle]);

    useEffect(() => {
        setQuality(qualityOptions[0].value);
    }, [format, qualityOptions]);

    // Apply filter to videos
    const getFilteredVideos = () => {
        switch (filterOption) {
            case "first10":
                return videos.slice(0, 10);
            case "first20":
                return videos.slice(0, 20);
            case "first50":
                return videos.slice(0, 50);
            case "custom": {
                const count = parseInt(customCount);
                return isNaN(count) ? videos : videos.slice(0, count);
            }
            case "all":
            default:
                return videos;
        }
    };

    const filteredVideos = getFilteredVideos();

    const handleRemove = (id: string) => {
        setVideos((prev) => prev.filter((v) => v.id !== id));
    };

    const handleMove = (index: number, direction: "up" | "down") => {
        const newVideos = [...videos];
        if (direction === "up" && index > 0) {
            [newVideos[index], newVideos[index - 1]] = [newVideos[index - 1], newVideos[index]];
        } else if (direction === "down" && index < newVideos.length - 1) {
            [newVideos[index], newVideos[index + 1]] = [newVideos[index + 1], newVideos[index]];
        }
        setVideos(newVideos);
    };

    const handleDownload = () => {
        onDownloadPlaylist(filteredVideos, folderName, format, quality);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[800px] glass border-white/10 h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <FolderInput className="w-5 h-5 text-primary" />
                        Download Playlist
                    </DialogTitle>
                    <DialogDescription>
                        Review and organize videos before downloading.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 -mx-6 px-6 my-4">
                    <div className="space-y-6">
                        {/* Folder Name */}
                        <div className="space-y-2">
                            <Label htmlFor="folder-name">Folder Name</Label>
                            <Input
                                id="folder-name"
                                value={folderName}
                                onChange={(e) => setFolderName(e.target.value)}
                                className="bg-black/20 border-white/10"
                                placeholder="Enter folder name"
                            />
                        </div>

                        {/* Format and Quality Selection */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Format</Label>
                                <Select value={format} onValueChange={(value: FormatType) => setFormat(value)}>
                                    <SelectTrigger className="bg-black/20 border-white/10">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="video">Video</SelectItem>
                                        <SelectItem value="audio">Audio</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Quality</Label>
                                <Select value={quality} onValueChange={setQuality}>
                                    <SelectTrigger className="bg-black/20 border-white/10">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {qualityOptions.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Filter Options */}
                        <div className="flex items-end gap-4">
                            <div className="flex-1 space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Filter className="w-3 h-3" />
                                    Filter Videos
                                </Label>
                                <div className="flex gap-2">
                                    <Select value={filterOption} onValueChange={(val) => {
                                        setFilterOption(val);
                                        if (val !== 'custom') setCustomCount('');
                                    }}>
                                        <SelectTrigger className="bg-black/20 border-white/10 flex-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Videos ({videos.length})</SelectItem>
                                            <SelectItem value="first10">First 10</SelectItem>
                                            <SelectItem value="first20">First 20</SelectItem>
                                            <SelectItem value="first50">First 50</SelectItem>
                                            <SelectItem value="custom">Custom Count</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {filterOption === 'custom' && (
                                        <Input
                                            type="number"
                                            placeholder="Count"
                                            value={customCount}
                                            onChange={(e) => setCustomCount(e.target.value)}
                                            className="w-24 bg-black/20 border-white/10"
                                            min="1"
                                            max={videos.length}
                                        />
                                    )}
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setVideos([])} className="text-destructive hover:text-destructive">
                                Clear All
                            </Button>
                        </div>

                        {/* Video List */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                                <span>{filteredVideos.length} of {videos.length} videos will be downloaded</span>
                                <span className="text-xs opacity-70">Drag to reorder</span>
                            </div>

                            <div className="rounded-md border border-white/10 bg-black/20 p-3">
                                <Reorder.Group axis="y" values={videos} onReorder={setVideos} className="space-y-2">
                                    <AnimatePresence mode="popLayout">
                                        {filteredVideos.map((video) => (
                                            <Reorder.Item
                                                key={video.id}
                                                value={video}
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                className="flex items-center gap-3 p-2 rounded-lg bg-white/5 group hover:bg-white/10 transition-colors cursor-grab active:cursor-grabbing"
                                            >
                                                <div className="text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
                                                    <GripVertical className="w-4 h-4" />
                                                </div>

                                                <div className="relative w-20 h-12 rounded overflow-hidden flex-shrink-0">
                                                    <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium line-clamp-1">{video.title}</p>
                                                    <p className="text-xs text-muted-foreground truncate">{video.duration} • {video.uploader}</p>
                                                </div>

                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        onClick={(e) => {
                                                            e.stopPropagation(); // Prevent drag start
                                                            handleRemove(video.id);
                                                        }}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </Reorder.Item>
                                        ))}
                                    </AnimatePresence>
                                </Reorder.Group>
                                {filteredVideos.length === 0 && (
                                    <div className="text-center py-12 text-muted-foreground">
                                        No videos selected
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </ScrollArea>

                <DialogFooter className="flex gap-2 sm:justify-end">
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="gradient"
                        onClick={handleDownload}
                        disabled={filteredVideos.length === 0 || !folderName.trim()}
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Download {format === "audio" ? "Audio" : "Video"} ({filteredVideos.length})
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
