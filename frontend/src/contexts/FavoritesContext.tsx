/**
 * Onyx Streaming - Favorites Context
 * Manages favorite tracks for the streaming mode
 * 🔒 SECURITY: Scoped by activeProfile.id to prevent cross-user data leakage
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Track } from "./PlaybackContext";
import { useAuth } from "./AuthContext";

export interface FavoriteTrack {
    id: string | number;
    title: string;
    artist: string;
    thumbnail?: string;
    youtube_id?: string;
    source?: "youtube" | "cached" | "local";
}

interface FavoritesContextType {
    favorites: FavoriteTrack[];
    isFavorite: (id: string | number) => boolean;
    toggleFavorite: (track: Track | FavoriteTrack) => void;
    addFavorite: (track: Track | FavoriteTrack) => void;
    removeFavorite: (id: string | number) => void;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

function getStorageKey(profileId: number | string | undefined): string {
    return `onyx_favorites_${profileId ?? "anon"}`;
}

function loadFavorites(profileId: number | string | undefined): FavoriteTrack[] {
    if (!profileId) return []; // Don't load without profile
    try {
        return JSON.parse(localStorage.getItem(getStorageKey(profileId)) || "[]");
    } catch {
        return [];
    }
}

function saveFavorites(profileId: number | string | undefined, favorites: FavoriteTrack[]) {
    if (!profileId) return; // Don't save without profile
    localStorage.setItem(getStorageKey(profileId), JSON.stringify(favorites));
}

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
    const { activeProfile } = useAuth();
    const [favorites, setFavorites] = useState<FavoriteTrack[]>([]);

    // Load favorites when profile changes
    useEffect(() => {
        setFavorites(loadFavorites(activeProfile?.id));
    }, [activeProfile?.id]);

    // Listen for user change events (logout/login)
    useEffect(() => {
        const handleUserChange = () => {
            setFavorites([]); // Clear immediately, will reload when profile is set
        };
        window.addEventListener("onyx-user-changed", handleUserChange);
        return () => window.removeEventListener("onyx-user-changed", handleUserChange);
    }, []);

    // Sync across tabs (with profile scoping)
    useEffect(() => {
        const handleStorage = (e: StorageEvent) => {
            if (activeProfile?.id && e.key === getStorageKey(activeProfile.id)) {
                setFavorites(loadFavorites(activeProfile.id));
            }
        };
        window.addEventListener("storage", handleStorage);
        return () => window.removeEventListener("storage", handleStorage);
    }, [activeProfile?.id]);

    const isFavorite = useCallback((id: string | number) => {
        return favorites.some(f => f.id === id || f.id.toString() === id.toString());
    }, [favorites]);

    const addFavorite = useCallback((track: Track | FavoriteTrack) => {
        if (!activeProfile?.id) {
            toast.error("Please select a profile first");
            return;
        }
        const fav: FavoriteTrack = {
            id: track.id,
            title: track.title,
            artist: track.artist,
            thumbnail: track.thumbnail,
            youtube_id: "youtube_id" in track ? (track.youtube_id as string) : undefined,
            source: "source" in track ? (track.source as any) : "youtube"
        };
        setFavorites(prev => {
            if (prev.some(f => f.id === fav.id)) return prev;
            const updated = [...prev, fav];
            saveFavorites(activeProfile.id, updated);
            return updated;
        });
        toast.success("Added to favorites ❤️");
    }, [activeProfile?.id]);

    const removeFavorite = useCallback((id: string | number) => {
        if (!activeProfile?.id) return;
        setFavorites(prev => {
            const updated = prev.filter(f => f.id !== id && f.id.toString() !== id.toString());
            saveFavorites(activeProfile.id, updated);
            return updated;
        });
        toast.success("Removed from favorites");
    }, [activeProfile?.id]);

    const toggleFavorite = useCallback((track: Track | FavoriteTrack) => {
        if (isFavorite(track.id)) {
            removeFavorite(track.id);
        } else {
            addFavorite(track);
        }
    }, [isFavorite, addFavorite, removeFavorite]);

    return (
        <FavoritesContext.Provider value={{ favorites, isFavorite, toggleFavorite, addFavorite, removeFavorite }}>
            {children}
        </FavoritesContext.Provider>
    );
}

export function useFavorites() {
    const context = useContext(FavoritesContext);
    if (!context) {
        throw new Error("useFavorites must be used within FavoritesProvider");
    }
    return context;
}

