/**
 * Onyx Streaming - Search View
 * YouTube Search integration for streaming mode.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Play, ListPlus, Loader2, Music, User, Clock, WifiOff, History, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { usePlayback, Track } from "@/contexts/PlaybackContext";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { toast } from "sonner";
import AddToPlaylistModal from "../playlists/AddToPlaylistModal";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface SearchResult {
    id: string;
    title: string;
    channel?: string;
    thumbnail?: string;
    duration?: string;
    views?: string;
}

interface Suggestion {
    title: string;
    uploader?: string;
    url?: string;
    thumbnail?: string;
    duration?: string;
    id?: string;
}

export default function SearchView() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const { playTrack, addToQueue, isOfflineMode } = usePlayback();
    const { activeProfile } = useAuth();
    const suggestionsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Profile-scoped storage key
    const RECENT_SEARCHES_KEY = activeProfile ? `onyx_recent_searches_${activeProfile.id}` : "onyx_recent_searches_guest";

    const handleAddToPlaylist = async (result: SearchResult) => {
        try {
            // First ensure track is in library to get an ID
            const res = await fetch(`${API_BASE}/api/library/ensure`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Authorization": `Bearer ${localStorage.getItem("onyx_access_token")}`
                },
                body: new URLSearchParams({
                    title: result.title,
                    artist: result.channel || "YouTube",
                    youtube_id: result.id,
                    thumbnail: result.thumbnail || "",
                    duration: result.duration ? parseDuration(result.duration) : "0"
                })
            });

            if (res.ok) {
                const data = await res.json();
                setSelectedTrack({ id: data.id, title: result.title });
                setIsPlaylistModalOpen(true);
            } else {
                toast.error("Failed to prepare track for playlist");
            }
        } catch (err) {
            console.error("Failed to ensure track:", err);
            toast.error("Error connecting to server");
        }
    };

    const parseDuration = (d: string) => {
        const parts = d.split(':').map(Number);
        if (parts.length === 2) return (parts[0] * 60 + parts[1]).toString();
        if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]).toString();
        return "0";
    };

    // Immersive Search States
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);

    // Playlist Modal State
    const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
    const [selectedTrack, setSelectedTrack] = useState<{ id: number, title: string } | null>(null);

    // Load recent searches from localStorage
    useEffect(() => {
        const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
        if (saved) {
            try {
                setRecentSearches(JSON.parse(saved).slice(0, 11));
            } catch {
                setRecentSearches([]);
            }
        } else {
            setRecentSearches([]);
        }
    }, [RECENT_SEARCHES_KEY]);

    // Save search to recent
    const saveRecentSearch = (q: string) => {
        if (!q.trim()) return;
        const updated = [q, ...recentSearches.filter(s => s !== q)].slice(0, 11);
        setRecentSearches(updated);
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    };

    const handleSearchFocus = () => {
        setIsSearchFocused(true);
        setTimeout(() => searchInputRef.current?.select(), 50);
    };

    const handleSearchBlur = () => {
        setTimeout(() => setIsSearchFocused(false), 200);
    };

    // Fetch suggestions as user types
    useEffect(() => {
        if (suggestionsTimeoutRef.current) {
            clearTimeout(suggestionsTimeoutRef.current);
        }

        if (query.trim().length < 2) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        suggestionsTimeoutRef.current = setTimeout(async () => {
            setIsSuggestionsLoading(true);
            try {
                const res = await fetch(`${API_BASE}/api/suggestions`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ query: query.trim() })
                });
                const data = await res.json();
                if (Array.isArray(data)) {
                    // Handle both string array and object array formats
                    const processed = data.slice(0, 8).map((item: string | Suggestion) => {
                        if (typeof item === 'string') {
                            return { title: item };
                        }
                        return item as Suggestion;
                    });
                    setSuggestions(processed);
                    setShowSuggestions(true);
                }
            } catch (error) {
                console.error("Suggestions failed:", error);
            } finally {
                setIsSuggestionsLoading(false);
            }
        }, 300); // Debounce 300ms

        return () => {
            if (suggestionsTimeoutRef.current) {
                clearTimeout(suggestionsTimeoutRef.current);
            }
        };
    }, [query]);

    const handleSearch = async (searchQuery?: string) => {
        const q = searchQuery || query;
        if (!q.trim()) return;

        setIsLoading(true);
        setShowSuggestions(false);
        setSuggestions([]);

        if (isOfflineMode) {
            try {
                const library = await api.getLibrary();
                const filtered = library.filter(file =>
                    file.name.toLowerCase().includes(q.toLowerCase()) ||
                    (file.title || "").toLowerCase().includes(q.toLowerCase()) ||
                    (file.artist || "").toLowerCase().includes(q.toLowerCase())
                );

                setResults(filtered.map(file => ({
                    id: file.path,
                    title: file.title || file.name,
                    channel: file.artist || "Local Library",
                    thumbnail: file.thumbnail || "",
                    duration: undefined,
                    source: "cached" as const
                })));
            } catch (err) {
                console.error("Local search failed:", err);
                toast.error("Failed to search library");
            } finally {
                setIsLoading(false);
            }
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/api/search`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: q.trim() })
            });
            const data = await res.json();

            // Handle the response format: { success: true, results: [...] }
            if (data.success && Array.isArray(data.results)) {
                setResults(data.results.map((item: any) => ({
                    id: item.id,
                    title: item.title,
                    channel: item.channel || item.uploader,
                    thumbnail: item.thumbnail,
                    duration: item.duration,
                    views: item.view_count ? `${(item.view_count / 1000000).toFixed(1)}M views` : undefined
                })));
            } else if (Array.isArray(data)) {
                setResults(data);
            } else {
                setResults([]);
            }
        } catch (error) {
            console.error("Search failed:", error);
            toast.error("Search failed. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSuggestionClick = (suggestion: Suggestion) => {
        setQuery(suggestion.title);
        setShowSuggestions(false);
        setIsSearchFocused(false);
        saveRecentSearch(suggestion.title);
        handleSearch(suggestion.title);
    };

    const handleRecentSearchClick = (q: string) => {
        setQuery(q);
        setIsSearchFocused(false);
        handleSearch(q);
    };

    const removeRecentSearch = (q: string) => {
        const updated = recentSearches.filter(s => s !== q);
        setRecentSearches(updated);
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleSearch();
    };

    const handlePlay = (result: SearchResult) => {
        const track: Track = {
            id: result.id,
            title: result.title,
            artist: result.channel || "Unknown Artist",
            thumbnail: result.thumbnail,
            source: "youtube",
            uri: `${API_BASE}/api/streaming/youtube/${result.id}`,
            youtube_id: result.id
        };
        playTrack(track);
        toast.success(`Playing "${result.title}"`);
    };

    const handleAddToQueue = (result: SearchResult) => {
        const track: Track = {
            id: result.id,
            title: result.title,
            artist: result.channel || "Unknown Artist",
            thumbnail: result.thumbnail,
            source: "youtube",
            uri: `${API_BASE}/api/streaming/youtube/${result.id}`,
            youtube_id: result.id
        };
        addToQueue(track);
        toast.success(`Added "${result.title}" to queue`);
    };

    return (
        <div className="space-y-6 pt-6 relative">
            {/* Search Top Bar */}
            <div className="sticky top-0 z-50 py-4 -mt-6">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleSearch();
                        saveRecentSearch(query);
                        setIsSearchFocused(false);
                    }}
                    className="max-w-md relative"
                >
                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-200 ${isSearchFocused ? 'text-white' : 'text-muted-foreground'}`} />
                    <input
                        ref={searchInputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onFocus={() => setIsSearchFocused(true)}
                        onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                        placeholder="What do you want to listen to?"
                        className="w-full pl-10 pr-4 py-3 rounded-full bg-white/10 hover:bg-white/15 border-none text-white text-sm font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-white/20 transition-all font-sans"
                    />
                    {/* Main Search Spinner or Suggestions Spinner */}
                    {(isLoading || (isSuggestionsLoading && query.trim().length > 0)) && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                            {isSuggestionsLoading && !isLoading && <span className="text-[10px] text-muted-foreground animate-pulse">Searching...</span>}
                            <Loader2 className="w-5 h-5 text-primary animate-spin" />
                        </div>
                    )}

                    {/* Suggestions & Recent Searches Dropdown */}
                    <AnimatePresence>
                        {isSearchFocused && (suggestions.length > 0 || (query.trim().length === 0 && recentSearches.length > 0)) && (
                            <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.15 }}
                                className="absolute top-full left-0 right-0 mt-2 bg-[#282828] rounded-xl shadow-2xl border border-white/10 overflow-hidden z-[100] max-h-96 overflow-y-auto"
                            >
                                {/* Live Suggestions */}
                                {suggestions.length > 0 && (
                                    <div className="py-1">
                                        {suggestions.map((s, i) => (
                                            <button
                                                key={`sug-${i}`}
                                                onMouseDown={(e) => { e.preventDefault(); handleSuggestionClick(s); }}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-white/90 hover:bg-white/10 transition-colors"
                                            >
                                                <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                                <span className="truncate font-medium">{s.title}</span>
                                                {s.uploader && (
                                                    <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">{s.uploader}</span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Recent Searches */}
                                {query.trim().length === 0 && recentSearches.length > 0 && (
                                    <div className="py-1">
                                        <div className="px-4 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">Recent Searches</div>
                                        {recentSearches.map((q, i) => (
                                            <div key={`recent-${i}`} className="flex items-center hover:bg-white/10 transition-colors group">
                                                <button
                                                    onMouseDown={(e) => { e.preventDefault(); handleRecentSearchClick(q); }}
                                                    className="flex-1 flex items-center gap-3 px-4 py-2.5 text-left text-sm text-white/80"
                                                >
                                                    <History className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                                    <span className="truncate">{q}</span>
                                                </button>
                                                <button
                                                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); removeRecentSearch(q); }}
                                                    className="p-2 mr-2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-white transition-opacity"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </form>
            </div>

            {/* Results */}
            <div className="mt-8">
                <AnimatePresence mode="popLayout">
                    {results.length > 0 ? (
                        <div className="space-y-1">
                            {/* List Header */}
                            <div className="grid grid-cols-[16px_1fr_1fr_120px] gap-4 px-4 py-2 border-b border-white/10 text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                                <span>#</span>
                                <span>Title</span>
                                <span className="hidden md:block">Channel / Artist</span>
                                <div className="flex justify-end pr-2">
                                    <Clock className="w-4 h-4" />
                                </div>
                            </div>

                            {results.map((result, index) => (
                                <motion.div
                                    key={result.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="grid grid-cols-[16px_1fr_1fr_120px] gap-4 px-4 py-2 rounded-md hover:bg-white/10 transition-colors group cursor-pointer"
                                    onClick={() => handlePlay(result)}
                                >
                                    <div className="flex items-center text-sm text-muted-foreground group-hover:text-white">
                                        <span className="group-hover:hidden">{index + 1}</span>
                                        <Play className="w-3 h-3 text-white hidden group-hover:block fill-current" />
                                    </div>
                                    <div className="flex items-center gap-3 min-w-0">
                                        <img src={result.thumbnail} alt="" className="w-10 h-10 rounded shadow-lg" />
                                        <div className="min-w-0">
                                            <p className="font-bold text-sm text-white truncate">{result.title}</p>
                                            <p className="text-xs text-muted-foreground truncate hover:underline">{result.channel}</p>
                                        </div>
                                    </div>
                                    <div className="hidden md:flex items-center text-sm text-muted-foreground">
                                        <span className="truncate hover:underline hover:text-white">{result.channel}</span>
                                    </div>
                                    <div className="flex items-center justify-end pr-2 gap-4">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleAddToPlaylist(result); }}
                                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-white transition-opacity"
                                        >
                                            <Music className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleAddToQueue(result); }}
                                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-white transition-opacity"
                                        >
                                            <ListPlus className="w-4 h-4" />
                                        </button>
                                        <span className="text-xs text-muted-foreground min-w-[32px] text-right">{result.duration || "--:--"}</span>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        !isLoading && (
                            <div className="flex flex-col items-center justify-center py-32 text-center">
                                <Search className="w-16 h-16 text-white/10 mb-6" />
                                <h3 className="text-2xl font-bold mb-2">Search Onyx</h3>
                                <p className="text-muted-foreground max-w-sm">Find your favorite songs, artists, and more from across the web.</p>
                            </div>
                        )
                    )}
                </AnimatePresence>
            </div>
            {/* Playlist Modal */}
            <AddToPlaylistModal
                isOpen={isPlaylistModalOpen}
                onClose={() => setIsPlaylistModalOpen(false)}
                trackId={selectedTrack?.id ?? null}
                trackTitle={selectedTrack?.title}
            />
        </div>
    );
}
