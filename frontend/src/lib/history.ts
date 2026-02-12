/**
 * Download History utility
 * Stores download history in localStorage for quick re-downloads
 * 🔒 SECURITY: Scoped by userId to prevent cross-user data leakage
 */

export interface HistoryItem {
    id: string;
    videoId: string;
    url: string;
    title: string;
    thumbnail?: string;
    format: "video" | "audio";
    quality: string;
    downloadedAt: string;
    filename: string;
    sizeMb?: number;
}

const MAX_HISTORY_ITEMS = 100;

function getHistoryKey(userId?: string | number): string {
    return `onyx_download_history_${userId ?? "anon"}`;
}

// Get all history items for a user
export const getDownloadHistory = (userId?: string | number): HistoryItem[] => {
    try {
        const stored = localStorage.getItem(getHistoryKey(userId));
        if (!stored) return [];
        return JSON.parse(stored) as HistoryItem[];
    } catch {
        return [];
    }
};

// Add item to history for a user
export const addToHistory = (item: Omit<HistoryItem, "id" | "downloadedAt">, userId?: string | number): void => {
    try {
        const history = getDownloadHistory(userId);

        // Check if already exists (by videoId + format)
        const existingIndex = history.findIndex(
            h => h.videoId === item.videoId && h.format === item.format
        );

        const newItem: HistoryItem = {
            ...item,
            id: `${item.videoId}-${item.format}-${Date.now()}`,
            downloadedAt: new Date().toISOString(),
        };

        if (existingIndex !== -1) {
            // Update existing entry
            history[existingIndex] = newItem;
        } else {
            // Add to beginning
            history.unshift(newItem);
        }

        // Keep only the last MAX_HISTORY_ITEMS
        const trimmed = history.slice(0, MAX_HISTORY_ITEMS);

        localStorage.setItem(getHistoryKey(userId), JSON.stringify(trimmed));
    } catch (error) {
        console.warn("Failed to save to history:", error);
    }
};

// Remove item from history for a user
export const removeFromHistory = (id: string, userId?: string | number): void => {
    try {
        const history = getDownloadHistory(userId);
        const filtered = history.filter(h => h.id !== id);
        localStorage.setItem(getHistoryKey(userId), JSON.stringify(filtered));
    } catch (error) {
        console.warn("Failed to remove from history:", error);
    }
};

// Clear all history for a user
export const clearHistory = (userId?: string | number): void => {
    localStorage.removeItem(getHistoryKey(userId));
};

// Get history stats for a user
export const getHistoryStats = (userId?: string | number): { count: number; totalSizeMb: number } => {
    const history = getDownloadHistory(userId);
    const totalSizeMb = history.reduce((acc, item) => acc + (item.sizeMb || 0), 0);
    return { count: history.length, totalSizeMb };
};

// Extract video ID from URL
const extractVideoId = (url: string): string => {
    if (url.includes("youtu.be/")) {
        return url.split("youtu.be/")[1]?.split("?")[0]?.split("/")[0] || url;
    } else if (url.includes("v=")) {
        return url.split("v=")[1]?.split("&")[0] || url;
    }
    return url;
};

// Helper to create history item from download completion
export const createHistoryItem = (
    url: string,
    title: string,
    thumbnail: string | undefined,
    format: "video" | "audio",
    quality: string,
    filename: string,
    sizeMb?: number
): Omit<HistoryItem, "id" | "downloadedAt"> => ({
    videoId: extractVideoId(url),
    url,
    title,
    thumbnail,
    format,
    quality,
    filename,
    sizeMb,
});

