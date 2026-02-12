/**
 * Onyx Streaming - Home View (Redesigned to match Downloads aesthetic)
 * Dashboard for quick access and recent activity.
 */
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Play, Heart, Clock, ListMusic, Music, PlayCircle, Loader2, ListPlus, X, Search, RefreshCw, TrendingUp, Plus, WifiOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayback, Track as PlayerTrack, TrackSource } from "@/contexts/PlaybackContext";
import { useFavorites, FavoriteTrack } from "@/contexts/FavoritesContext";
import { toast } from "sonner";
import AddToPlaylistModal from "../playlists/AddToPlaylistModal";
import { cn } from "@/lib/utils";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface BackendTrack {
    id: number;
    title: string;
    artist: string;
    album?: string;
    thumbnail_url?: string;
    duration: number;
    source: TrackSource;
    youtube_id?: string;
}

export default function HomeView({ onNavigateToPlaylists }: { onNavigateToPlaylists?: () => void }) {
    const { activeProfile } = useAuth();
    const { playTrack, isOfflineMode, setIsOfflineMode } = usePlayback();
    const { favorites } = useFavorites();
    const [recentTracks, setRecentTracks] = useState<BackendTrack[]>([]);
    const [trendingTracks, setTrendingTracks] = useState<BackendTrack[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isTrendingLoading, setIsTrendingLoading] = useState(false);

    // Modal States
    const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
    const [selectedTrack, setSelectedTrack] = useState<{ id: number, title: string } | null>(null);
    const [showFavoritesModal, setShowFavoritesModal] = useState(false);
    const [showRecentModal, setShowRecentModal] = useState(false);
    const [recentPlays, setRecentPlays] = useState<BackendTrack[]>([]);
    const [loadingRecent, setLoadingRecent] = useState(false);

    useEffect(() => {
        fetchDiscoveryFeed();
    }, []);

    // Fetch discovery feed: Recently Played -> Trending fallback
    const fetchDiscoveryFeed = async (showLoader = true) => {
        if (showLoader) {
            setIsLoading(true);
        }
        try {
            // 1. Try to get recently played tracks
            const recentRes = await fetch(`${API_BASE}/api/analytics/recent?limit=10`, {
                headers: {
                    "Authorization": `Bearer ${localStorage.getItem("onyx_access_token")}`,
                    "X-Profile-ID": activeProfile?.id.toString() || ""
                }
            });

            if (recentRes.ok) {
                const recentData = await recentRes.json();
                if (Array.isArray(recentData) && recentData.length > 0) {
                    // Map to BackendTrack format
                    const tracks = recentData.map((t: any) => ({
                        id: t.id,
                        title: t.title,
                        artist: t.artist,
                        thumbnail_url: t.thumbnail_url,
                        duration: 0,
                        source: t.source || "youtube",
                        youtube_id: t.youtube_id
                    }));

                    // 🚀 Deduplicate to handle cases where backend might return same track multiple times
                    const uniqueTracks: BackendTrack[] = [];
                    const seenIds = new Set();
                    for (const t of tracks) {
                        const key = t.youtube_id || t.id;
                        if (!seenIds.has(key)) {
                            uniqueTracks.push(t);
                            seenIds.add(key);
                        }
                    }

                    setRecentTracks(uniqueTracks);

                    // Prefetch first 3
                    tracks.slice(0, 3).forEach((track: BackendTrack, idx: number) => {
                        if (track.youtube_id && track.youtube_id.length >= 11) {
                            fetch(`${API_BASE}/api/streaming/youtube/${track.youtube_id}/prefetch?priority=${idx === 0 ? 1 : 2}`)
                                .catch(() => { });
                        }
                    });
                    return;
                }
            }

            // 2. Fallback: Auto-load trending if no recent plays
            console.log("No recent plays, auto-loading trending...");
            const trendingRes = await fetch(`${API_BASE}/api/streaming/trending?limit=5`);
            if (trendingRes.ok) {
                const trendingData = await trendingRes.json();
                if (Array.isArray(trendingData)) {
                    setRecentTracks(trendingData);
                }
            }
        } catch (err) {
            console.error("Failed to fetch discovery feed", err);
            setRecentTracks([]);
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch trending music from YouTube
    const fetchTrending = async () => {
        setTrendingTracks([]); // Clear to show skeleton loaders
        setIsTrendingLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/streaming/trending?limit=10`);

            if (!res.ok) {
                console.error("Failed to fetch trending: HTTP", res.status);
                toast.error("Failed to load trending");
                return;
            }

            const data = await res.json();

            if (!Array.isArray(data)) {
                console.error("Unexpected trending response format:", data);
                return;
            }

            setTrendingTracks(() => {
                const unique = new Map();
                data.forEach((t: BackendTrack) => {
                    const key = t.youtube_id || t.id;
                    if (!unique.has(key)) unique.set(key, t);
                });
                return Array.from(unique.values());
            });
            toast.success(`Found ${data.length} trending tracks`, { duration: 1500 });

            // Prefetch first 3 trending tracks
            data.slice(0, 3).forEach((track: BackendTrack, idx: number) => {
                if (track.youtube_id && track.youtube_id.length >= 11) {
                    fetch(`${API_BASE}/api/streaming/youtube/${track.youtube_id}/prefetch?priority=2`)
                        .catch(() => { });
                }
            });
        } catch (err) {
            console.error("Failed to fetch trending", err);
            toast.error("Network error fetching trending");
        } finally {
            setIsTrendingLoading(false);
        }
    };

    const handleAddToPlaylist = (track: { id: number, title: string }) => {
        setSelectedTrack(track);
        setIsPlaylistModalOpen(true);
    };

    const handlePlayTrack = (track: BackendTrack) => {
        let streamUri = `${API_BASE}/api/streaming/track/${track.id}`;
        let youtube_id = undefined;

        if ((track.source === "cached" || track.source === "youtube") && track.youtube_id) {
            streamUri = `${API_BASE}/api/streaming/youtube/${track.youtube_id}`;
            youtube_id = track.youtube_id;
        }

        const playerTrack: PlayerTrack = {
            id: track.id,
            title: track.title,
            artist: track.artist,
            album: track.album,
            thumbnail: track.thumbnail_url,
            duration: track.duration,
            source: track.source,
            uri: streamUri,
            youtube_id: youtube_id
        };
        playTrack(playerTrack);
    };

    const handleHover = (trackId: string) => {
        fetch(`${API_BASE}/api/streaming/youtube/${trackId}/prefetch?priority=3`)
            .catch(() => { });
    };


    // Quick Action Handlers
    const handleResume = () => {
        try {
            const lastPlayed = localStorage.getItem("onyx_last_played");
            if (lastPlayed) {
                const track = JSON.parse(lastPlayed) as PlayerTrack;
                playTrack(track);
                toast.success(`Resuming: ${track.title}`);
            } else {
                toast.info("No recent track to resume");
            }
        } catch {
            toast.error("Could not resume playback");
        }
    };

    const handleShowFavorites = () => {
        if (favorites.length === 0) {
            toast.info("No favorites yet! Tap ❤️ on songs to add them.");
            return;
        }
        setShowFavoritesModal(true);
    };

    const handleShowRecent = async () => {
        setShowRecentModal(true);
        setLoadingRecent(true);
        try {
            const res = await fetch(`${API_BASE}/api/analytics/recent?limit=20`, {
                headers: {
                    "Authorization": `Bearer ${localStorage.getItem("onyx_access_token")}`,
                    "X-Profile-ID": activeProfile?.id.toString() || ""
                }
            });
            if (res.ok) {
                setRecentPlays(await res.json());
            }
        } catch {
            toast.error("Could not load recent plays");
        } finally {
            setLoadingRecent(false);
        }
    };

    const handlePlaylists = () => {
        if (onNavigateToPlaylists) {
            onNavigateToPlaylists();
        } else {
            toast.info("Navigate to Library → Playlists");
        }
    };

    const playFavoriteTrack = (fav: FavoriteTrack) => {
        const track: PlayerTrack = {
            id: fav.id,
            title: fav.title,
            artist: fav.artist,
            thumbnail: fav.thumbnail,
            source: "youtube",
            uri: `${API_BASE}/api/streaming/youtube/${fav.youtube_id || fav.id}`,
            youtube_id: fav.youtube_id || (typeof fav.id === "string" ? fav.id : undefined)
        };
        playTrack(track);
        setShowFavoritesModal(false);
    };

    if (!activeProfile) return null;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-2 space-y-8">
            {/* Greeting */}
            <h1 className="text-3xl font-bold tracking-tight px-2 mt-4">
                Good {getTimeOfDay()}
            </h1>

            {/* Quick Action Grid (Spotify Style 2-column grid) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 px-2">
                <SpotifyQuickCard
                    label="Recently Played"
                    icon={Clock}
                    color="bg-purple-500/20"
                    onClick={handleShowRecent}
                />
                <SpotifyQuickCard
                    label="Liked Songs"
                    icon={Heart}
                    color="bg-gradient-to-br from-indigo-500 to-cyan-300"
                    onClick={handleShowFavorites}
                />
                <SpotifyQuickCard
                    label="Your Library"
                    icon={ListMusic}
                    color="bg-primary/20"
                    onClick={handlePlaylists}
                />
            </div>

            {/* Main Sections */}
            <section className="px-2">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold hover:underline cursor-pointer">For You</h2>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {isLoading ? (
                        Array(5).fill(0).map((_, i) => (
                            <div key={i} className="bg-[#181818] p-4 rounded-lg animate-pulse">
                                <div className="aspect-square bg-[#282828] rounded-md mb-4" />
                                <div className="h-4 bg-[#282828] rounded w-3/4 mb-2" />
                                <div className="h-3 bg-[#282828] rounded w-1/2" />
                            </div>
                        ))
                    ) : (
                        recentTracks.slice(0, 10).map((track) => (
                            <SpotifyTrackCard
                                key={track.id}
                                track={track}
                                onPlay={handlePlayTrack}
                                onAddToPlaylist={handleAddToPlaylist}
                            />
                        ))
                    )}
                </div>
            </section>

            {/* Trending Section */}
            {!isOfflineMode && trendingTracks.length > 0 && (
                <section className="px-2">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-bold hover:underline cursor-pointer">Trending Now</h2>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={fetchTrending}
                            className="text-muted-foreground hover:text-white font-bold"
                        >
                            Show all
                        </Button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {isTrendingLoading ? (
                            Array(5).fill(0).map((_, i) => (
                                <div key={i} className="bg-[#181818] p-4 rounded-lg animate-pulse">
                                    <div className="aspect-square bg-[#282828] rounded-md mb-4" />
                                    <div className="h-4 bg-[#282828] rounded w-3/4 mb-2" />
                                    <div className="h-3 bg-[#282828] rounded w-1/2" />
                                </div>
                            ))
                        ) : (
                            trendingTracks.map((track) => (
                                <SpotifyTrackCard
                                    key={track.youtube_id || track.id}
                                    track={track}
                                    onPlay={handlePlayTrack}
                                    onAddToPlaylist={handleAddToPlaylist}
                                />
                            ))
                        )}
                    </div>
                </section>
            )}

            <AddToPlaylistModal
                isOpen={isPlaylistModalOpen}
                onClose={() => setIsPlaylistModalOpen(false)}
                trackId={selectedTrack?.id || null}
                trackTitle={selectedTrack?.title}
            />

            {/* Favorites Modal */}
            <AnimatePresence>
                {showFavoritesModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowFavoritesModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="glass rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <Heart className="w-5 h-5 text-pink-500 fill-current" /> Favorites
                                </h2>
                                <Button variant="ghost" size="icon" onClick={() => setShowFavoritesModal(false)}>
                                    <X className="w-5 h-5" />
                                </Button>
                            </div>
                            <div className="overflow-y-auto flex-1 space-y-2">
                                {favorites.map(fav => (
                                    <div
                                        key={fav.id}
                                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer group"
                                        onClick={() => playFavoriteTrack(fav)}
                                    >
                                        <div className="w-10 h-10 rounded bg-white/5 overflow-hidden flex-shrink-0">
                                            {fav.thumbnail ? <img src={fav.thumbnail} alt="" className="w-full h-full object-cover" /> : <Music className="w-full h-full p-2 text-muted-foreground" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm truncate">{fav.title}</p>
                                            <p className="text-xs text-muted-foreground truncate">{fav.artist}</p>
                                        </div>
                                        <PlayCircle className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Recent Plays Modal */}
            <AnimatePresence>
                {showRecentModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowRecentModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="glass rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-purple-500" /> Recently Played
                                </h2>
                                <Button variant="ghost" size="icon" onClick={() => setShowRecentModal(false)}>
                                    <X className="w-5 h-5" />
                                </Button>
                            </div>
                            <div className="overflow-y-auto flex-1 space-y-2">
                                {loadingRecent ? (
                                    <div className="flex items-center justify-center py-10">
                                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                    </div>
                                ) : recentPlays.length === 0 ? (
                                    <p className="text-center text-muted-foreground py-10">No recent plays yet</p>
                                ) : (
                                    recentPlays.map(track => (
                                        <div
                                            key={track.id}
                                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer group"
                                            onClick={() => { handlePlayTrack(track); setShowRecentModal(false); }}
                                        >
                                            <div className="w-10 h-10 rounded bg-white/5 overflow-hidden flex-shrink-0">
                                                {track.thumbnail_url ? <img src={track.thumbnail_url} alt="" className="w-full h-full object-cover" /> : <Music className="w-full h-full p-2 text-muted-foreground" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm truncate">{track.title}</p>
                                                <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                                            </div>
                                            <PlayCircle className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// Spotify style Quick Access Card (Wide rectangular)
function SpotifyQuickCard({ label, icon: Icon, color, onClick }: {
    label: string,
    icon: any,
    color: string,
    onClick?: () => void
}) {
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-4 bg-white/5 hover:bg-white/10 rounded-md overflow-hidden transition-colors group relative"
        >
            <div className={cn("w-16 h-16 flex items-center justify-center shrink-0 shadow-lg", color)}>
                <Icon className="w-7 h-7 text-white fill-current" />
            </div>
            <span className="font-bold text-sm truncate pr-4">{label}</span>
            <div className="absolute right-4 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 shadow-xl">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                    <Play className="w-5 h-5 text-black fill-current ml-0.5" />
                </div>
            </div>
        </button>
    );
}

// Spotify style Track Card (Square)
function SpotifyTrackCard({ track, onPlay, onAddToPlaylist }: {
    track: BackendTrack,
    onPlay: (t: BackendTrack) => void,
    onAddToPlaylist: (t: { id: number, title: string }) => void
}) {
    // Compute thumbnail with YouTube fallback
    const thumbnailUrl = track.thumbnail_url ||
        (track.youtube_id ? `https://i.ytimg.com/vi/${track.youtube_id}/hqdefault.jpg` : null);

    return (
        <div
            className="bg-[#181818] hover:bg-[#282828] p-4 rounded-lg transition-all duration-300 cursor-pointer group relative"
            onClick={() => onPlay(track)}
        >
            {/* Thumbnail */}
            <div className="relative aspect-square mb-4 shadow-2xl">
                {thumbnailUrl ? (
                    <img
                        src={thumbnailUrl}
                        alt={track.title}
                        className="w-full h-full object-cover rounded-md"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#282828] rounded-md">
                        <Music className="w-12 h-12 text-muted-foreground opacity-20" />
                    </div>
                )}

                {/* Hover Play Button (Spotify style) */}
                <div className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 group-hover:translate-y-[-8px] transition-all duration-300 shadow-2xl">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onPlay(track);
                        }}
                        className="w-12 h-12 rounded-full bg-primary flex items-center justify-center hover:scale-105 transition-transform"
                    >
                        <Play className="w-6 h-6 text-black fill-current ml-0.5" />
                    </button>
                </div>
            </div>

            {/* Info */}
            <div className="space-y-1">
                <h3 className="font-bold text-base truncate text-white">{track.title}</h3>
                <p className="text-sm text-muted-foreground truncate leading-relaxed">
                    {track.artist}
                </p>
            </div>

            {/* Context Menu / Add button */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onAddToPlaylist({ id: track.id, title: track.title });
                }}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 rounded-full bg-black/40 hover:bg-black/60 transition-opacity"
            >
                <Plus className="w-4 h-4 text-white" />
            </button>
        </div>
    );
}

function getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour < 12) return "morning";
    if (hour < 17) return "afternoon";
    return "evening";
}
