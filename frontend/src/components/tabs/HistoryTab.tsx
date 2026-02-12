import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, RefreshCw, Download, Trash2, Play, Video, Music, Filter, Calendar, ListMusic, Plus, X, Search } from "lucide-react";
import { LibraryCard, LibraryCardSkeleton } from "../LibraryCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import type { LibraryFile, FormatType } from "@/types";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { usePlayer, type MediaItem } from "@/contexts/PlayerContext";

// Local storage keys (shared with LibraryTab)
const FAVORITES_KEY = "onyx_favorites";
const PLAYLISTS_KEY = "onyx_playlists";

interface Playlist {
  id: string;
  name: string;
  files: string[]; // paths
  createdAt: string;
}

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

interface HistoryTabProps {
  onGoHome: () => void;
  onStartRedownload?: (url: string, format: FormatType, quality: string) => void;
}


type FilterType = "all" | "video" | "audio";
type SortType = "newest" | "oldest" | "name" | "size";

export function HistoryTab({ onGoHome, onStartRedownload }: HistoryTabProps) {
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<LibraryFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [ytdlpVersion, setYtdlpVersion] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Filter state
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("newest");

  // Global player
  const { play } = usePlayer();

  // Favorites state
  const [favorites, setFavorites] = useState<string[]>([]);

  // Playlist state
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [fileForPlaylist, setFileForPlaylist] = useState<LibraryFile | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState("");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");


  const loadLibrary = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getLibrary();
      setFiles(data);
    } catch (error) {
      console.error("Failed to load history:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadYtdlpVersion = useCallback(async () => {
    try {
      const { version } = await api.getYtdlpVersion();
      setYtdlpVersion(version);
    } catch (error) {
      console.error("Failed to get yt-dlp version:", error);
    }
  }, []);

  const handleUpdateYtdlp = async () => {
    setIsUpdating(true);
    try {
      const result = await api.updateYtdlp();
      if (result.success) {
        toast.success("yt-dlp Updated", { description: result.message });
        loadYtdlpVersion();
      } else {
        toast.error("Update Failed", { description: result.message });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error("Update Failed", { description: message });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRedownload = (sourceUrl: string, filename: string) => {
    if (!onStartRedownload) {
      toast.error("Re-download not available");
      return;
    }
    const ext = filename.split('.').pop()?.toLowerCase();
    const format: FormatType = ext === 'mp3' || ext === 'm4a' ? 'audio' : 'video';
    const quality = format === 'audio' ? '320kbps' : 'best';

    toast.info("Starting re-download", { description: filename });
    onStartRedownload(sourceUrl, format, quality);
  };

  const handlePlay = (file: LibraryFile) => {
    // Determine media type from file extension
    const ext = file.name.split('.').pop()?.toLowerCase();
    const videoExtensions = ['mp4', 'webm', 'mkv', 'avi', 'mov'];
    const mediaType = videoExtensions.includes(ext || '') ? 'video' : 'audio';

    const mediaItem: MediaItem = {
      id: file.path,
      title: file.title || file.name,
      artist: file.artist || "Unknown Artist",
      src: `/api/library/stream/${encodeURIComponent(file.name)}`,
      thumbnail: file.thumbnail,
      type: mediaType,
      source: 'downloaded',
    };

    play(mediaItem);
    toast.success(mediaType === 'video' ? "Playing video" : "Now playing", { description: file.name });
  };

  const toggleFavorite = (path: string) => {
    const newFavorites = favorites.includes(path)
      ? favorites.filter(f => f !== path)
      : [...favorites, path];
    setFavorites(newFavorites);
    saveFavorites(newFavorites);
    toast.success(favorites.includes(path) ? "Removed from favorites" : "Added to favorites");
  };

  // Playlist functions
  const openAddToPlaylist = (file: LibraryFile) => {
    setFileForPlaylist(file);
    setPlaylists(getPlaylists());
    setShowPlaylistModal(true);
  };

  const addToPlaylist = (playlistId: string) => {
    if (!fileForPlaylist) return;

    const updatedPlaylists = playlists.map(p => {
      if (p.id === playlistId) {
        if (p.files.includes(fileForPlaylist.path)) {
          toast.info("Already in playlist", { description: p.name });
          return p;
        }
        toast.success(`Added to "${p.name}"`);
        return { ...p, files: [...p.files, fileForPlaylist.path] };
      }
      return p;
    });

    setPlaylists(updatedPlaylists);
    savePlaylists(updatedPlaylists);
    setShowPlaylistModal(false);
    setFileForPlaylist(null);
  };

  const createNewPlaylist = () => {
    if (!newPlaylistName.trim()) {
      toast.error("Enter a playlist name");
      return;
    }
    const newPlaylist: Playlist = {
      id: Date.now().toString(),
      name: newPlaylistName,
      files: fileForPlaylist ? [fileForPlaylist.path] : [],
      createdAt: new Date().toISOString(),
    };
    const updatedPlaylists = [...playlists, newPlaylist];
    setPlaylists(updatedPlaylists);
    savePlaylists(updatedPlaylists);
    setNewPlaylistName("");
    setShowPlaylistModal(false);
    setFileForPlaylist(null);
    toast.success(`Created "${newPlaylist.name}" with 1 track`);
  };

  // Filter and sort files
  useEffect(() => {
    let result = [...files];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(f =>
        f.name.toLowerCase().includes(query) ||
        f.path.toLowerCase().includes(query) ||
        (f.source_url && f.source_url.toLowerCase().includes(query))
      );
    }

    // Apply type filter
    if (filter === "video") {
      result = result.filter(f => {
        const ext = f.name.split('.').pop()?.toLowerCase();
        return ['mp4', 'webm', 'mkv', 'avi', 'mov'].includes(ext || '');
      });
    } else if (filter === "audio") {
      result = result.filter(f => {
        const ext = f.name.split('.').pop()?.toLowerCase();
        return ['mp3', 'm4a', 'wav', 'flac', 'ogg'].includes(ext || '');
      });
    }

    // Apply sort
    switch (sort) {
      case "newest":
        result.sort((a, b) => new Date(b.modified_at).getTime() - new Date(a.modified_at).getTime());
        break;
      case "oldest":
        result.sort((a, b) => new Date(a.modified_at).getTime() - new Date(b.modified_at).getTime());
        break;
      case "name":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "size":
        result.sort((a, b) => b.size_mb - a.size_mb);
        break;
    }

    setFilteredFiles(result);
  }, [files, filter, sort, searchQuery]);

  useEffect(() => {
    loadLibrary();
    loadYtdlpVersion();
    setFavorites(getFavorites());
    setPlaylists(getPlaylists());
  }, [loadLibrary, loadYtdlpVersion]);


  // Count by type
  const videoCount = files.filter(f => {
    const ext = f.name.split('.').pop()?.toLowerCase();
    return ['mp4', 'webm', 'mkv', 'avi', 'mov'].includes(ext || '');
  }).length;
  const audioCount = files.filter(f => {
    const ext = f.name.split('.').pop()?.toLowerCase();
    return ['mp3', 'm4a', 'wav', 'flac', 'ogg'].includes(ext || '');
  }).length;

  if (isLoading) {
    return (
      <div className="space-y-4 pt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground">Download History</h2>
          <Button variant="glass" size="sm" disabled>
            <RefreshCw className="w-4 h-4 animate-spin" />
            Loading...
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <LibraryCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="pt-32 flex flex-col items-center">
        <EmptyState
          icon={Clock}
          title="No download history"
          description="Downloaded files will appear here. Start downloading videos to build your collection."
          action={{ label: "Start Downloading", onClick: onGoHome }}
        />
        {/* yt-dlp Update Section */}
        <div className="mt-8 p-4 rounded-lg bg-surface-1/50 border border-white/10">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-sm text-muted-foreground">yt-dlp version</p>
              <p className="font-mono text-foreground">{ytdlpVersion || "Loading..."}</p>
            </div>
            <Button
              variant="glass"
              size="sm"
              onClick={handleUpdateYtdlp}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Update yt-dlp
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg gradient-accent">
            <Clock className="w-5 h-5 text-accent-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Download History</h2>
            <p className="text-sm text-muted-foreground">{files.length} files total</p>
          </div>
        </div>
        <Button variant="glass" size="sm" onClick={loadLibrary}>
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search files by name, path, or URL..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 tech-input"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSearchQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6"
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-surface-1/30 border border-white/5">
        {/* Type Filter */}
        <div className="flex items-center gap-1">
          <Filter className="w-4 h-4 text-muted-foreground mr-1" />
          <Button
            variant={filter === "all" ? "default" : "ghost"}
            size="sm"
            onClick={() => setFilter("all")}
            className="h-7 text-xs"
          >
            All ({files.length})
          </Button>
          <Button
            variant={filter === "video" ? "default" : "ghost"}
            size="sm"
            onClick={() => setFilter("video")}
            className="h-7 text-xs"
          >
            <Video className="w-3 h-3 mr-1" />
            Video ({videoCount})
          </Button>
          <Button
            variant={filter === "audio" ? "default" : "ghost"}
            size="sm"
            onClick={() => setFilter("audio")}
            className="h-7 text-xs"
          >
            <Music className="w-3 h-3 mr-1" />
            Audio ({audioCount})
          </Button>
        </div>

        <div className="h-4 w-px bg-white/10" />

        {/* Sort */}
        <div className="flex items-center gap-1">
          <Calendar className="w-4 h-4 text-muted-foreground mr-1" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortType)}
            className="h-7 px-2 text-xs bg-background/50 border border-white/10 rounded-md text-foreground"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name">Name (A-Z)</option>
            <option value="size">Size (Largest)</option>
          </select>
        </div>
      </div>

      {/* File Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredFiles.map((file, index) => (
          <LibraryCard
            key={file.path}
            file={file}
            index={index}
            onRedownload={handleRedownload}
            onPlay={handlePlay}
            onAddToPlaylist={openAddToPlaylist}
          />
        ))}
      </div>



      {filteredFiles.length === 0 && files.length > 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No files match the current filter</p>
          <Button variant="ghost" size="sm" onClick={() => setFilter("all")} className="mt-2">
            Clear Filter
          </Button>
        </div>
      )}

      {/* yt-dlp Update Section */}
      <div className="p-4 rounded-lg bg-surface-1/50 border border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">yt-dlp version</p>
            <p className="font-mono text-foreground">{ytdlpVersion || "Loading..."}</p>
          </div>
          <Button
            variant="glass"
            size="sm"
            onClick={handleUpdateYtdlp}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Update yt-dlp
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Playback is now handled by global FloatingPlayer in App.tsx */}

      {/* Add to Playlist Modal */}
      <AnimatePresence>
        {showPlaylistModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setShowPlaylistModal(false); setFileForPlaylist(null); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Add to Playlist</h3>
                <Button variant="ghost" size="sm" onClick={() => { setShowPlaylistModal(false); setFileForPlaylist(null); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {fileForPlaylist && (
                <p className="text-sm text-muted-foreground mb-4 truncate">
                  Adding: {fileForPlaylist.name}
                </p>
              )}

              {/* Existing Playlists */}
              {playlists.length > 0 && (
                <div className="space-y-2 mb-4">
                  <p className="text-sm font-medium text-muted-foreground">Choose playlist:</p>
                  {playlists.map((playlist) => (
                    <Button
                      key={playlist.id}
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => addToPlaylist(playlist.id)}
                    >
                      <ListMusic className="w-4 h-4 mr-2" />
                      {playlist.name}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {playlist.files.length} tracks
                      </span>
                    </Button>
                  ))}
                </div>
              )}

              <div className="border-t border-white/10 pt-4">
                <p className="text-sm font-medium text-muted-foreground mb-2">Or create new:</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="New playlist name..."
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createNewPlaylist()}
                  />
                  <Button onClick={createNewPlaylist}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


