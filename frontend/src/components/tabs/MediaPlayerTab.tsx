import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Music, Plus, Trash2, GripVertical, FolderOpen, History, Shuffle, Repeat, List, Clock } from "lucide-react";

import { SectionHeader } from "@/components/shared/SectionHeader";
import { GlassCard } from "@/components/shared/GlassCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "../ui/button";
import { usePlayer, type MediaItem } from "@/contexts/PlayerContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Check if folder picker is supported
const folderPickerSupported = 'showDirectoryPicker' in window;

interface LocalFile {
    id: string;
    name: string;
    file: File;
    url: string;
    type: 'audio' | 'video';
    size: number;
}

interface MediaPlayerTabProps {
    downloadedFiles?: { name: string; path: string; thumbnail?: string; type: 'audio' | 'video' }[];
}

export function MediaPlayerTab({ downloadedFiles = [] }: MediaPlayerTabProps) {
    const { play, playPlaylist, currentMedia, isPlaying } = usePlayer();
    const [playlist, setPlaylist] = useState<LocalFile[]>([]);
    const [shuffleEnabled, setShuffleEnabled] = useState(false);
    const [repeatMode, setRepeatMode] = useState<'none' | 'all' | 'one'>('none');

    // Load last 9 files from History
    const handleLoadRecent = useCallback(() => {
        const recentFiles = downloadedFiles.slice(0, 9);
        if (recentFiles.length === 0) {
            toast.info("No files in History yet", { description: "Download some content first" });
            return;
        }

        const newFiles: LocalFile[] = recentFiles.map((file, i) => {
            const ext = file.name.split('.').pop()?.toLowerCase() || '';
            const videoExtensions = ['mp4', 'webm', 'mkv', 'avi', 'mov'];
            return {
                id: `recent-${Date.now()}-${i}`,
                name: file.name,
                file: new File([], file.name),
                url: `/api/library/stream/${encodeURIComponent(file.name)}`,
                type: videoExtensions.includes(ext) ? 'video' : 'audio',
                size: 0,
            };
        });

        setPlaylist(prev => [...prev, ...newFiles]);
        toast.success(`Added ${newFiles.length} recent files to playlist`);
    }, [downloadedFiles]);

    // File picker handler - use explicit extensions for better Windows support
    const handleAddFiles = useCallback(() => {
        const input = document.createElement('input');
        input.type = 'file';
        // Explicit extensions work better than MIME types on Windows
        input.accept = '.mp3,.mp4,.webm,.wav,.flac,.m4a,.ogg,.mkv,.avi,.mov,.aac,.wma,.opus';
        input.multiple = true;

        input.onchange = (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (!files) return;

            const newFiles: LocalFile[] = Array.from(files).map(file => {
                const ext = file.name.split('.').pop()?.toLowerCase() || '';
                const videoExtensions = ['mp4', 'webm', 'mkv', 'avi', 'mov'];

                return {
                    id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    name: file.name,
                    file,
                    url: URL.createObjectURL(file),
                    type: videoExtensions.includes(ext) ? 'video' : 'audio',
                    size: file.size,
                };
            });

            setPlaylist(prev => [...prev, ...newFiles]);
            toast.success(`Added ${newFiles.length} file(s) to playlist`);
        };

        input.click();
    }, []);

    // Folder picker handler (File System Access API)
    const handleAddFolder = useCallback(async () => {
        if (!folderPickerSupported) {
            toast.error("Folder picker not supported", { description: "Use Chrome or Edge for this feature" });
            return;
        }

        try {
            // @ts-expect-error - showDirectoryPicker is not in TypeScript types yet
            const dirHandle = await window.showDirectoryPicker();
            const audioVideoExtensions = ['mp3', 'mp4', 'webm', 'wav', 'flac', 'm4a', 'ogg', 'mkv', 'avi', 'mov'];
            const newFiles: LocalFile[] = [];

            for await (const entry of dirHandle.values()) {
                if (entry.kind === 'file') {
                    const ext = entry.name.split('.').pop()?.toLowerCase() || '';
                    if (audioVideoExtensions.includes(ext)) {
                        const file = await entry.getFile();
                        const videoExtensions = ['mp4', 'webm', 'mkv', 'avi', 'mov'];
                        newFiles.push({
                            id: `folder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            name: file.name,
                            file,
                            url: URL.createObjectURL(file),
                            type: videoExtensions.includes(ext) ? 'video' : 'audio',
                            size: file.size,
                        });
                    }
                }
            }

            if (newFiles.length > 0) {
                setPlaylist(prev => [...prev, ...newFiles]);
                toast.success(`Added ${newFiles.length} file(s) from folder`);
            } else {
                toast.info("No audio or video files found in folder");
            }
        } catch (err) {
            // User cancelled or error
            if ((err as Error).name !== 'AbortError') {
                console.error('Folder picker error:', err);
                toast.error("Failed to open folder");
            }
        }
    }, []);

    // Add from History
    const handleAddFromHistory = useCallback((file: { name: string; path: string; thumbnail?: string; type: 'audio' | 'video' }) => {
        const localFile: LocalFile = {
            id: `history-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: file.name,
            file: new File([], file.name), // Placeholder
            url: `/api/library/stream/${encodeURIComponent(file.name)}`,
            type: file.type,
            size: 0,
        };
        setPlaylist(prev => [...prev, localFile]);
        toast.success("Added to playlist", { description: file.name });
    }, []);

    // Play a file from playlist - sets entire playlist for next/prev
    const handlePlay = useCallback((file: LocalFile, index: number) => {
        // Convert all playlist items to MediaItems
        const mediaItems: MediaItem[] = playlist.map(f => ({
            id: f.id,
            title: f.name,
            src: f.url,
            type: f.type,
            source: 'local',
        }));

        // Play with full playlist for next/prev support
        playPlaylist(mediaItems, index);
    }, [playlist, playPlaylist]);

    // Remove from playlist
    const handleRemove = useCallback((id: string) => {
        setPlaylist(prev => {
            const item = prev.find(f => f.id === id);
            if (item && item.url.startsWith('blob:')) {
                URL.revokeObjectURL(item.url);
            }
            return prev.filter(f => f.id !== id);
        });
    }, []);

    // Clear playlist
    const handleClear = useCallback(() => {
        playlist.forEach(file => {
            if (file.url.startsWith('blob:')) {
                URL.revokeObjectURL(file.url);
            }
        });
        setPlaylist([]);
        toast.success("Playlist cleared");
    }, [playlist]);

    // Format file size
    const formatSize = (bytes: number) => {
        if (bytes === 0) return '';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <SectionHeader
                    title="Media Player"
                    gradientWord="Player"
                    subtitle={`${playlist.length} ${playlist.length === 1 ? "track" : "tracks"} in current session`}
                />

                <div className="flex items-center gap-3 bg-white/5 p-1 rounded-xl border border-white/10 backdrop-blur-md">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShuffleEnabled(!shuffleEnabled)}
                        className={cn("h-9 w-9 rounded-lg transition-all", shuffleEnabled ? "text-primary bg-primary/10" : "text-muted-foreground")}
                        title="Shuffle"
                    >
                        <Shuffle className="w-4 h-4" />
                    </Button>
                    <div className="w-px h-6 bg-white/10" />
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setRepeatMode(prev => prev === 'none' ? 'all' : prev === 'all' ? 'one' : 'none')}
                        className={cn("h-9 w-9 rounded-lg transition-all relative", repeatMode !== 'none' ? "text-primary bg-primary/10" : "text-muted-foreground")}
                        title={`Repeat: ${repeatMode}`}
                    >
                        <Repeat className="w-4 h-4" />
                        {repeatMode === 'one' && <span className="absolute top-1 right-1 text-[8px] font-bold">1</span>}
                    </Button>
                </div>
            </div>

            <GlassCard className="p-4 flex flex-wrap items-center gap-3 bg-surface-1/40 border-white/5">
                <Button onClick={handleAddFiles} variant="gradient" className="shadow-lg shadow-primary/20">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Tracks
                </Button>
                <Button onClick={handleAddFolder} variant="glass" disabled={!folderPickerSupported} className="border-white/10">
                    <FolderOpen className="w-4 h-4 mr-2" />
                    Add Folder
                    {!folderPickerSupported && <span className="ml-2 text-[10px] opacity-50 font-bold uppercase tracking-wider">(Unsupported)</span>}
                </Button>
                <div className="flex-1" />
                {playlist.length > 0 && (
                    <Button onClick={handleClear} variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 h-10 px-4">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Clear Playlist
                    </Button>
                )}
            </GlassCard>

            {/* Playlist */}
            {playlist.length === 0 ? (
                <EmptyState
                    icon={List}
                    title="Your playlist is empty"
                    description="Add local files or files from your download history to start playing"
                />
            ) : (
                <div className="space-y-2">
                    <AnimatePresence>
                        {playlist.map((file, index) => (
                            <motion.div
                                key={file.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -100 }}
                                transition={{ duration: 0.2 }}
                                className={`
                  flex items-center gap-4 p-4 rounded-xl glass border border-white/10
                  cursor-pointer hover:bg-white/5 transition-colors group
                  ${currentMedia?.id === file.id ? 'ring-2 ring-primary bg-primary/10' : ''}
                `}
                                onClick={() => handlePlay(file, index)}

                            >
                                {/* Drag Handle */}
                                <div className="opacity-0 group-hover:opacity-50 cursor-grab">
                                    <GripVertical className="w-4 h-4" />
                                </div>

                                {/* Index / Playing indicator */}
                                <div className="w-10 h-10 flex items-center justify-center shrink-0">
                                    {currentMedia?.id === file.id && isPlaying ? (
                                        <div className="flex items-end gap-1 h-5 pb-0.5">
                                            {[0, 1, 2].map((i) => (
                                                <motion.div
                                                    key={i}
                                                    animate={{ height: [6, 20, 10, 18, 6][i] || 10 }}
                                                    transition={{
                                                        duration: 0.6 + i * 0.2,
                                                        repeat: Infinity,
                                                        ease: "easeInOut"
                                                    }}
                                                    className="w-1.5 bg-primary rounded-full shadow-[0_0_8px_rgba(6,182,212,0.5)]"
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-sm font-bold font-mono text-muted-foreground/40 group-hover:text-primary transition-colors">
                                            {(index + 1).toString().padStart(2, '0')}
                                        </span>
                                    )}
                                </div>

                                {/* File Info */}
                                <div className="flex-1 min-w-0">
                                    <p className={cn(
                                        "font-bold truncate text-base leading-tight transition-colors",
                                        currentMedia?.id === file.id ? "text-primary" : "text-foreground group-hover:text-primary"
                                    )}>
                                        {file.name}
                                    </p>
                                    <div className="flex items-center gap-3 mt-1.5 opacity-60">
                                        <span className="text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-surface-2 border border-white/5">
                                            {file.type}
                                        </span>
                                        {file.size > 0 && <span className="text-[11px] font-medium">{formatSize(file.size)}</span>}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemove(file.id);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}

            {/* Add from History Section */}
            {downloadedFiles.length > 0 && (
                <div className="mt-8 pt-6 border-t border-white/10">
                    <div className="flex items-center gap-2 mb-4">
                        <History className="w-5 h-5 text-muted-foreground" />
                        <h3 className="font-semibold">Add from History</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
                        {downloadedFiles.slice(0, 12).map((file, index) => (
                            <button
                                key={index}
                                onClick={() => handleAddFromHistory(file)}
                                className="flex items-center gap-3 p-3 rounded-lg glass hover:bg-white/10 transition-colors text-left"
                            >
                                <div className="w-10 h-10 rounded bg-surface-2 flex items-center justify-center shrink-0">
                                    <Music className="w-5 h-5 text-muted-foreground" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{file.name}</p>
                                    <p className="text-xs text-muted-foreground uppercase">{file.type}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
