import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Star, Folder, BarChart3, ListMusic, Tag, Search,
    Sparkles, CheckSquare, HardDrive, Copy, Share2,
    Plus, Trash2, Edit2, Play, ChevronRight, X,
    Clock, Music, Video, FileAudio, FileVideo, Pause, SkipForward
} from "lucide-react";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { GlassCard } from "@/components/shared/GlassCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { AudioPlayer } from "../AudioPlayer";
import { cn } from "@/lib/utils";
import type { LibraryFile } from "@/types";
import { toast } from "sonner";
import { api } from "@/lib/api";

// Types
interface Playlist {
    id: string;
    name: string;
    files: string[]; // paths
    createdAt: string;
}

interface LibraryTabProps {
    onGoHome: () => void;
}

type TabView = "favorites" | "folders" | "stats" | "playlists";

// Local storage helpers
const FAVORITES_KEY = "onyx_favorites";
const PLAYLISTS_KEY = "onyx_playlists";

function getFavorites(): string[] {
    try {
        return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
    } catch {
        return [];
    }
}

function saveFavorites(favorites: string[]) {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

function getPlaylists(): Playlist[] {
    try {
        return JSON.parse(localStorage.getItem(PLAYLISTS_KEY) || "[]");
    } catch {
        return [];
    }
}

function savePlaylists(playlists: Playlist[]) {
    localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
}

export function LibraryTab({ onGoHome }: LibraryTabProps) {
    const [activeView, setActiveView] = useState<TabView>("favorites");
    const [files, setFiles] = useState<LibraryFile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [favorites, setFavorites] = useState<string[]>([]);
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
    const [showNewPlaylistModal, setShowNewPlaylistModal] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState("");

    // Playback state
    const [playingFile, setPlayingFile] = useState<LibraryFile | null>(null);
    const [playlistQueue, setPlaylistQueue] = useState<LibraryFile[]>([]);
    const [currentQueueIndex, setCurrentQueueIndex] = useState(0);

    // Playlist edit state
    const [expandedPlaylistId, setExpandedPlaylistId] = useState<string | null>(null);
    const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
    const [editPlaylistName, setEditPlaylistName] = useState("");


    const loadLibrary = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await api.getLibrary();
            setFiles(data);
        } catch (error) {
            toast.error("Failed to load library");
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Load data
    useEffect(() => {
        loadLibrary();
        setFavorites(getFavorites());
        setPlaylists(getPlaylists());

        // Listen for storage changes from other tabs
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === FAVORITES_KEY) {
                setFavorites(getFavorites());
            }
            if (e.key === PLAYLISTS_KEY) {
                setPlaylists(getPlaylists());
            }
        };
        window.addEventListener('storage', handleStorageChange);

        // Poll for changes within same tab (storage events don't fire in same tab)
        const interval = setInterval(() => {
            setFavorites(getFavorites());
            setPlaylists(getPlaylists());
        }, 1000);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            clearInterval(interval);
        };
    }, [loadLibrary]);

    // Computed values
    const stats = useMemo(() => {
        const totalSize = files.reduce((acc, f) => acc + f.size_mb, 0);
        const audioCount = files.filter(f => f.type === "audio").length;
        const videoCount = files.filter(f => f.type === "video").length;
        return { totalSize, audioCount, videoCount, totalCount: files.length };
    }, [files]);

    const favoriteFiles = useMemo(() => {
        return files.filter(f => favorites.includes(f.path));
    }, [files, favorites]);

    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return files;
        const query = searchQuery.toLowerCase();
        return files.filter(f => f.name.toLowerCase().includes(query));
    }, [files, searchQuery]);

    const folderStructure = useMemo(() => {
        const folders: Record<string, LibraryFile[]> = { "Root": [] };
        files.forEach(file => {
            const parts = file.path.split(/[/\\]/);
            if (parts.length > 1) {
                const folder = parts.slice(0, -1).join("/");
                if (!folders[folder]) folders[folder] = [];
                folders[folder].push(file);
            } else {
                folders["Root"].push(file);
            }
        });
        return folders;
    }, [files]);

    // Actions
    const toggleFavorite = (path: string) => {
        const newFavorites = favorites.includes(path)
            ? favorites.filter(f => f !== path)
            : [...favorites, path];
        setFavorites(newFavorites);
        saveFavorites(newFavorites);
        toast.success(favorites.includes(path) ? "Removed from favorites" : "Added to favorites");
    };

    const createPlaylist = () => {
        if (!newPlaylistName.trim()) {
            toast.error("Please enter a playlist name");
            return;
        }
        const playlist: Playlist = {
            id: Date.now().toString(),
            name: newPlaylistName,
            files: Array.from(selectedFiles),
            createdAt: new Date().toISOString(),
        };
        const newPlaylists = [...playlists, playlist];
        setPlaylists(newPlaylists);
        savePlaylists(newPlaylists);
        setNewPlaylistName("");
        setShowNewPlaylistModal(false);
        setSelectedFiles(new Set());
        toast.success(`Created playlist "${playlist.name}"`);
    };

    const deletePlaylist = (id: string) => {
        const newPlaylists = playlists.filter(p => p.id !== id);
        setPlaylists(newPlaylists);
        savePlaylists(newPlaylists);
        toast.success("Playlist deleted");
    };

    const toggleFileSelection = (path: string) => {
        const newSelected = new Set(selectedFiles);
        if (newSelected.has(path)) {
            newSelected.delete(path);
        } else {
            newSelected.add(path);
        }
        setSelectedFiles(newSelected);
    };

    // Playback functions
    const playFile = (file: LibraryFile) => {
        if (file.type !== "audio") {
            toast.info("Video playback not supported yet");
            return;
        }
        setPlayingFile(file);
        setPlaylistQueue([]);
        toast.success("Now playing", { description: file.name });
    };

    const playPlaylist = (playlist: Playlist) => {
        const playlistFiles = playlist.files
            .map(path => files.find(f => f.path === path))
            .filter((f): f is LibraryFile => f !== undefined && f.type === "audio");

        if (playlistFiles.length === 0) {
            toast.error("No playable audio files in playlist");
            return;
        }

        setPlaylistQueue(playlistFiles);
        setCurrentQueueIndex(0);
        setPlayingFile(playlistFiles[0]);
        toast.success(`Playing "${playlist.name}"`, { description: `${playlistFiles.length} tracks` });
    };

    const playNext = () => {
        if (playlistQueue.length === 0) return;
        const nextIndex = currentQueueIndex + 1;
        if (nextIndex < playlistQueue.length) {
            setCurrentQueueIndex(nextIndex);
            setPlayingFile(playlistQueue[nextIndex]);
        } else {
            // End of playlist
            setPlayingFile(null);
            setPlaylistQueue([]);
            setCurrentQueueIndex(0);
            toast.info("Playlist ended");
        }
    };

    const handleClosePlayer = () => {
        setPlayingFile(null);
        setPlaylistQueue([]);
        setCurrentQueueIndex(0);
    };

    // Playlist editing functions
    const toggleExpandPlaylist = (id: string) => {
        setExpandedPlaylistId(expandedPlaylistId === id ? null : id);
    };

    const startEditPlaylist = (playlist: Playlist) => {
        setEditingPlaylistId(playlist.id);
        setEditPlaylistName(playlist.name);
    };

    const savePlaylistName = () => {
        if (!editingPlaylistId || !editPlaylistName.trim()) return;
        const updatedPlaylists = playlists.map(p =>
            p.id === editingPlaylistId ? { ...p, name: editPlaylistName.trim() } : p
        );
        setPlaylists(updatedPlaylists);
        savePlaylists(updatedPlaylists);
        setEditingPlaylistId(null);
        setEditPlaylistName("");
        toast.success("Playlist renamed");
    };

    const removeFromPlaylist = (playlistId: string, filePath: string) => {
        const updatedPlaylists = playlists.map(p => {
            if (p.id === playlistId) {
                return { ...p, files: p.files.filter(f => f !== filePath) };
            }
            return p;
        });
        setPlaylists(updatedPlaylists);
        savePlaylists(updatedPlaylists);
        toast.success("Track removed from playlist");
    };

    // Get files for a playlist
    const getPlaylistFiles = (playlist: Playlist): LibraryFile[] => {
        return playlist.files
            .map(path => files.find(f => f.path === path))
            .filter((f): f is LibraryFile => f !== undefined);
    };

    const tabs = [
        { id: "favorites" as const, label: "Favorites", icon: Star, count: favoriteFiles.length },
        { id: "folders" as const, label: "Folders", icon: Folder, count: Object.keys(folderStructure).length },
        { id: "stats" as const, label: "Statistics", icon: BarChart3 },
        { id: "playlists" as const, label: "Playlists", icon: ListMusic, count: playlists.length },
    ];

    return (
        <div className="space-y-6 pt-8 pb-20">
            {/* Header */}
            <SectionHeader
                title="My Library"
                gradientWord="Library"
                subtitle={`${stats.totalCount} files • ${stats.totalSize.toFixed(1)} MB total storage`}
            />

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                    placeholder="Search your library..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 tech-input"
                />
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeView === tab.id;
                    return (
                        <Button
                            key={tab.id}
                            variant={isActive ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setActiveView(tab.id)}
                            className={`flex items-center gap-2 ${isActive ? "gradient-primary" : ""}`}
                        >
                            <Icon className="w-4 h-4" />
                            {tab.label}
                            {tab.count !== undefined && (
                                <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-white/20">
                                    {tab.count}
                                </span>
                            )}
                        </Button>
                    );
                })}
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
                {activeView === "favorites" && (
                    <motion.div
                        key="favorites"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4"
                    >
                        {favoriteFiles.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <Star className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p className="text-lg font-medium">No favorites yet</p>
                                <p className="text-sm">Star files in History to add them here</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {favoriteFiles.map((file) => (
                                    <FileCard
                                        key={file.path}
                                        file={file}
                                        isFavorite={true}
                                        onToggleFavorite={() => toggleFavorite(file.path)}
                                        onPlay={() => playFile(file)}
                                    />
                                ))}
                            </div>
                        )}

                    </motion.div>
                )}

                {activeView === "folders" && (
                    <motion.div
                        key="folders"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4"
                    >
                        {Object.entries(folderStructure).map(([folder, folderFiles]) => (
                            <div key={folder} className="glass rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <Folder className="w-5 h-5 text-primary" />
                                    <span className="font-medium">{folder}</span>
                                    <span className="text-sm text-muted-foreground">({folderFiles.length} files)</span>
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                    {folderFiles.slice(0, 3).map((file) => (
                                        <div key={file.path} className="flex items-center gap-2 text-sm text-muted-foreground">
                                            {file.type === "audio" ? <FileAudio className="w-4 h-4" /> : <FileVideo className="w-4 h-4" />}
                                            <span className="truncate">{file.name}</span>
                                        </div>
                                    ))}
                                    {folderFiles.length > 3 && (
                                        <span className="text-xs text-muted-foreground">+{folderFiles.length - 3} more</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </motion.div>
                )}

                {activeView === "stats" && (
                    <motion.div
                        key="stats"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="grid grid-cols-2 md:grid-cols-4 gap-4"
                    >
                        <StatCard icon={FileAudio} label="Audio Files" value={stats.audioCount} color="cyan" />
                        <StatCard icon={FileVideo} label="Video Files" value={stats.videoCount} color="purple" />
                        <StatCard icon={HardDrive} label="Total Size" value={`${stats.totalSize.toFixed(1)} MB`} color="green" />
                        <StatCard icon={Star} label="Favorites" value={favoriteFiles.length} color="yellow" />
                    </motion.div>
                )}

                {activeView === "playlists" && (
                    <motion.div
                        key="playlists"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4"
                    >
                        <Button
                            variant="glass"
                            size="sm"
                            onClick={() => setShowNewPlaylistModal(true)}
                            className="w-full"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Create New Playlist
                        </Button>

                        {playlists.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <ListMusic className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p className="text-lg font-medium">No playlists yet</p>
                                <p className="text-sm">Create a playlist to organize your downloads</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {playlists.map((playlist) => {
                                    const isExpanded = expandedPlaylistId === playlist.id;
                                    const isEditing = editingPlaylistId === playlist.id;
                                    const playlistFiles = getPlaylistFiles(playlist);

                                    return (
                                        <div key={playlist.id} className="glass rounded-xl overflow-hidden">
                                            {/* Header */}
                                            <div
                                                className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                                                onClick={() => toggleExpandPlaylist(playlist.id)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 rounded-lg gradient-accent">
                                                        <ListMusic className="w-5 h-5 text-white" />
                                                    </div>
                                                    <div>
                                                        {isEditing ? (
                                                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                                <Input
                                                                    value={editPlaylistName}
                                                                    onChange={(e) => setEditPlaylistName(e.target.value)}
                                                                    className="h-7 w-40"
                                                                    onKeyDown={(e) => e.key === "Enter" && savePlaylistName()}
                                                                    autoFocus
                                                                />
                                                                <Button size="sm" onClick={savePlaylistName}>Save</Button>
                                                                <Button size="sm" variant="ghost" onClick={() => setEditingPlaylistId(null)}>
                                                                    <X className="w-3 h-3" />
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <p className="font-medium">{playlist.name}</p>
                                                                <p className="text-sm text-muted-foreground">{playlist.files.length} tracks</p>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => playPlaylist(playlist)}
                                                        title="Play playlist"
                                                        className="text-primary"
                                                    >
                                                        <Play className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => startEditPlaylist(playlist)}
                                                        title="Edit name"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => deletePlaylist(playlist.id)}
                                                        title="Delete playlist"
                                                    >
                                                        <Trash2 className="w-4 h-4 text-destructive" />
                                                    </Button>
                                                    <ChevronRight
                                                        className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                                    />
                                                </div>
                                            </div>

                                            {/* Expanded tracks */}
                                            <AnimatePresence>
                                                {isExpanded && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: "auto", opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="border-t border-white/10"
                                                    >
                                                        {playlistFiles.length === 0 ? (
                                                            <p className="p-4 text-center text-sm text-muted-foreground">
                                                                No tracks yet. Add songs from History.
                                                            </p>
                                                        ) : (
                                                            <div className="p-2 space-y-1 max-h-60 overflow-y-auto">
                                                                {playlistFiles.map((file, idx) => (
                                                                    <div
                                                                        key={file.path}
                                                                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 group"
                                                                    >
                                                                        <span className="text-xs text-muted-foreground w-6">{idx + 1}</span>
                                                                        {file.thumbnail ? (
                                                                            <img src={file.thumbnail} alt="" className="w-8 h-8 rounded object-cover" />
                                                                        ) : (
                                                                            <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center">
                                                                                <FileAudio className="w-4 h-4 text-primary" />
                                                                            </div>
                                                                        )}
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-sm truncate">{file.name}</p>
                                                                        </div>
                                                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => playFile(file)}
                                                                                className="h-6 w-6 p-0"
                                                                            >
                                                                                <Play className="w-3 h-3" />
                                                                            </Button>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => removeFromPlaylist(playlist.id, file.path)}
                                                                                className="h-6 w-6 p-0 text-destructive"
                                                                            >
                                                                                <X className="w-3 h-3" />
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>


            {/* New Playlist Modal */}
            <AnimatePresence>
                {showNewPlaylistModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowNewPlaylistModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="glass rounded-2xl p-6 max-w-md w-full"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-xl font-bold mb-4">Create Playlist</h3>
                            <Input
                                placeholder="Playlist name..."
                                value={newPlaylistName}
                                onChange={(e) => setNewPlaylistName(e.target.value)}
                                className="mb-4"
                            />
                            <div className="flex gap-2 justify-end">
                                <Button variant="ghost" onClick={() => setShowNewPlaylistModal(false)}>Cancel</Button>
                                <Button onClick={createPlaylist}>Create</Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Audio Player */}
            <AudioPlayer
                src={playingFile ? `/api/library/stream/${playingFile.path}` : ""}
                title={playingFile?.name || ""}
                isVisible={!!playingFile}
                onClose={handleClosePlayer}
            />

            {/* Now Playing Info (for playlist) */}
            {playlistQueue.length > 1 && playingFile && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40">
                    <div className="glass rounded-full px-4 py-2 flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">
                            {currentQueueIndex + 1}/{playlistQueue.length}
                        </span>
                        {currentQueueIndex + 1 < playlistQueue.length && (
                            <>
                                <span className="text-muted-foreground">•</span>
                                <span className="text-muted-foreground">Next:</span>
                                <span className="max-w-32 truncate">{playlistQueue[currentQueueIndex + 1]?.name}</span>
                                <Button size="sm" variant="ghost" onClick={playNext} className="ml-2">
                                    <SkipForward className="w-4 h-4" />
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}


// Helper Components
function FileCard({ file, isFavorite, onToggleFavorite, onPlay }: {
    file: LibraryFile;
    isFavorite: boolean;
    onToggleFavorite: () => void;
    onPlay?: () => void;
}) {
    const Icon = file.type === "audio" ? FileAudio : FileVideo;
    const isAudio = file.type === "audio";

    return (
        <GlassCard className="p-3 flex items-center gap-4 group cursor-default transition-all duration-300 border-white/5 bg-surface-1/40 hover:border-primary/30">
            {file.thumbnail ? (
                <div
                    className="w-14 h-14 rounded-xl overflow-hidden relative cursor-pointer shadow-lg shrink-0"
                    onClick={isAudio && onPlay ? onPlay : undefined}
                >
                    <img src={file.thumbnail} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    {isAudio && onPlay && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center pl-0.5 shadow-lg shadow-primary/20">
                                <Play className="w-4 h-4 text-primary-foreground fill-current" />
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div
                    className={cn(
                        "w-14 h-14 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300",
                        isAudio ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent",
                        isAudio && onPlay ? "cursor-pointer group-hover:scale-105" : ""
                    )}
                    onClick={isAudio && onPlay ? onPlay : undefined}
                >
                    <Icon className="w-6 h-6" />
                </div>
            )}
            <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">{file.name}</p>
                <div className="flex items-center gap-3 mt-1 opacity-70">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{file.size_mb.toFixed(1)} MB</span>
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                    <span className="text-[11px] text-muted-foreground font-medium">{isAudio ? "Audio" : "Video"}</span>
                </div>
            </div>
            <div className="flex gap-2">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onToggleFavorite}
                    className={cn(
                        "h-9 w-9 transition-colors",
                        isFavorite ? "text-yellow-500 bg-yellow-500/10" : "text-muted-foreground hover:bg-white/5"
                    )}
                >
                    <Star className={cn("w-4 h-4", isFavorite ? "fill-current" : "")} />
                </Button>
            </div>
        </GlassCard>
    );
}


function StatCard({ icon: Icon, label, value, color }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string | number;
    color: "cyan" | "purple" | "green" | "yellow";
}) {
    const colorClasses = {
        cyan: "bg-primary/10 text-primary border-primary/20",
        purple: "bg-accent/10 text-accent border-accent/20",
        green: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
        yellow: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    };

    return (
        <GlassCard className="p-6 text-center border-white/5 bg-surface-1/40 hover:scale-[1.02] transition-transform">
            <div className={cn("w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center border", colorClasses[color])}>
                <Icon className="w-7 h-7" />
            </div>
            <p className="text-3xl font-bold tracking-tight mb-1 text-foreground">{value}</p>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground opacity-60 italic">{label}</p>
        </GlassCard>
    );
}
