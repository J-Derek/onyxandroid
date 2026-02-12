import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, History, Clock, X, Terminal, TrendingUp } from 'lucide-react';
import { useSearch } from '@/hooks/useSearch';
import { VideoCard } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface SearchWithSuggestionsProps {
    value: string;
    onChange: (value: string) => void;
    onSelect: (result: VideoCard) => void;
    onSearch?: (query: string) => void;
    onFocusChange?: (isFocused: boolean) => void;
    placeholder?: string;
    className?: string;
}

export const SearchWithSuggestions: React.FC<SearchWithSuggestionsProps> = ({
    value,
    onChange,
    onSelect,
    onSearch,
    onFocusChange,
    placeholder = "Search for music to download...",
    className = ""
}) => {
    const { setQuery, results, isLoading } = useSearch(150);
    const [isFocused, setIsFocused] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const saved = localStorage.getItem('onyx_recent_searches');
        if (saved) setRecentSearches(JSON.parse(saved));
    }, []);

    useEffect(() => {
        setQuery(value);
    }, [value, setQuery]);

    const saveRecentSearch = (searchText: string) => {
        const updated = [searchText, ...recentSearches.filter(s => s !== searchText)].slice(0, 5);
        setRecentSearches(updated);
        localStorage.setItem('onyx_recent_searches', JSON.stringify(updated));
    };

    const handleSelect = (result: VideoCard) => {
        saveRecentSearch(result.title);
        onSelect(result);
        setIsFocused(false);
        onFocusChange?.(false);
        setSelectedIndex(-1);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            setSelectedIndex(prev => Math.min(prev + 1, results.length + (value ? 0 : recentSearches.length) - 1));
            e.preventDefault();
        } else if (e.key === 'ArrowUp') {
            setSelectedIndex(prev => Math.max(prev - 1, -1));
            e.preventDefault();
        } else if (e.key === 'Enter') {
            if (selectedIndex >= 0) {
                if (!value && selectedIndex < recentSearches.length) {
                    onChange(recentSearches[selectedIndex]);
                    setSelectedIndex(-1);
                } else {
                    const target = results[value ? selectedIndex : selectedIndex - recentSearches.length];
                    if (target) handleSelect(target);
                }
            } else if (value && onSearch) {
                onSearch(value);
            }
        } else if (e.key === 'Escape') {
            setIsFocused(false);
            onFocusChange?.(false);
        }
    };

    const highlightMatch = (text: string, match: string) => {
        if (!match) return text;
        const parts = text.split(new RegExp(`(${match})`, 'gi'));
        return parts.map((part, i) => (
            part.toLowerCase() === match.toLowerCase()
                ? <span key={i} className="text-primary font-bold">{part}</span>
                : <span key={i}>{part}</span>
        ));
    };

    return (
        <div className={`relative w-full ${className}`} ref={dropdownRef}>
            <div className={`relative group transition-all duration-300 ${isFocused ? 'scale-[1.02]' : ''}`}>
                <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${isFocused ? 'text-primary' : 'text-white/40'}`} />
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onFocus={() => { setIsFocused(true); onFocusChange?.(true); }}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className="w-full bg-surface-2/50 border border-white/10 rounded-2xl py-4 pl-12 pr-12 text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all backdrop-blur-xl"
                />
                {value && (
                    <button
                        onClick={() => { onChange(''); inputRef.current?.focus(); }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            <AnimatePresence>
                {isFocused && (recentSearches.length > 0 || results.length > 0) && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute top-full left-0 right-0 mt-3 p-2 bg-surface-2 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-2xl z-[100] overflow-hidden"
                    >
                        {isLoading && (
                            <div className="absolute inset-0 bg-surface-2/50 backdrop-blur-sm z-50 flex items-center justify-center">
                                <span className="flex h-2 w-2 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                                </span>
                            </div>
                        )}
                        {/* Recent Searches Section */}
                        {!value && recentSearches.length > 0 && (
                            <div className="mb-2">
                                <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white/30 flex items-center gap-2">
                                    <History className="w-3 h-3" />
                                    Recent Searches
                                </div>
                                {recentSearches.map((search, idx) => (
                                    <button
                                        key={search}
                                        onClick={() => { onChange(search); inputRef.current?.focus(); }}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${selectedIndex === idx ? 'bg-white/10 text-primary' : 'hover:bg-white/5 text-white/70'}`}
                                    >
                                        <Clock className="w-4 h-4 shrink-0 opacity-40" />
                                        <span className="truncate text-sm">{search}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Results Section */}
                        {results.length > 0 && (
                            <div>
                                {value && (
                                    <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white/30 flex items-center gap-2">
                                        <TrendingUp className="w-3 h-3" />
                                        Top Suggestions
                                    </div>
                                )}
                                <div className="max-h-[min(70vh,500px)] overflow-y-auto custom-scrollbar">
                                    {results.map((video, idx) => {
                                        const actualIdx = value ? idx : idx + recentSearches.length;
                                        return (
                                            <button
                                                key={video.id}
                                                onClick={() => handleSelect(video)}
                                                onMouseEnter={() => setSelectedIndex(actualIdx)}
                                                className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${selectedIndex === actualIdx ? 'bg-primary/20 text-white' : 'hover:bg-white/5 text-white/70'}`}
                                            >
                                                <div className="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden border border-white/10 bg-black/40">
                                                    <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
                                                    <div className="absolute bottom-0 right-0 px-1 bg-black/80 text-[8px] font-bold rounded-tl">
                                                        {video.duration}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-start overflow-hidden">
                                                    <span className="text-sm font-medium truncate w-full text-left">
                                                        {highlightMatch(video.title, value)}
                                                    </span>
                                                    <span className="text-[10px] text-white/40 truncate w-full text-left">
                                                        {video.uploader}
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {isLoading && !results.length && (
                            <div className="p-12 flex flex-col items-center justify-center gap-4 text-white/20">
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                >
                                    <TrendingUp className="w-8 h-8" />
                                </motion.div>
                                <span className="text-xs font-medium animate-pulse">Scanning frequencies...</span>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Click Outside Listener */}
            {isFocused && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsFocused(false)}
                />
            )}
        </div>
    );
};
