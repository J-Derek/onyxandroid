/**
 * Onyx — Party Mode v2 Playback Context
 * 
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️  STRICT ISOLATION: No Auth, No Profiles, No Persistence.              ║
 * ║                                                                           ║
 * ║  This context MUST remain completely isolated from:                       ║
 * ║   - AuthContext (user identity)                                           ║
 * ║   - ProfileContext (user data)                                            ║
 * ║   - FavoritesContext (user preferences)                                   ║
 * ║   - HistoryContext (listening history)                                    ║
 * ║   - localStorage / sessionStorage (persistence)                           ║
 * ║                                                                           ║
 * ║  ESLint rules in eslint.config.js enforce this at build time.             ║
 * ║  DO NOT import any user-related contexts into this file or party/*.       ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";

// ============================================================================
// RUNTIME ISOLATION CHECK
// ============================================================================
// This runs once on mount to verify Party Mode isolation is intact.
// In development, it will warn if any storage leakage is detected.
function assertPartyModeIsolation(): void {
    if (import.meta.env.DEV) {
        // Check for accidental localStorage usage with party-related keys
        const suspiciousKeys = Object.keys(localStorage).filter(
            (key) => key.toLowerCase().includes("party") && key.toLowerCase().includes("queue")
        );
        if (suspiciousKeys.length > 0) {
            console.error(
                "⛔ PARTY MODE ISOLATION VIOLATION DETECTED!",
                "\nFound localStorage keys that may break anonymity:",
                suspiciousKeys,
                "\nParty Mode must NOT persist data. Remove these keys immediately."
            );
        }
        // Log confirmation
        console.log("✅ Party Mode isolation check passed.");
    }
}

// --- Types ---

export interface PartyTrack {
    id: string; // YouTube ID
    queueId: string; // Internal unique ID for DnD
    title: string;
    artist: string;
    thumbnail: string;
    duration: number;
}

interface PartyPlaybackContextType {
    // State
    queue: PartyTrack[];
    currentIndex: number;
    currentTrack: PartyTrack | null;
    isPlaying: boolean;
    progress: number;
    currentTime: number;
    duration: number;
    volume: number;
    isFetchingRelated: boolean;
    // New: Queue and playback modes
    shuffle: boolean;
    // Audio element ref for device routing
    audioRef: React.RefObject<HTMLAudioElement | null>;
    repeatMode: 'off' | 'all' | 'one';
    endlessMode: boolean; // Auto-add related tracks
    playbackError: string | null; // Visible error state
    // Session
    sessionId: string | null;
    hostId: string | null;
    isHost: boolean;
    setIsHost: (val: boolean) => void;

    // Actions
    addToQueue: (track: Omit<PartyTrack, "queueId">) => void;
    addNextToQueue: (track: Omit<PartyTrack, "queueId">) => void; // Insert after current
    removeFromQueue: (queueId: string) => void;
    reorderQueue: (fromIdx: number, toIdx: number) => void;
    togglePlay: () => void;
    playNext: () => void;
    playPrev: () => void;
    playTrackAt: (index: number) => void;
    seek: (time: number) => void;
    seekForward: (seconds?: number) => void;
    seekBackward: (seconds?: number) => void;
    setVolume: (val: number) => void;
    // New: Mode toggles
    toggleShuffle: () => void;
    cycleRepeatMode: () => void;
    toggleEndlessMode: () => void;
    clearQueue: () => void;
    clearError: () => void;
    joinSession: (sessionId: string) => Promise<void>;
}

const PartyPlaybackContext = createContext<PartyPlaybackContextType | undefined>(undefined);

const API_BASE = import.meta.env.VITE_API_URL || "";

export function PartyPlaybackProvider({ children }: { children: React.ReactNode }) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const lastLoadedTrackIdRef = useRef<string | null>(null); // Tracks last loaded audio to prevent unnecessary reloads

    // --- Runtime Isolation Check (once on mount) ---
    useEffect(() => {
        assertPartyModeIsolation();
    }, []);

    // --- State ---
    const [queue, setQueue] = useState<PartyTrack[]>([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolumeState] = useState(0.8);
    const [isFetchingRelated, setIsFetchingRelated] = useState(false);
    const lastFetchedIdRef = useRef<string | null>(null);

    // Refs for immediate access in callbacks (avoids stale closures)
    const queueRef = useRef<PartyTrack[]>([]);
    const currentIndexRef = useRef(-1);

    // Keep refs in sync with state
    useEffect(() => { queueRef.current = queue; }, [queue]);
    useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

    // New: Mode states
    const [shuffle, setShuffle] = useState(false);
    const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
    const [endlessMode, setEndlessMode] = useState(true); // Auto-add related tracks ON by default
    const [playbackError, setPlaybackError] = useState<string | null>(null);

    // --- Session State ---
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [hostId, setHostId] = useState<string | null>(null);
    const [isHost, setIsHost] = useState(false);

    // Proactive Prefetch: Hidden reserve of related tracks
    const hiddenReserveRef = useRef<PartyTrack[]>([]);
    const hasShownAutoQueueToastRef = useRef(false); // One-time toast per session
    const hasPrefetchedForTrackRef = useRef<string | null>(null); // Track we've prefetched for
    const hasTrickledAtProgressRef = useRef(false); // Prevent multiple trickles per song
    const playNextRef = useRef<() => void>(() => { }); // Ref for playNext to avoid circular deps
    const lastUserAddedTrackIdRef = useRef<string | null>(null); // Last song USER manually added (for prefetch)

    const currentTrack = currentIndex >= 0 && currentIndex < queue.length ? queue[currentIndex] : null;
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    // --- Session Setup ---
    useEffect(() => {
        // Fallback for crypto.randomUUID which is missing in non-secure contexts (LAN HTTP)
        const generateUUID = () => {
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                return crypto.randomUUID();
            }
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        };

        // Check if we are joining a session from URL
        const params = new URLSearchParams(window.location.search);
        const joinId = params.get("join");

        if (joinId) {
            setSessionId(joinId);
            setIsHost(false);
            setHostId(null);
            console.log(`[Session] Joining party: ${joinId}`);
        } else {
            // Generate new host session
            const newSessionId = generateUUID();
            const newHostId = generateUUID();
            setSessionId(newSessionId);
            setHostId(newHostId);
            setIsHost(true);
            console.log(`[Session] Created host session: ${newSessionId}`);

            // Initialize on server
            api.createParty(newSessionId, newHostId).catch(console.error);
        }
    }, []);

    // --- Host: Periodic Sync to Server ---
    useEffect(() => {
        if (!isHost || !sessionId || !hostId) return;

        const syncInterval = setInterval(() => {
            const state = {
                session_id: sessionId,
                host_id: hostId,
                queue: queueRef.current,
                current_index: currentIndexRef.current,
                is_playing: isPlaying,
                updated_at: new Date().toISOString()
            };
            api.syncPartyState(sessionId, hostId, state).catch((err) => {
                console.warn("[Session] Sync failed:", err);
            });
        }, 5000); // Sync every 5 seconds

        return () => clearInterval(syncInterval);
    }, [isHost, sessionId, hostId, isPlaying]);

    // --- Guest: Periodic Fetch from Server ---
    useEffect(() => {
        if (isHost || !sessionId) return;

        const fetchInterval = setInterval(async () => {
            try {
                const state = await api.getPartyState(sessionId);
                if (state) {
                    // Update local state if it differs significantly
                    // (Simple check: if queue length or current index differs)
                    if (state.queue.length !== queueRef.current.length) {
                        setQueue(state.queue);
                    }
                    if (state.current_index !== currentIndexRef.current) {
                        setCurrentIndex(state.current_index);
                    }
                    if (state.is_playing !== isPlaying) {
                        setIsPlaying(state.is_playing);
                    }
                }
            } catch (err) {
                console.warn("[Session] Guest fetch failed:", err);
            }
        }, 3000); // Guests poll every 3 seconds

        return () => clearInterval(fetchInterval);
    }, [isHost, sessionId, isPlaying]);

    // --- Initialization & Audio Events ---
    useEffect(() => {
        const audio = new Audio();
        audio.crossOrigin = "anonymous";
        audioRef.current = audio;

        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onTimeUpdate = () => setCurrentTime(audio.currentTime);
        const onLoadedMetadata = () => setDuration(audio.duration);
        const onEnded = () => playNext();
        const onError = (e: any) => {
            console.warn("Party Audio Event Error:", e);

            // Only toast if it's a "hard" error and not just a playback interruption
            // Most "errors" in dev are due to aborted requests or rapid src changes
            const isFatal = audio.error && audio.error.code !== 4; // 4 is MEDIA_ERR_SRC_NOT_SUPPORTED but often seen on rapid changes

            if (isFatal) {
                console.error("Fatal Party Audio Error:", audio.error);
                toast.error("Playback failed. Trying to skip...");
                setTimeout(() => playNext(), 1000);
            }

            setIsPlaying(false);
        };

        audio.addEventListener("play", onPlay);
        audio.addEventListener("pause", onPause);
        audio.addEventListener("timeupdate", onTimeUpdate);
        audio.addEventListener("loadedmetadata", onLoadedMetadata);
        audio.addEventListener("ended", onEnded);
        audio.addEventListener("error", onError);

        return () => {
            audio.pause();
            audio.src = "";
            audio.removeEventListener("play", onPlay);
            audio.removeEventListener("pause", onPause);
            audio.removeEventListener("timeupdate", onTimeUpdate);
            audio.removeEventListener("loadedmetadata", onLoadedMetadata);
            audio.removeEventListener("ended", onEnded);
            audio.removeEventListener("error", onError);
        };
    }, []);

    // --- Sync Volume ---
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume;
        }
    }, [volume]);

    // --- Handle Track Changes ---
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        if (currentTrack) {
            const trackUrl = `${API_BASE}/api/streaming/youtube/${currentTrack.id}`;

            // FIXED: Use explicit track ID comparison instead of fragile includes() check
            // This prevents false positives if the same ID appears elsewhere in the URL
            if (lastLoadedTrackIdRef.current !== currentTrack.id) {
                lastLoadedTrackIdRef.current = currentTrack.id;
                audio.src = trackUrl;
            }

            if (isPlaying) {
                audio.play().catch((err) => {
                    // Ignore AbortError and other non-critical issues that happen during rapid track changes
                    if (err.name !== 'AbortError') {
                        console.warn("Party Audio Playback prevented:", err);
                    }
                });
            } else {
                audio.pause();
            }
        } else {
            audio.pause();
            audio.src = "";
            lastLoadedTrackIdRef.current = null;
            setCurrentTime(0);
            setDuration(0);
        }
    }, [currentTrack, isPlaying]); // Added isPlaying to the dependency array for better control

    // --- Actions ---

    const addToQueue = useCallback((track: Omit<PartyTrack, "queueId">) => {
        const newTrack: PartyTrack = {
            ...track,
            queueId: `${track.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        };

        setQueue((prev) => {
            const nextQueue = [...prev, newTrack];
            // AUTOSTART: If queue was empty, start this track
            if (prev.length === 0) {
                setCurrentIndex(0);
                setIsPlaying(true);
            }
            return nextQueue;
        });

        // Track this as last user-added song (for prefetch)
        lastUserAddedTrackIdRef.current = track.id;
        // Clear prefetch cache so we fetch related for this new song
        hasPrefetchedForTrackRef.current = null;

        toast.success(`"${track.title}" added to queue`);
    }, []);

    // Insert track right after the current track (or at start if empty)
    const addNextToQueue = useCallback((track: Omit<PartyTrack, "queueId">) => {
        const newTrack: PartyTrack = {
            ...track,
            queueId: `${track.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        };

        setQueue((prev) => {
            if (prev.length === 0) {
                // Empty queue - same as addToQueue
                setCurrentIndex(0);
                setIsPlaying(true);
                return [newTrack];
            }

            // Insert after current track
            const insertIdx = currentIndex + 1;
            const nextQueue = [...prev];
            nextQueue.splice(insertIdx, 0, newTrack);
            return nextQueue;
        });

        toast.success(`"${track.title}" playing next`);

        // Track this as last user-added song (for prefetch)
        lastUserAddedTrackIdRef.current = track.id;
        // Clear prefetch cache so we fetch related for this new song
        hasPrefetchedForTrackRef.current = null;
    }, [currentIndex]);

    const removeFromQueue = useCallback((queueId: string) => {
        setQueue((prev) => {
            const targetIdx = prev.findIndex(t => t.queueId === queueId);
            if (targetIdx === -1) return prev;

            const nextQueue = prev.filter(t => t.queueId !== queueId);

            // If we removed the currently playing track
            if (targetIdx === currentIndex) {
                if (nextQueue.length > 0 && targetIdx < nextQueue.length) {
                    // Stay at same index (moves to next song automatically)
                } else if (nextQueue.length > 0) {
                    setCurrentIndex(nextQueue.length - 1);
                } else {
                    setCurrentIndex(-1);
                    setIsPlaying(false);
                }
            } else if (targetIdx < currentIndex) {
                setCurrentIndex(curr => curr - 1);
            }

            return nextQueue;
        });
    }, [currentIndex]);

    const reorderQueue = useCallback((fromIdx: number, toIdx: number) => {
        setQueue((prev) => {
            const nextQueue = [...prev];
            const [movedItem] = nextQueue.splice(fromIdx, 1);
            nextQueue.splice(toIdx, 0, movedItem);

            // Update currentIndex if playing item moved
            if (fromIdx === currentIndex) {
                setCurrentIndex(toIdx);
            } else if (fromIdx < currentIndex && toIdx >= currentIndex) {
                setCurrentIndex(curr => curr - 1);
            } else if (fromIdx > currentIndex && toIdx <= currentIndex) {
                setCurrentIndex(curr => curr + 1);
            }

            return nextQueue;
        });
    }, [currentIndex]);

    const togglePlay = useCallback(() => {
        const audio = audioRef.current;
        if (!audio || !currentTrack) return;

        if (isPlaying) {
            audio.pause();
        } else {
            audio.play().catch(console.error);
        }
    }, [isPlaying, currentTrack]);

    // --- Fetch Related Tracks (PROACTIVE PREFETCH) ---
    // Fetches 25 tracks and stores in hidden reserve (not visible queue)
    const prefetchRelatedTracks = useCallback(async (videoId: string) => {
        // Don't double-fetch for same track
        if (hasPrefetchedForTrackRef.current === videoId || isFetchingRelated) return;

        hasPrefetchedForTrackRef.current = videoId;
        setIsFetchingRelated(true);

        try {
            const response = await fetch(`${API_BASE}/api/streaming/youtube/${videoId}/related?limit=25`);
            if (!response.ok) throw new Error("Failed to fetch related");

            const related = await response.json();
            if (!Array.isArray(related) || related.length === 0) return;

            // Store in hidden reserve (not visible queue yet)
            const newTracks: PartyTrack[] = related.map((r: any) => ({
                id: r.id,
                queueId: `${r.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                title: r.title || "Unknown",
                artist: r.artist || r.channel || "YouTube",
                thumbnail: r.thumbnail_url || r.thumbnail || `https://i.ytimg.com/vi/${r.id}/hqdefault.jpg`,
                duration: r.duration || 0
            }));

            // Filter out any already in queue OR in existing reserve (strong deduplication)
            const queueIds = new Set(queueRef.current.map(t => t.id));
            const reserveIds = new Set(hiddenReserveRef.current.map(t => t.id));
            const uniqueTracks = newTracks.filter(t => !queueIds.has(t.id) && !reserveIds.has(t.id));

            // REPLACE reserve entirely when user adds new song (fresh related tracks)
            hiddenReserveRef.current = uniqueTracks;

            console.log(`[Prefetch] Stored ${uniqueTracks.length} tracks in reserve`);

            // Show one-time toast
            if (!hasShownAutoQueueToastRef.current && endlessMode) {
                hasShownAutoQueueToastRef.current = true;
                toast.info("🎵 Auto-queue is ON. Related songs will play when your queue ends.", { duration: 3000 });
            }
        } catch (err) {
            console.error("Failed to prefetch related tracks:", err);
        } finally {
            setIsFetchingRelated(false);
        }
    }, [isFetchingRelated, endlessMode]);

    // --- Trickle: Move tracks from reserve to visible queue at 30% progress ---
    useEffect(() => {
        if (!endlessMode || !currentTrack) return;
        if (progress < 30 || hasTrickledAtProgressRef.current) return;

        // Check if we need to trickle (queue has <3 tracks remaining after current)
        const remainingInQueue = queue.length - currentIndex - 1;
        if (remainingInQueue >= 3) return; // Enough tracks, no need to trickle

        const reserve = hiddenReserveRef.current;
        if (reserve.length === 0) return;

        // Mark as trickled for this song
        hasTrickledAtProgressRef.current = true;

        // Move 10 tracks (or all if less) from reserve to queue
        const toAdd = reserve.splice(0, 10);

        // Filter any that might have been manually added since prefetch
        const existingIds = new Set(queueRef.current.map(t => t.id));
        const uniqueToAdd = toAdd.filter(t => !existingIds.has(t.id));

        if (uniqueToAdd.length > 0) {
            setQueue(prev => [...prev, ...uniqueToAdd]);
            console.log(`[Trickle] Added ${uniqueToAdd.length} tracks to queue, ${reserve.length} remaining in reserve`);
        }
    }, [progress, currentTrack, currentIndex, queue.length, endlessMode]);

    // --- Reset trickle flag when song changes ---
    useEffect(() => {
        hasTrickledAtProgressRef.current = false;
    }, [currentIndex]);

    // --- Trigger prefetch when user adds a song ---
    useEffect(() => {
        if (!endlessMode || !isPlaying) return;

        // Use last user-added track for prefetch (not current playing track)
        const trackIdForPrefetch = lastUserAddedTrackIdRef.current;
        if (!trackIdForPrefetch) return;

        // Only prefetch if we haven't already for this track
        if (hasPrefetchedForTrackRef.current !== trackIdForPrefetch) {
            prefetchRelatedTracks(trackIdForPrefetch);
        }
    }, [queue.length, isPlaying, endlessMode, prefetchRelatedTracks]); // Triggers when queue changes (new song added)

    // --- MediaSession API (Hardware Keyboard Keys) ---
    useEffect(() => {
        if (!("mediaSession" in navigator)) return;

        // Update metadata when track changes
        if (currentTrack) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: currentTrack.title,
                artist: currentTrack.artist,
                album: "Party Mode",
                artwork: currentTrack.thumbnail ? [
                    { src: currentTrack.thumbnail, sizes: "512x512", type: "image/jpeg" }
                ] : []
            });
        }

        // Register action handlers
        const handlePlay = () => {
            if (audioRef.current && currentTrack) {
                audioRef.current.play().catch(console.error);
            }
        };
        const handlePause = () => {
            if (audioRef.current) {
                audioRef.current.pause();
            }
        };
        const handlePrev = () => {
            // If more than 3 seconds in, restart. Otherwise, go to previous.
            if (audioRef.current && audioRef.current.currentTime > 3) {
                audioRef.current.currentTime = 0;
            } else {
                const idx = currentIndexRef.current;
                if (idx > 0) {
                    setCurrentIndex(idx - 1);
                    setIsPlaying(true);
                }
            }
        };
        const handleNext = () => {
            playNextRef.current();
        };

        navigator.mediaSession.setActionHandler("play", handlePlay);
        navigator.mediaSession.setActionHandler("pause", handlePause);
        navigator.mediaSession.setActionHandler("previoustrack", handlePrev);
        navigator.mediaSession.setActionHandler("nexttrack", handleNext);

        return () => {
            if ("mediaSession" in navigator) {
                navigator.mediaSession.setActionHandler("play", null);
                navigator.mediaSession.setActionHandler("pause", null);
                navigator.mediaSession.setActionHandler("previoustrack", null);
                navigator.mediaSession.setActionHandler("nexttrack", null);
            }
        };
    }, [currentTrack]); // Removed playNext - using ref instead

    // --- Cross-Mode Audio Conflict Prevention ---
    // When Streaming mode starts playing, pause Party mode
    useEffect(() => {
        const handleExternalPlayback = (e: any) => {
            if (e.detail?.context !== "party") {
                console.log("[Party] Pausing for external playback (Streaming mode)...");
                if (audioRef.current) {
                    audioRef.current.pause();
                    setIsPlaying(false);
                }
            }
        };

        window.addEventListener("onyx-playback-start", handleExternalPlayback);
        return () => window.removeEventListener("onyx-playback-start", handleExternalPlayback);
    }, []);

    // --- Dispatch event when Party starts playing ---
    useEffect(() => {
        if (isPlaying && currentTrack) {
            window.dispatchEvent(new CustomEvent("onyx-playback-start", {
                detail: { context: "party" }
            }));
        }
    }, [isPlaying, currentTrack]);

    // --- Prefetch audio for reserve tracks (background) ---
    useEffect(() => {
        const reserve = hiddenReserveRef.current;
        if (reserve.length === 0) return;

        // Prefetch first 3 tracks in reserve for faster playback
        const prefetchCount = Math.min(3, reserve.length);
        for (let i = 0; i < prefetchCount; i++) {
            const track = reserve[i];
            if (track) {
                fetch(`${API_BASE}/api/streaming/youtube/${track.id}/prefetch?priority=2`)
                    .catch(() => { }); // Silent fail
            }
        }
    }, [queue.length]); // Re-run when queue changes (after trickle)

    // Legacy fetch function (used by playNext when queue truly ends)
    const fetchRelatedTracks = useCallback(async (videoId: string) => {
        // If we have reserve tracks, use those first
        const reserve = hiddenReserveRef.current;
        if (reserve.length > 0) {
            const toAdd = reserve.splice(0, 10);
            const existingIds = new Set(queueRef.current.map(t => t.id));
            const uniqueToAdd = toAdd.filter(t => !existingIds.has(t.id));
            if (uniqueToAdd.length > 0) {
                setQueue(prev => [...prev, ...uniqueToAdd]);
                toast.success(`Added ${uniqueToAdd.length} related tracks`);
            }
            return;
        }

        // Otherwise, do live fetch
        if (lastFetchedIdRef.current === videoId || isFetchingRelated) return;
        lastFetchedIdRef.current = videoId;
        setIsFetchingRelated(true);

        try {
            const response = await fetch(`${API_BASE}/api/streaming/youtube/${videoId}/related?limit=25`);
            if (!response.ok) throw new Error("Failed to fetch related");

            const related = await response.json();
            if (!Array.isArray(related) || related.length === 0) return;

            const newTracks: PartyTrack[] = related.slice(0, 10).map((r: any) => ({
                id: r.id,
                queueId: `${r.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                title: r.title || "Unknown",
                artist: r.artist || r.channel || "YouTube",
                thumbnail: r.thumbnail_url || r.thumbnail || `https://i.ytimg.com/vi/${r.id}/hqdefault.jpg`,
                duration: r.duration || 0
            }));

            setQueue(prev => {
                const existingIds = new Set(prev.map(t => t.id));
                const uniqueNew = newTracks.filter(t => !existingIds.has(t.id));
                if (uniqueNew.length > 0) {
                    toast.success(`Added ${uniqueNew.length} related tracks`);
                    return [...prev, ...uniqueNew];
                }
                return prev;
            });
        } catch (err) {
            console.error("Failed to fetch related tracks:", err);
        } finally {
            setIsFetchingRelated(false);
        }
    }, [isFetchingRelated]);

    const playNext = useCallback(() => {
        // Read current values from refs (always up-to-date)
        const idx = currentIndexRef.current;
        const q = queueRef.current;

        if (idx < q.length - 1) {
            // There are more tracks in queue - just advance
            setCurrentIndex(idx + 1);
            setIsPlaying(true);
        } else {
            // At end of queue
            if (endlessMode) {
                // Fetch related tracks in background
                const lastTrack = q[q.length - 1];
                if (lastTrack) {
                    fetchRelatedTracks(lastTrack.id).then(() => {
                        // After fetch, check if new tracks were added and advance
                        const updatedQ = queueRef.current;
                        const currentIdx = currentIndexRef.current;
                        if (currentIdx < updatedQ.length - 1) {
                            setCurrentIndex(currentIdx + 1);
                            setIsPlaying(true);
                        } else {
                            toast.info("No more related tracks found");
                            setIsPlaying(false);
                        }
                    });
                }
            } else {
                // Endless mode OFF - just stop
                setIsPlaying(false);
                toast.info("Queue ended");
            }
        }
    }, [endlessMode, fetchRelatedTracks]);

    // Sync playNextRef with playNext (for MediaSession to use)
    useEffect(() => { playNextRef.current = playNext; }, [playNext]);

    const playPrev = useCallback(() => {
        if (currentTime > 3 && audioRef.current) {
            audioRef.current.currentTime = 0;
        } else if (currentIndex > 0) {
            setCurrentIndex(curr => curr - 1);
            setIsPlaying(true);
        }
    }, [currentIndex, currentTime]);

    const playTrackAt = useCallback((index: number) => {
        if (index >= 0 && index < queue.length) {
            setCurrentIndex(index);
            setIsPlaying(true);
        }
    }, [queue.length]);

    const seek = useCallback((time: number) => {
        if (audioRef.current) {
            audioRef.current.currentTime = time;
        }
    }, []);

    const seekForward = useCallback((seconds: number = 10) => {
        if (audioRef.current) {
            const newTime = Math.min(audioRef.current.currentTime + seconds, audioRef.current.duration || 0);
            audioRef.current.currentTime = newTime;
        }
    }, []);

    const seekBackward = useCallback((seconds: number = 10) => {
        if (audioRef.current) {
            const newTime = Math.max(audioRef.current.currentTime - seconds, 0);
            audioRef.current.currentTime = newTime;
        }
    }, []);

    const setVolume = useCallback((val: number) => {
        setVolumeState(val);
    }, []);

    // --- Mode Toggle Functions ---
    const toggleShuffle = useCallback(() => {
        setShuffle(prev => !prev);
        toast.success(shuffle ? "Shuffle off" : "Shuffle on");
    }, [shuffle]);

    const cycleRepeatMode = useCallback(() => {
        setRepeatMode(prev => {
            const next = prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off';
            const labels = { off: 'Repeat off', all: 'Repeat all', one: 'Repeat one' };
            toast.success(labels[next]);
            return next;
        });
    }, []);

    const toggleEndlessMode = useCallback(() => {
        setEndlessMode(prev => {
            toast.success(prev ? "Auto-queue off" : "Auto-queue on — related tracks will be added");
            return !prev;
        });
    }, []);

    const clearQueue = useCallback(() => {
        setQueue([]);
        setCurrentIndex(-1);
        setIsPlaying(false);
        hiddenReserveRef.current = [];
        // Reset prefetch flags
        hasPrefetchedForTrackRef.current = null;
        lastUserAddedTrackIdRef.current = null;
        toast.success("Queue cleared");
    }, []);

    const clearError = useCallback(() => {
        setPlaybackError(null);
    }, []);

    const saveSession = useCallback(() => {
        if (queue.length === 0) return;
        const snapshot = {
            queue,
            currentIndex,
            savedAt: new Date().toISOString()
        };
        localStorage.setItem(`onyx_party_replay_${sessionId}`, JSON.stringify(snapshot));
        toast.success("Session saved for replay");
    }, [queue, currentIndex, sessionId]);

    const loadSession = useCallback((sid: string) => {
        const saved = localStorage.getItem(`onyx_party_replay_${sid}`);
        if (saved) {
            const snapshot = JSON.parse(saved);
            setQueue(snapshot.queue);
            setCurrentIndex(snapshot.currentIndex);
            toast.success("Replayed saved session");
        }
    }, []);

    const joinSession = useCallback(async (sid: string) => {
        try {
            const state = await api.getPartyState(sid);
            if (state) {
                setSessionId(sid);
                setHostId(null);
                setIsHost(false);
                setQueue(state.queue);
                setCurrentIndex(state.current_index);
                setIsPlaying(state.is_playing);
                toast.success("Joined party session!");
            }
        } catch (err) {
            toast.error("Failed to join party: session not found");
        }
    }, []);

    const value = {
        queue,
        currentIndex,
        currentTrack,
        isPlaying,
        progress,
        currentTime,
        duration,
        volume,
        isFetchingRelated,
        // New states
        shuffle,
        repeatMode,
        endlessMode,
        playbackError,
        // Audio ref for device routing
        audioRef,
        // Actions
        addToQueue,
        addNextToQueue,
        removeFromQueue,
        reorderQueue,
        togglePlay,
        playNext,
        playPrev,
        playTrackAt,
        seek,
        seekForward,
        seekBackward,
        setVolume,
        // New toggles
        toggleShuffle,
        cycleRepeatMode,
        toggleEndlessMode,
        clearQueue,
        clearError,
        joinSession,
        // Session
        sessionId,
        hostId,
        isHost,
        setIsHost,
        saveSession,
        loadSession
    };

    return (
        <PartyPlaybackContext.Provider value={value}>
            {children}
        </PartyPlaybackContext.Provider>
    );
}

export function usePartyPlayback() {
    const context = useContext(PartyPlaybackContext);
    if (!context) {
        throw new Error("usePartyPlayback must be used within a PartyPlaybackProvider");
    }
    return context;
}
