import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Loader2, Music, Plus, TrendingUp, ListPlus, LayoutGrid, List } from "lucide-react";
import { usePartyPlayback } from "@/contexts/PartyPlaybackContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface SearchResult {
    id: string;
    title: string;
    channel?: string;
    uploader?: string;
    thumbnail?: string;
    duration?: number | string;
}

interface PartySearchModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function PartySearchModal({ isOpen, onClose }: PartySearchModalProps) {
    const { addToQueue, addNextToQueue, currentTrack } = usePartyPlayback();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSlowSearch, setIsSlowSearch] = useState(false); // Show warning for slow searches
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid'); // Toggle between grid and list view
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null); // For canceling in-flight requests

    // Reset when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            // Focus input when modal opens
            setTimeout(() => inputRef.current?.focus(), 100);
        } else {
            setQuery("");
            setResults([]);
            setIsLoading(false);
            setIsSlowSearch(false);
            // Cancel any in-flight requests when modal closes
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }
        }
    }, [isOpen]);

    // Debounced live search with AbortController for race condition prevention
    useEffect(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        // Cancel any previous in-flight request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }

        if (query.trim().length < 2) {
            setResults([]);
            setIsLoading(false);
            setIsSlowSearch(false);
            return;
        }

        setIsLoading(true);
        setIsSlowSearch(false);

        debounceRef.current = setTimeout(async () => {
            // Create new AbortController for this request
            const controller = new AbortController();
            abortControllerRef.current = controller;

            // Show slow search warning after 3 seconds
            const slowTimer = setTimeout(() => {
                if (!controller.signal.aborted) {
                    setIsSlowSearch(true);
                }
            }, 3000);

            // Timeout after 15 seconds
            const timeoutId = setTimeout(() => {
                controller.abort();
            }, 15000);

            try {
                const response = await fetch(`${API_BASE}/api/suggestions`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ query: query.trim() }),
                    signal: controller.signal,
                });

                clearTimeout(slowTimer);
                clearTimeout(timeoutId);

                if (!response.ok) throw new Error("Search failed");

                const data = await response.json();

                // Only update results if this request wasn't aborted
                if (!controller.signal.aborted) {
                    setResults(Array.isArray(data) ? data : []);
                }
            } catch (err: any) {
                clearTimeout(slowTimer);
                clearTimeout(timeoutId);

                // Don't log abort errors - they're intentional
                if (err.name !== 'AbortError') {
                    console.error(err);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoading(false);
                    setIsSlowSearch(false);
                }
            }
        }, 150); // Snappy 150ms debounce

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [query]);

    const handleAdd = (result: SearchResult) => {
        addToQueue({
            id: result.id,
            title: result.title,
            artist: result.channel || result.uploader || "YouTube",
            thumbnail: result.thumbnail || `https://i.ytimg.com/vi/${result.id}/hqdefault.jpg`,
            duration: typeof result.duration === "number" ? result.duration : 0
        });

        // Auto-close after adding for better UX
        setTimeout(() => onClose(), 100);
    };

    const handleAddNext = (result: SearchResult) => {
        addNextToQueue({
            id: result.id,
            title: result.title,
            artist: result.channel || result.uploader || "YouTube",
            thumbnail: result.thumbnail || `https://i.ytimg.com/vi/${result.id}/hqdefault.jpg`,
            duration: typeof result.duration === "number" ? result.duration : 0
        });

        // Auto-close after adding for better UX
        setTimeout(() => onClose(), 100);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/90 backdrop-blur-2xl"
                        onClick={onClose}
                    />

                    {/* Modal - Dynamic Height & Expansive Width */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98, y: 30 }}
                        animate={{
                            opacity: 1,
                            scale: 1,
                            y: 0,
                            width: query.length > 0 ? "min(1200px, 95vw)" : "min(800px, 90vw)",
                            height: query.length > 0 ? "85vh" : "auto"
                        }}
                        exit={{ opacity: 0, scale: 0.98, y: 30 }}
                        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                        className="relative bg-surface-1 rounded-[40px] border border-white/10 shadow-[0_32px_80px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col z-[110]"
                    >
                        {/* Header Section */}
                        <div className="p-8 pb-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-4xl font-black tracking-tighter text-white">Add Music</h2>
                                <p className="text-muted-foreground text-sm font-medium mt-1 uppercase tracking-widest opacity-60">Search for the next vibe</p>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onClose}
                                className="h-12 w-12 rounded-full hover:bg-white/10 hover:text-white transition-all"
                            >
                                <X className="w-8 h-8" />
                            </Button>
                        </div>

                        {/* Search Input Area */}
                        <div className="px-8 py-6 bg-white/[0.02] border-y border-white/5">
                            <div className="relative group">
                                <Search className={`absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 transition-all duration-300 ${query ? "text-primary scale-110" : "text-muted-foreground"}`} />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    placeholder="Artists, songs, or genres..."
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Escape') {
                                            if (query) setQuery("");
                                            else onClose();
                                        }
                                    }}
                                    className="w-full pl-16 pr-16 h-18 bg-black/20 border border-white/10 rounded-2xl text-xl font-bold placeholder:text-white/20 focus:outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary/50 transition-all shadow-inner"
                                />
                                {(query || isLoading) && (
                                    <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-4">
                                        {isLoading && <Loader2 className="w-6 h-6 animate-spin text-primary" />}
                                        {query && (
                                            <button
                                                onClick={() => { setQuery(""); inputRef.current?.focus(); }}
                                                className="p-2 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-all"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Main Body - Expansive Results Area */}
                        <div className="flex-1 overflow-y-auto px-8 pb-12 custom-scrollbar">
                            <AnimatePresence mode="wait">
                                {query.trim().length < 2 ? (
                                    <motion.div
                                        key="empty"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="h-full flex flex-col items-center justify-center py-20 opacity-20"
                                    >
                                        <Music className="w-32 h-32 mb-6" />
                                        <p className="text-2xl font-black tracking-tight uppercase">Ready to cue the music</p>
                                    </motion.div>
                                ) : isLoading && results.length === 0 ? (
                                    <motion.div
                                        key="loading"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="h-full flex flex-col items-center justify-center py-20"
                                    >
                                        <Loader2 className="w-16 h-16 animate-spin text-primary mb-6" />
                                        <p className="text-xl font-bold text-muted-foreground uppercase tracking-widest">
                                            {isSlowSearch ? "Still searching..." : "Searching the universe..."}
                                        </p>
                                        {isSlowSearch && (
                                            <motion.p
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="text-sm text-yellow-500/80 mt-4 text-center max-w-md"
                                            >
                                                ⚠️ Search is taking longer than usual. This may be due to network conditions.
                                            </motion.p>
                                        )}
                                    </motion.div>
                                ) : results.length > 0 ? (
                                    <motion.div
                                        key="results"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="py-4 space-y-4"
                                    >
                                        <div className="flex items-center justify-between mb-6 px-2">
                                            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-primary/80 flex items-center gap-3">
                                                <TrendingUp className="w-4 h-4" />
                                                Found {results.length} Vibe Matches
                                            </h3>
                                            {/* View Toggle */}
                                            <div className="flex items-center gap-1 bg-white/5 rounded-full p-1">
                                                <button
                                                    onClick={() => setViewMode('grid')}
                                                    className={`p-2 rounded-full transition-all ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-white/40 hover:text-white'}`}
                                                    title="Grid view"
                                                >
                                                    <LayoutGrid className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setViewMode('list')}
                                                    className={`p-2 rounded-full transition-all ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-white/40 hover:text-white'}`}
                                                    title="List view"
                                                >
                                                    <List className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "flex flex-col gap-2"}>
                                            {results.map((result, idx) => (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: idx * 0.03 }}
                                                    key={result.id}
                                                    className={`flex items-center gap-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-primary/30 transition-all group cursor-pointer active:scale-[0.99] ${viewMode === 'grid' ? 'p-4 gap-6' : 'p-3'
                                                        }`}
                                                    onClick={() => handleAdd(result)}
                                                >
                                                    <div className={`rounded-xl overflow-hidden bg-black/60 flex-shrink-0 border border-white/10 group-hover:border-primary/50 transition-all shadow-xl ${viewMode === 'grid' ? 'w-20 h-20' : 'w-12 h-12'
                                                        }`}>
                                                        <img
                                                            src={result.thumbnail || `https://i.ytimg.com/vi/${result.id}/hqdefault.jpg`}
                                                            alt=""
                                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                        />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`font-bold truncate text-white group-hover:text-primary transition-colors leading-tight ${viewMode === 'grid' ? 'text-lg' : 'text-base'
                                                            }`}>{result.title}</p>
                                                        <p className={`text-muted-foreground font-medium uppercase tracking-wider opacity-70 group-hover:opacity-100 transition-opacity ${viewMode === 'grid' ? 'text-sm mt-1' : 'text-xs'
                                                            }`}>
                                                            {result.channel || result.uploader}
                                                        </p>
                                                    </div>
                                                    <div className={`flex gap-2 ${viewMode === 'list' ? 'opacity-100' : 'opacity-0 md:group-hover:opacity-100'} transition-opacity`}>
                                                        {/* Play Next Button */}
                                                        {currentTrack && (
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                onClick={(e) => { e.stopPropagation(); handleAddNext(result); }}
                                                                className={`rounded-full bg-white/5 hover:bg-accent hover:text-accent-foreground transition-all shadow-lg ${viewMode === 'grid' ? 'h-10 w-10' : 'h-8 w-8'
                                                                    }`}
                                                                title="Play next"
                                                            >
                                                                <ListPlus className={viewMode === 'grid' ? 'w-5 h-5' : 'w-4 h-4'} />
                                                            </Button>
                                                        )}
                                                        {/* Add to Queue Button */}
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            onClick={(e) => { e.stopPropagation(); handleAdd(result); }}
                                                            className={`rounded-full bg-white/5 hover:bg-primary hover:text-primary-foreground transition-all shadow-xl ${viewMode === 'grid' ? 'h-12 w-12' : 'h-8 w-8'
                                                                }`}
                                                            title="Add to queue"
                                                        >
                                                            <Plus className={viewMode === 'grid' ? 'w-6 h-6' : 'w-4 h-4'} />
                                                        </Button>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="no-results"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="h-full flex flex-col items-center justify-center py-20"
                                    >
                                        <X className="w-24 h-24 text-red-500/30 mb-6" />
                                        <p className="text-xl font-bold text-muted-foreground">Nothing found for "{query}"</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}


