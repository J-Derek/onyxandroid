import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

const API_BASE = "";

export interface PlaylistTrack {
    id: number;
    title: string;
    artist: string;
    thumbnail_url?: string;
    duration: number;
    position: number;
    added_at: string;
}

export interface Playlist {
    id: number;
    name: string;
    description?: string;
    cover_image?: string;
    is_system: boolean;
    track_count: number;
    created_at: string;
    updated_at: string;
    tracks?: PlaylistTrack[];
}

interface PlaylistContextType {
    playlists: Playlist[];
    isLoading: boolean;
    fetchPlaylists: () => Promise<void>;
    getPlaylist: (id: number) => Promise<Playlist | null>;
    createPlaylist: (name: string, description?: string) => Promise<Playlist | null>;
    updatePlaylist: (id: number, data: Partial<Playlist>) => Promise<boolean>;
    deletePlaylist: (id: number) => Promise<boolean>;
    addTrackToPlaylist: (playlistId: number, trackId: number) => Promise<boolean>;
    removeTrackFromPlaylist: (playlistId: number, trackId: number) => Promise<boolean>;
    reorderTracks: (playlistId: number, trackIds: number[]) => Promise<boolean>;
}

const PlaylistContext = createContext<PlaylistContextType | undefined>(undefined);

export function PlaylistProvider({ children }: { children: React.ReactNode }) {
    const { activeProfile } = useAuth();
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const getHeaders = useCallback(() => {
        const headers: Record<string, string> = {
            "Authorization": `Bearer ${localStorage.getItem("onyx_access_token")}`
        };
        if (activeProfile) {
            headers["X-Profile-ID"] = activeProfile.id.toString();
        }
        return headers;
    }, [activeProfile]);

    const fetchPlaylists = useCallback(async () => {
        if (!activeProfile) return;
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/playlists/`, {
                headers: getHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                setPlaylists(data);
            }
        } catch (err) {
            console.error("Failed to fetch playlists:", err);
        } finally {
            setIsLoading(false);
        }
    }, [activeProfile, getHeaders]);

    const getPlaylist = async (id: number) => {
        try {
            const res = await fetch(`${API_BASE}/api/playlists/${id}`, {
                headers: getHeaders()
            });
            if (res.ok) {
                return await res.json();
            }
        } catch (err) {
            console.error("Failed to get playlist:", err);
        }
        return null;
    };

    const createPlaylist = async (name: string, description?: string) => {
        try {
            const res = await fetch(`${API_BASE}/api/playlists/`, {
                method: "POST",
                headers: {
                    ...getHeaders(),
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ name, description })
            });
            if (res.ok) {
                const newPlaylist = await res.json();
                setPlaylists(prev => [newPlaylist, ...prev]);
                toast.success("Playlist created");
                return newPlaylist;
            }
        } catch (err) {
            console.error("Failed to create playlist:", err);
            toast.error("Failed to create playlist");
        }
        return null;
    };

    const updatePlaylist = async (id: number, data: Partial<Playlist>) => {
        try {
            const res = await fetch(`${API_BASE}/api/playlists/${id}`, {
                method: "PUT",
                headers: {
                    ...getHeaders(),
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                const updated = await res.json();
                setPlaylists(prev => prev.map(p => p.id === id ? updated : p));
                toast.success("Playlist updated");
                return true;
            }
        } catch (err) {
            console.error("Failed to update playlist:", err);
            toast.error("Failed to update playlist");
        }
        return false;
    };

    const deletePlaylist = async (id: number) => {
        try {
            const res = await fetch(`${API_BASE}/api/playlists/${id}`, {
                method: "DELETE",
                headers: getHeaders()
            });
            if (res.ok) {
                setPlaylists(prev => prev.filter(p => p.id !== id));
                toast.success("Playlist deleted");
                return true;
            }
        } catch (err) {
            console.error("Failed to delete playlist:", err);
            toast.error("Failed to delete playlist");
        }
        return false;
    };

    const addTrackToPlaylist = async (playlistId: number, trackId: number) => {
        try {
            const res = await fetch(`${API_BASE}/api/playlists/${playlistId}/tracks?track_id=${trackId}`, {
                method: "POST",
                headers: getHeaders()
            });
            if (res.ok) {
                toast.success("Track added to playlist");
                fetchPlaylists(); // Refresh count
                return true;
            }
        } catch (err) {
            console.error("Failed to add track:", err);
            toast.error("Failed to add track");
        }
        return false;
    };

    const removeTrackFromPlaylist = async (playlistId: number, trackId: number) => {
        try {
            const res = await fetch(`${API_BASE}/api/playlists/${playlistId}/tracks/${trackId}`, {
                method: "DELETE",
                headers: getHeaders()
            });
            if (res.ok) {
                toast.success("Track removed from playlist");
                fetchPlaylists(); // Refresh count
                return true;
            }
        } catch (err) {
            console.error("Failed to remove track:", err);
            toast.error("Failed to remove track");
        }
        return false;
    };

    const reorderTracks = async (playlistId: number, trackIds: number[]) => {
        try {
            const res = await fetch(`${API_BASE}/api/playlists/${playlistId}/tracks/reorder`, {
                method: "PUT",
                headers: {
                    ...getHeaders(),
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(trackIds)
            });
            if (res.ok) {
                return true;
            }
        } catch (err) {
            console.error("Failed to reorder tracks:", err);
        }
        return false;
    };

    useEffect(() => {
        if (localStorage.getItem("onyx_access_token") && activeProfile) {
            fetchPlaylists();
        } else if (!activeProfile) {
            setPlaylists([]);
        }
    }, [fetchPlaylists, activeProfile]);

    return (
        <PlaylistContext.Provider value={{
            playlists,
            isLoading,
            fetchPlaylists,
            getPlaylist,
            createPlaylist,
            updatePlaylist,
            deletePlaylist,
            addTrackToPlaylist,
            removeTrackFromPlaylist,
            reorderTracks
        }}>
            {children}
        </PlaylistContext.Provider>
    );
}

export const usePlaylists = () => {
    const context = useContext(PlaylistContext);
    if (!context) {
        throw new Error("usePlaylists must be used within a PlaylistProvider");
    }
    return context;
}
