import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Suggestion } from "@/types";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: Suggestion[];
  isLoadingSuggestions: boolean;
  onSuggestionSelect: (suggestion: Suggestion) => void;
  onSearch: () => void;
  onFocusChange?: (isFocused: boolean) => void;
}

export function SearchBar({
  value,
  onChange,
  suggestions,
  isLoadingSuggestions,
  onSuggestionSelect,
  onSearch,
  onFocusChange,
}: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setIsFocused(false);
        onFocusChange?.(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onFocusChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onSearch();
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion: Suggestion) => {
    onSuggestionSelect(suggestion);
    setShowSuggestions(false);
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-3xl mx-auto">
      <motion.div
        className={cn(
          "relative flex items-center gap-3 px-6 py-4 rounded-full border border-white/10 bg-black/20 backdrop-blur-xl transition-all duration-300",
          isFocused && "input-glow border-primary/50 bg-black/40"
        )}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          animate={{ scale: isFocused ? 1.1 : 1 }}
          transition={{ duration: 0.2 }}
        >
          <Search className={cn(
            "w-5 h-5 transition-colors",
            isFocused ? "text-primary" : "text-muted-foreground"
          )} />
        </motion.div>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={(e) => {
            e.target.select();
            setIsFocused(true);
            setShowSuggestions(true);
            onFocusChange?.(true);
          }}
          onBlur={() => {
            // Don't clear focus state here to allow clicking suggestions
            // Focus will be cleared by click outside listener
          }}
          onKeyDown={handleKeyDown}
          placeholder="Paste YouTube link or search..."
          className="flex-1 bg-transparent text-lg text-foreground placeholder:text-muted-foreground focus:outline-none"
        />

        <AnimatePresence>
          {value && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              onClick={() => onChange("")}
              className="p-1.5 rounded-full hover:bg-surface-2 transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </motion.button>
          )}
        </AnimatePresence>

        {isLoadingSuggestions && (
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        )}
      </motion.div>

      {/* Suggestions Dropdown */}
      <AnimatePresence>
        {showSuggestions && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 right-0 mt-2 rounded-xl glass border border-border/50 overflow-hidden z-50 shadow-2xl"
          >
            {suggestions.map((suggestion, index) => (
              <motion.button
                key={suggestion.url}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full flex items-center gap-3 p-3 hover:bg-surface-2 transition-colors text-left group"
              >
                {suggestion.thumbnail && (
                  <div className="relative w-16 h-12 rounded-lg overflow-hidden flex-shrink-0">
                    <img
                      src={suggestion.thumbnail}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {suggestion.duration && (
                      <span className="absolute bottom-1 right-1 px-1 py-0.5 text-xs font-medium bg-background/80 rounded">
                        {suggestion.duration}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {suggestion.title}
                  </p>
                  {suggestion.uploader && (
                    <p className="text-xs text-muted-foreground truncate">
                      {suggestion.uploader}
                    </p>
                  )}
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
