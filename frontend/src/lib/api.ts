import type { VideoCard, Suggestion, DownloadTask } from "@/types";

const API_BASE = "/api";
const GLOBAL_TIMEOUT_MS = 60000;

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GLOBAL_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            ...options,
            signal: options?.signal || controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch {
                // ignore
            }
            let message = errorData?.detail || errorData?.message || response.statusText;
            if (typeof message === 'object') {
                message = JSON.stringify(message);
            }
            throw new Error(message);
        }
        return response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error("Connection timeout. The server took too long to respond. Please try again.");
        }
        throw error;
    }
}

export const api = {
    getTrending: async (refresh = false): Promise<VideoCard[]> => {
        return fetchJson<VideoCard[]>(`${API_BASE}/trending${refresh ? '?refresh=true' : ''}`);
    },

    getSuggestions: async (query: string): Promise<Suggestion[]> => {
        return fetchJson<Suggestion[]>(`${API_BASE}/suggestions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query }),
        });
    },

    search: async (query: string): Promise<VideoCard[]> => {
        const data = await fetchJson<{ results: VideoCard[] }>(`${API_BASE}/search`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query }),
        });
        return data.results;
    },

    getVideoInfo: async (url: string): Promise<VideoCard & { is_playlist?: boolean }> => {
        return fetchJson<VideoCard & { is_playlist?: boolean }>(`${API_BASE}/info`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, force_single: true }),
        });
    },

    getPlaylist: async (url: string): Promise<{ title: string; videos: VideoCard[] }> => {
        return fetchJson<{ title: string; videos: VideoCard[] }>(`${API_BASE}/playlists`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, limit: 50 }),
        });
    },

    startDownload: async (
        url: string,
        format: string,
        quality: string,
        outputFormat?: string,
        title?: string,
        artist?: string,
        thumbnail?: string
    ): Promise<{ task_id: string }> => {
        return fetchJson<{ task_id: string }>(`${API_BASE}/downloads`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                url,
                format,
                quality,
                output_format: outputFormat,
                title,
                artist,
                thumbnail
            }),
        });
    },

    startBatchDownload: async (
        urls: string[],
        format: string,
        quality: string,
        folderName?: string
    ): Promise<{ task_ids: string[] }> => {
        return fetchJson<{ task_ids: string[] }>(`${API_BASE}/downloads/batch`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ urls, format, quality, folder_name: folderName }),
        });
    },

    getDownloadProgress: async (taskId: string): Promise<DownloadTask> => {
        return fetchJson<DownloadTask>(`${API_BASE}/downloads/${taskId}`);
    },

    cancelDownload: async (taskId: string): Promise<void> => {
        await fetchJson<void>(`${API_BASE}/downloads/${taskId}/stop`, {
            method: "POST",
        });
    },

    getLibrary: async (): Promise<import("@/types").LibraryFile[]> => {
        return fetchJson<import("@/types").LibraryFile[]>(`${API_BASE}/library`);
    },

    getYtdlpVersion: async (): Promise<{ version: string }> => {
        return fetchJson<{ version: string }>(`${API_BASE}/downloads/ytdlp-version`);
    },

    updateYtdlp: async (): Promise<{ success: boolean; message: string }> => {
        return fetchJson<{ success: boolean; message: string }>(`${API_BASE}/downloads/update-ytdlp`, {
            method: "POST",
        });
    },

    checkDownloadStrategy: async (videoId: string): Promise<{
        audio_only_available: boolean;
        estimated_size_mb: number | null;
        title: string;
    }> => {
        return fetchJson(`${API_BASE}/download/formats/${videoId}`);
    },

    // Party Mode
    createParty: async (sessionId: string, hostId: string): Promise<any> => {
        return fetchJson(`${API_BASE}/party/create?session_id=${sessionId}&host_id=${hostId}`, {
            method: "POST"
        });
    },

    getPartyState: async (sessionId: string): Promise<any> => {
        return fetchJson(`${API_BASE}/party/${sessionId}`);
    },

    syncPartyState: async (sessionId: string, hostId: string, state: any): Promise<any> => {
        return fetchJson(`${API_BASE}/party/${sessionId}/sync?host_id=${hostId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(state),
        });
    },

    addToParty: async (sessionId: string, track: any): Promise<any> => {
        return fetchJson(`${API_BASE}/party/${sessionId}/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "add", track }),
        });
    },

    endParty: async (sessionId: string, hostId: string): Promise<void> => {
        await fetchJson(`${API_BASE}/party/${sessionId}?host_id=${hostId}`, {
            method: "DELETE"
        });
    },

    voteToSkip: async (sessionId: string, userId: string): Promise<any> => {
        return fetchJson(`${API_BASE}/party/${sessionId}/vote?user_id=${userId}`, {
            method: "POST"
        });
    },
};
