import { api } from '@/lib/api';
import { VideoCard } from '@/types';

interface CacheEntry {
    data: VideoCard[];
    timestamp: number;
}

class SearchService {
    private resultCache: Map<string, CacheEntry> = new Map();
    private prefixCache: Map<string, VideoCard[]> = new Map();
    private activeRequests: Map<string, Promise<VideoCard[]>> = new Map();
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    private readonly MAX_CACHE_SIZE = 50;

    /**
     * Search for videos with multi-tier caching
     */
    async search(query: string, options: { forceFresh?: boolean; isSuggestion?: boolean } = {}): Promise<VideoCard[]> {
        const normalizedQuery = query.trim().toLowerCase();

        if (normalizedQuery.length < 2) return [];

        // 1. Check Exact Result Cache
        if (!options.forceFresh) {
            const cached = this.resultCache.get(normalizedQuery);
            if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
                return cached.data;
            }
        }

        // 2. Check for deduplication (active requests)
        const pending = this.activeRequests.get(normalizedQuery);
        if (pending) return pending;

        // 3. Perform Network Request
        const request = this.performSearch(query, options.isSuggestion);
        this.activeRequests.set(normalizedQuery, request);

        try {
            const results = await request;

            // 4. Update Caches
            this.updateCache(normalizedQuery, results);

            return results;
        } finally {
            this.activeRequests.delete(normalizedQuery);
        }
    }

    /**
     * Get instant results from prefix cache (for backspacing/typing feel)
     */
    getInstantResults(query: string): VideoCard[] | null {
        const normalized = query.trim().toLowerCase();
        if (normalized.length < 2) return null;

        // Try exact match first
        const exact = this.resultCache.get(normalized);
        if (exact) return exact.data;

        // Try prefix match (longest matching prefix)
        let longestPrefix = "";
        for (const cachedQuery of this.prefixCache.keys()) {
            if (normalized.startsWith(cachedQuery) && cachedQuery.length > longestPrefix.length) {
                longestPrefix = cachedQuery;
            }
        }

        return longestPrefix ? this.prefixCache.get(longestPrefix) || null : null;
    }

    private async performSearch(query: string, isSuggestion?: boolean): Promise<VideoCard[]> {
        if (isSuggestion) {
            return api.getSuggestions(query) as unknown as Promise<VideoCard[]>;
        }
        return api.search(query);
    }

    private updateCache(query: string, data: VideoCard[]) {
        // Result Cache (LRU-ish)
        if (this.resultCache.size >= this.MAX_CACHE_SIZE) {
            const firstKey = this.resultCache.keys().next().value;
            this.resultCache.delete(firstKey);
        }
        this.resultCache.set(query, { data, timestamp: Date.now() });

        // Prefix Cache (store results for the search term to help partial matches)
        this.prefixCache.set(query, data);
        if (this.prefixCache.size > 100) {
            const firstKey = this.prefixCache.keys().next().value;
            this.prefixCache.delete(firstKey);
        }
    }

    clearCache() {
        this.resultCache.clear();
        this.prefixCache.clear();
    }
}

export const searchService = new SearchService();
