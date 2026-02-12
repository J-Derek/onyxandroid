/**
 * Onyx Streaming - Cache Context
 * Manages local IndexedDB storage for offline tracks.
 * 🔒 SECURITY: Scoped by activeProfile.id to prevent cross-user data leakage
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "./AuthContext";

interface CachedTrack {
    id: string | number;
    blob: Blob;
    contentType: string;
    storedAt: number;
}

interface CacheContextType {
    isCached: (trackId: string | number) => Promise<boolean>;
    saveToCache: (trackId: string | number, url: string) => Promise<void>;
    getCachedUrl: (trackId: string | number) => Promise<string | null>;
    removeFromCache: (trackId: string | number) => Promise<void>;
    getCacheSize: () => Promise<number>;
    clearCache: () => Promise<void>;
}

const CacheContext = createContext<CacheContextType | undefined>(undefined);

const STORE_NAME = "tracks";

function getDbName(profileId: number | string | undefined): string {
    return `onyx_cache_${profileId ?? "anon"}`;
}

export function CacheProvider({ children }: { children: React.ReactNode }) {
    const { activeProfile } = useAuth();
    const [db, setDb] = useState<IDBDatabase | null>(null);
    const dbRef = useRef<IDBDatabase | null>(null);

    // Initialize IDB when profile changes
    useEffect(() => {
        // Close previous database if open
        if (dbRef.current) {
            dbRef.current.close();
            dbRef.current = null;
            setDb(null);
        }

        // Don't open database without a profile
        if (!activeProfile?.id) {
            return;
        }

        const dbName = getDbName(activeProfile.id);
        const request = indexedDB.open(dbName, 1);

        request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
            const database = (e.target as IDBOpenDBRequest).result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME, { keyPath: "id" });
            }
        };
        request.onsuccess = (e: Event) => {
            const database = (e.target as IDBOpenDBRequest).result;
            dbRef.current = database;
            setDb(database);
        };
        request.onerror = (e) => console.error("Cache DB failed", e);

        return () => {
            if (dbRef.current) {
                dbRef.current.close();
                dbRef.current = null;
            }
        };
    }, [activeProfile?.id]);

    // Listen for user change events (logout/login)
    useEffect(() => {
        const handleUserChange = () => {
            if (dbRef.current) {
                dbRef.current.close();
                dbRef.current = null;
                setDb(null);
            }
        };
        window.addEventListener("onyx-user-changed", handleUserChange);
        return () => window.removeEventListener("onyx-user-changed", handleUserChange);
    }, []);

    const isCached = useCallback(async (trackId: string | number) => {
        if (!db) return false;
        return new Promise<boolean>((resolve) => {
            const transaction = db.transaction(STORE_NAME, "readonly");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(trackId);
            request.onsuccess = () => resolve(!!request.result);
            request.onerror = () => resolve(false);
        });
    }, [db]);

    const saveToCache = useCallback(async (trackId: string | number, url: string) => {
        if (!db) {
            toast.error("Please select a profile first");
            return;
        }

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("Failed to fetch track for caching");

            const blob = await response.blob();
            const transaction = db.transaction(STORE_NAME, "readwrite");
            const store = transaction.objectStore(STORE_NAME);

            const cachedTrack: CachedTrack = {
                id: trackId,
                blob,
                contentType: blob.type,
                storedAt: Date.now()
            };

            store.put(cachedTrack);
            toast.success("Saved to device for offline playback");
        } catch (err) {
            console.error("Cache failed", err);
            toast.error("Failed to save track locally");
        }
    }, [db]);

    const getCachedUrl = useCallback(async (trackId: string | number) => {
        if (!db) return null;
        return new Promise<string | null>((resolve) => {
            const transaction = db.transaction(STORE_NAME, "readonly");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(trackId);
            request.onsuccess = () => {
                if (request.result) {
                    resolve(URL.createObjectURL(request.result.blob));
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => resolve(null);
        });
    }, [db]);

    const removeFromCache = useCallback(async (trackId: string | number) => {
        if (!db) return;
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        store.delete(trackId);
    }, [db]);

    const getCacheSize = useCallback(async () => {
        if (!db) return 0;
        return new Promise<number>((resolve) => {
            const transaction = db.transaction(STORE_NAME, "readonly");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => {
                const total = request.result.reduce((acc: number, item: CachedTrack) => acc + item.blob.size, 0);
                resolve(total);
            };
        });
    }, [db]);

    const clearCache = useCallback(async () => {
        if (!db) return;
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        store.clear();
        toast.success("Local cache cleared");
    }, [db]);

    return (
        <CacheContext.Provider value={{ isCached, saveToCache, getCachedUrl, removeFromCache, getCacheSize, clearCache }}>
            {children}
        </CacheContext.Provider>
    );
}

export function useCache() {
    const context = useContext(CacheContext);
    if (context === undefined) {
        throw new Error("useCache must be used within a CacheProvider");
    }
    return context;
}

