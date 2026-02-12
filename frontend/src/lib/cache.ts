/**
 * Video Info Cache utility
 * Caches video info in localStorage with TTL to avoid repeated API calls
 */

interface CacheEntry<T> {
    data: T;
    expires: number;
}

const CACHE_KEY = "onyx-video-cache";
const DEFAULT_TTL_MINUTES = 60;

// Get all cached entries
const getCache = <T>(): Map<string, CacheEntry<T>> => {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (!cached) return new Map();

        const parsed = JSON.parse(cached);
        return new Map(Object.entries(parsed));
    } catch {
        return new Map();
    }
};

// Save cache to localStorage
const saveCache = <T>(cache: Map<string, CacheEntry<T>>): void => {
    try {
        const obj: Record<string, CacheEntry<T>> = {};
        cache.forEach((value, key) => {
            obj[key] = value;
        });
        localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
    } catch (error) {
        console.warn("Failed to save cache:", error);
    }
};

// Extract video ID from URL
export const extractVideoId = (url: string): string | null => {
    if (url.includes("youtu.be/")) {
        return url.split("youtu.be/")[1]?.split("?")[0]?.split("/")[0] || null;
    } else if (url.includes("v=")) {
        return url.split("v=")[1]?.split("&")[0] || null;
    }
    return null;
};

// Get cached video info
export const getCachedVideoInfo = <T>(videoId: string): T | null => {
    const cache = getCache<T>();
    const entry = cache.get(videoId);

    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.expires) {
        // Remove expired entry
        cache.delete(videoId);
        saveCache(cache);
        return null;
    }

    return entry.data;
};

// Set cached video info
export const setCachedVideoInfo = <T>(
    videoId: string,
    data: T,
    ttlMinutes: number = DEFAULT_TTL_MINUTES
): void => {
    const cache = getCache<T>();

    cache.set(videoId, {
        data,
        expires: Date.now() + ttlMinutes * 60 * 1000,
    });

    // Clean up old entries if cache is too big (max 100 entries)
    if (cache.size > 100) {
        const sortedEntries = Array.from(cache.entries())
            .sort((a, b) => a[1].expires - b[1].expires);

        // Remove oldest 20 entries
        sortedEntries.slice(0, 20).forEach(([key]) => {
            cache.delete(key);
        });
    }

    saveCache(cache);
};

// Clear the entire cache
export const clearVideoCache = (): void => {
    localStorage.removeItem(CACHE_KEY);
};

// Get cache statistics
export const getCacheStats = (): { count: number; size: string } => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return { count: 0, size: "0 KB" };

    const cache = getCache();
    const sizeBytes = new Blob([cached]).size;

    return {
        count: cache.size,
        size: sizeBytes > 1024
            ? `${(sizeBytes / 1024).toFixed(1)} KB`
            : `${sizeBytes} B`,
    };
};
