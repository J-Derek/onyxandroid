import { useState, useEffect, useCallback, useRef } from 'react';
import { searchService } from '@/services/SearchService';
import { VideoCard } from '@/types';

export function useSearch(debounceMs = 300) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<VideoCard[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const lastRequestRef = useRef<string>('');

    const performSearch = useCallback(async (searchQuery: string) => {
        if (searchQuery.length < 2) {
            setResults([]);
            return;
        }

        lastRequestRef.current = searchQuery;

        // Show instant results if available
        const instant = searchService.getInstantResults(searchQuery);
        if (instant) {
            setResults(instant);
        }

        setIsLoading(true);
        setError(null);

        try {
            const data = await searchService.search(searchQuery, { isSuggestion: true });

            // Only update if this is still the latest request
            if (lastRequestRef.current === searchQuery) {
                setResults(data);
            }
        } catch (err: any) {
            if (lastRequestRef.current === searchQuery) {
                setError(err.message || 'Search failed');
            }
        } finally {
            if (lastRequestRef.current === searchQuery) {
                setIsLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        if (!query) {
            setResults([]);
            setIsLoading(false);
            return;
        }

        const timer = setTimeout(() => {
            performSearch(query);
        }, debounceMs);

        return () => clearTimeout(timer);
    }, [query, debounceMs, performSearch]);

    return {
        query,
        setQuery,
        results,
        isLoading,
        error,
        refresh: () => performSearch(query)
    };
}
