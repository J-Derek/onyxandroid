import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, ListMusic, Music, Play, Trash2, Clock, User, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/contexts/FavoritesContext";
import { usePlayback, Track } from "@/contexts/PlaybackContext";
import { usePlaylists, Playlist } from "@/contexts/PlaylistContext";
import { toast } from "sonner";
import PlaylistGrid from "../playlists/PlaylistGrid";
import PlaylistView from "../playlists/PlaylistView";
import { cn } from "@/lib/utils";

export default function LibraryView() {
    const { favorites, removeFavorite } = useFavorites();
    const { playTrack, addToQueue, isOfflineMode } = usePlayback();
    const { fetchPlaylists } = usePlaylists();
    const [activeTab, setActiveTab] = useState<"favorites" | "playlists">("favorites");
    const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);

    const handlePlayTrack = (track: any) => {
        // Map Track schema to the one expected by playTrack if needed
        playTrack(track);
        toast.success(`Playing "${track.title}"`);
    };

    const handlePlayPlaylist = (playlist: Playlist, shuffle = false) => {
        if (!playlist.tracks || playlist.tracks.length === 0) {
            toast.error("Playlist is empty");
            return;
        }

        // Add all tracks to queue and play first
        const tracksToPlay = playlist.tracks.map(t => ({
            ...t,
            id: t.id.toString(), // context expects string IDs usually? No, let's check
            thumbnail: t.thumbnail_url || ""
        }));

        // Implement bulk play in context if possible, or just play first and add others
        // For now:
        playTrack(tracksToPlay[0] as any);
        tracksToPlay.slice(1).forEach(t => addToQueue(t as any));

        toast.success(`Playing playlist "${playlist.name}"`);
    };

    return (
        <div className="space-y-6 pt-6">
            {!selectedPlaylist && (
                <div className="flex gap-2 mb-8">
                    <button
                        onClick={() => setActiveTab("favorites")}
                        className={cn(
                            "px-4 py-1.5 rounded-full text-sm font-bold transition-all",
                            activeTab === "favorites" ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20"
                        )}
                    >
                        Favorites
                    </button>
                    <button
                        onClick={() => setActiveTab("playlists")}
                        className={cn(
                            "px-4 py-1.5 rounded-full text-sm font-bold transition-all",
                            activeTab === "playlists" ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20"
                        )}
                    >
                        Playlists
                    </button>
                </div>
            )}

            <AnimatePresence mode="wait">
                {selectedPlaylist ? (
                    <motion.div
                        key="playlist-view"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                    >
                        <PlaylistView
                            playlist={selectedPlaylist}
                            onBack={() => {
                                setSelectedPlaylist(null);
                                fetchPlaylists(); // Refresh
                            }}
                            onPlayTrack={(id) => {
                                // Find track in playlist and play
                                const track = selectedPlaylist.tracks?.find(t => t.id === id);
                                if (track) handlePlayTrack({ ...track, thumbnail: track.thumbnail_url });
                            }}
                            onPlayPlaylist={handlePlayPlaylist}
                        />
                    </motion.div>
                ) : activeTab === "favorites" ? (
                    <motion.div
                        key="favorites"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-4"
                    >
                        <div className="flex items-end gap-6 mb-8">
                            <div className="w-48 h-48 bg-gradient-to-br from-indigo-700 to-indigo-400 rounded-md shadow-2xl flex items-center justify-center shrink-0">
                                <Heart className="w-20 h-20 text-white fill-current" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <span className="text-xs font-bold uppercase">Playlist</span>
                                <h1 className="text-5xl lg:text-8xl font-black">Liked Songs</h1>
                                <div className="flex items-center gap-2 text-sm font-bold mt-4">
                                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-black font-bold text-[10px]">
                                        O
                                    </div>
                                    <span>Onyx User</span>
                                    <span className="text-white/60">• {favorites.length} songs</span>
                                </div>
                            </div>
                        </div>

                        {/* List Header */}
                        <div className="grid grid-cols-[16px_1fr_1fr_40px] gap-4 px-4 py-2 border-b border-white/10 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            <span>#</span>
                            <span>Title</span>
                            <span className="hidden md:block">Album</span>
                            <div className="flex justify-end pr-2">
                                <Clock className="w-4 h-4" />
                            </div>
                        </div>

                        {/* Track List */}
                        <div className="flex flex-col gap-0.5 mt-2">
                            {favorites.filter(f => !isOfflineMode || f.source === "cached").length > 0 ? (
                                favorites
                                    .filter(f => !isOfflineMode || f.source === "cached")
                                    .map((track: Track, index: number) => (
                                        <div
                                            key={track.id}
                                            className="grid grid-cols-[16px_1fr_1fr_40px] gap-4 px-4 py-2 rounded-md hover:bg-white/10 transition-colors group cursor-pointer"
                                            onClick={() => handlePlayTrack(track)}
                                        >
                                            <div className="flex items-center text-sm text-muted-foreground group-hover:text-white">
                                                <span className="group-hover:hidden">{index + 1}</span>
                                                <Play className="w-3 h-3 text-white hidden group-hover:block fill-current" />
                                            </div>
                                            <div className="flex items-center gap-3 min-w-0">
                                                <img src={track.thumbnail} alt="" className="w-10 h-10 rounded shadow-lg" />
                                                <div className="min-w-0">
                                                    <p className="font-bold text-sm text-white truncate">{track.title}</p>
                                                    <p className="text-xs text-muted-foreground truncate hover:underline">{track.artist}</p>
                                                </div>
                                            </div>
                                            <div className="hidden md:flex items-center text-sm text-muted-foreground">
                                                <span className="truncate hover:underline hover:text-white">{track.album || "YouTube Music"}</span>
                                            </div>
                                            <div className="flex items-center justify-end pr-2 text-xs text-muted-foreground">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); removeFavorite(track.id); }}
                                                    className="opacity-0 group-hover:opacity-100 text-primary hover:text-white transition-opacity mr-4"
                                                >
                                                    <Heart className="w-4 h-4 fill-current" />
                                                </button>
                                                <span>{track.duration ? `${Math.floor(track.duration / 60)}:${(track.duration % 60).toString().padStart(2, '0')}` : "--:--"}</span>
                                            </div>
                                        </div>
                                    ))
                            ) : (
                                <div className="text-center py-20 text-muted-foreground">
                                    <Heart className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                    <p>No favorite tracks yet, Add Some</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="playlists"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                    >
                        <PlaylistGrid
                            onSelectPlaylist={setSelectedPlaylist}
                            onPlayPlaylist={handlePlayPlaylist}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
