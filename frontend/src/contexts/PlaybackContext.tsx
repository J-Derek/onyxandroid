/**
 * Onyx Streaming - Playback Context
 * Centralized audio engine and queue management.
 */
import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { useCache } from "./CacheContext";
import { useAuth } from "./AuthContext";

// --- Types ---

export type TrackSource = "local" | "youtube" | "cached";

export interface Track {
    id: string | number;
    title: string;
    artist: string;
    album?: string;
    thumbnail?: string;
    duration?: number;
    source: TrackSource;
    uri: string; // API endpoint for streaming
    youtube_id?: string; // Optional for tracking
    // --- New State Flags ---
    state?: "idle" | "loading" | "ready" | "error";
    is_available?: boolean;
    error_message?: string;
}

interface PlaybackContextType {
    // State
    currentTrack: Track | null;
    queue: Track[];
    currentIndex: number;
    isPlaying: boolean;
    progress: number; // 0 to 100
    currentTime: number;
    duration: number;
    volume: number;
    isMuted: boolean;
    repeatMode: "none" | "one" | "all";
    isShuffle: boolean;
    isLoading: boolean;
    isQueueLoading: boolean; // 🚀 True while fetching related tracks for queue

    // Controls
    playTrack: (track: Track, fromQueue?: boolean) => void;
    playPlaylist: (tracks: Track[], startIndex?: number) => void;
    addToQueue: (track: Track) => void;
    removeFromQueue: (index: number) => void;
    clearQueue: () => void;
    togglePlay: () => void;
    next: () => void;
    previous: () => void;
    seek: (time: number) => void;
    setVolume: (volume: number) => void;
    toggleMute: () => void;
    setRepeatMode: (mode: "none" | "one" | "all") => void;
    toggleShuffle: () => void;
    playFromQueue: (index: number) => void;
    reorderQueue: (fromIndex: number, toIndex: number) => void;
    crossfadeMs: number;
    setCrossfadeMs: (ms: number) => void;
    audioRef: React.RefObject<HTMLAudioElement | null>;
    isOfflineMode: boolean;
    setIsOfflineMode: (offline: boolean) => void;
    analyser: AnalyserNode | null;
}

const PlaybackContext = createContext<PlaybackContextType | undefined>(undefined);

// --- Provider ---

const ensureTrackState = (track: Track): Track => ({
    ...track,
    state: track.state || "idle",
    is_available: track.is_available ?? true
});

export function PlaybackProvider({ children }: { children: React.ReactNode }) {
    // Audio Element Ref
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const isTransitioningRef = useRef(false); // Prevents error events during source changes
    const { getCachedUrl } = useCache();
    const { activeProfile } = useAuth();

    // State
    const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
    const [queue, setQueue] = useState<Track[]>([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isQueueLoading, setIsQueueLoading] = useState(false); // 🚀 Queue loading state for skeleton UI
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolumeState] = useState(parseFloat(localStorage.getItem("onyx_volume") || "1"));
    const [isMuted, setIsMuted] = useState(false);
    const [repeatMode, setRepeatMode] = useState<"none" | "one" | "all">("none");
    const [isShuffle, setIsShuffle] = useState(false);
    const [crossfadeMs, setCrossfadeMs] = useState(() => {
        const saved = localStorage.getItem("onyx_crossfade");
        return saved ? parseInt(saved) : 0;
    });
    const [isOfflineMode, setIsOfflineModeState] = useState(() => {
        return localStorage.getItem("onyx_offline_mode") === "true";
    });
    const crossfadeTimerRef = useRef<number | null>(null);
    const nextRef = useRef<() => void>(() => { });  // Ref to always have latest next()

    // Web Audio API refs
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
    const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

    // =============================================================================
    // QUEUE PERSISTENCE
    // =============================================================================

    const API_BASE = import.meta.env.VITE_API_URL || "";
    const queueSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSavedQueueRef = useRef<string>(""); // Track last saved state to avoid redundant saves

    // Queue lifecycle phase: blocks mutations during restore to prevent race conditions
    type QueuePhase = "idle" | "restoring" | "active";
    const [queuePhase, setQueuePhase] = useState<QueuePhase>("idle");

    // Helper to get auth headers
    const getQueueHeaders = useCallback(() => {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("onyx_access_token")}`
        };
        if (activeProfile) {
            headers["X-Profile-ID"] = activeProfile.id.toString();
        }
        return headers;
    }, [activeProfile]);

    // Save queue to backend (debounced)
    const saveQueueToBackend = useCallback(async (
        tracks: Track[],
        index: number,
        timeSec: number,
        repeat: string,
        shuffle: boolean
    ) => {
        if (!activeProfile || queuePhase !== "active") return;

        const queueState = {
            tracks,
            current_index: index,
            current_time_sec: timeSec,
            repeat_mode: repeat,
            is_shuffle: shuffle
        };

        // Skip if unchanged
        const stateStr = JSON.stringify(queueState);
        if (stateStr === lastSavedQueueRef.current) return;

        try {
            const res = await fetch(`${API_BASE}/api/queue`, {
                method: "PUT",
                headers: getQueueHeaders(),
                body: stateStr
            });
            if (res.ok) {
                lastSavedQueueRef.current = stateStr;
            }
        } catch (err) {
            console.error("Failed to save queue:", err);
        }
    }, [activeProfile, getQueueHeaders, API_BASE, queuePhase]);

    // Debounced save trigger
    const debouncedSaveQueue = useCallback(() => {
        if (queueSaveTimeoutRef.current) {
            clearTimeout(queueSaveTimeoutRef.current);
        }
        queueSaveTimeoutRef.current = setTimeout(() => {
            saveQueueToBackend(queue, currentIndex, currentTime, repeatMode, isShuffle);
        }, 2000);
    }, [queue, currentIndex, currentTime, repeatMode, isShuffle, saveQueueToBackend]);

    // Restore queue from backend on profile change
    useEffect(() => {
        if (!activeProfile) return;

        const restoreQueue = async () => {
            setQueuePhase("restoring");
            try {
                const res = await fetch(`${API_BASE}/api/queue`, {
                    headers: getQueueHeaders()
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.tracks && data.tracks.length > 0) {
                        setQueue(data.tracks);
                        setCurrentIndex(data.current_index);
                        setRepeatMode(data.repeat_mode || "none");
                        setIsShuffle(data.is_shuffle || false);
                        // Set current track if index is valid
                        if (data.current_index >= 0 && data.current_index < data.tracks.length) {
                            setCurrentTrack(data.tracks[data.current_index]);
                        }
                        // Cache this as last saved state
                        lastSavedQueueRef.current = JSON.stringify({
                            tracks: data.tracks,
                            current_index: data.current_index,
                            current_time_sec: data.current_time_sec,
                            repeat_mode: data.repeat_mode,
                            is_shuffle: data.is_shuffle
                        });
                    } else {
                        // Fix #4: Empty queue - explicitly stop playback
                        setQueue([]);
                        setCurrentIndex(-1);
                        setCurrentTrack(null);
                        if (audioRef.current) {
                            audioRef.current.pause();
                            audioRef.current.src = "";
                        }
                        setIsPlaying(false);
                        lastSavedQueueRef.current = "";
                    }
                }
            } catch (err) {
                console.error("Failed to restore queue:", err);
            } finally {
                setQueuePhase("active");
            }
        };

        restoreQueue();
    }, [activeProfile?.id, API_BASE, getQueueHeaders]);

    // Auto-save queue when it changes (debounced)
    useEffect(() => {
        if (!activeProfile || queuePhase !== "active" || queue.length === 0) return;
        debouncedSaveQueue();

        return () => {
            if (queueSaveTimeoutRef.current) {
                clearTimeout(queueSaveTimeoutRef.current);
            }
        };
    }, [queue, currentIndex, repeatMode, isShuffle, activeProfile, debouncedSaveQueue]);

    // Save on page unload
    useEffect(() => {
        const handleUnload = () => {
            if (!activeProfile || queue.length === 0) return;

            // Use fetch with keepalive for reliable unload save with auth headers
            const body = JSON.stringify({
                tracks: queue,
                current_index: currentIndex,
                current_time_sec: currentTime,
                repeat_mode: repeatMode,
                is_shuffle: isShuffle
            });

            fetch(`${API_BASE}/api/queue`, {
                method: "PUT",
                headers: getQueueHeaders(),
                body,
                keepalive: true // Ensures request completes even after page unload
            }).catch(() => { }); // Ignore errors on unload
        };

        window.addEventListener("beforeunload", handleUnload);
        return () => window.removeEventListener("beforeunload", handleUnload);
    }, [activeProfile, queue, currentIndex, currentTime, repeatMode, isShuffle, API_BASE, getQueueHeaders]);


    // 1. Initialize Audio Instance
    useEffect(() => {
        const audio = new Audio();
        // 🚀 Fix #1: Set crossOrigin to anonymous for Web Audio API support
        // This allows the AnalyserNode to process the audio data without silence
        audio.crossOrigin = "anonymous";
        audioRef.current = audio;

        // 🚀 Fix #2: Initialize AudioContext and connect once
        const initWebAudio = async () => {
            if (!audioContextRef.current) {
                try {
                    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
                    analyserRef.current = audioContextRef.current.createAnalyser();
                    analyserRef.current.fftSize = 256;

                    sourceRef.current = audioContextRef.current.createMediaElementSource(audio);
                    sourceRef.current.connect(analyserRef.current);
                    analyserRef.current.connect(audioContextRef.current.destination);

                    setAnalyser(analyserRef.current);
                    console.log("[Audio] Web Audio initialized and connected");
                } catch (e) {
                    console.error("[Audio] Web Audio initialization failed:", e);
                }
            }

            if (audioContextRef.current && audioContextRef.current.state === "suspended") {
                await audioContextRef.current.resume();
            }
        };

        // Initialize on first user interaction or mount if already interacted
        // Some browsers block AudioContext until interaction
        window.addEventListener("click", initWebAudio, { once: true });
        window.addEventListener("keydown", initWebAudio, { once: true });

        // Event Listeners
        const onPlay = () => {
            setIsPlaying(true);
            initWebAudio();
        };
        const onPause = () => setIsPlaying(false);
        const onTimeUpdate = () => {
            setCurrentTime(audio.currentTime);
            if (audio.duration) {
                setProgress((audio.currentTime / audio.duration) * 100);
            }
        };
        const onLoadedMetadata = () => {
            setDuration(audio.duration);
        };
        const onEnded = () => {
            console.log("Track ended, moving to next...");
            // Use ref to call latest next function (avoids stale closure)
            nextRef.current();
        };
        const onWaiting = () => setIsLoading(true);
        const onPlaying = () => {
            setIsPlaying(true);
            setIsLoading(false);
            setCurrentTrack(prev => prev ? { ...prev, state: "ready" } : null);
        };
        const onStalled = () => setIsLoading(true);
        const onError = (e: Event) => {
            // Ignore errors during intentional source transitions
            if (isTransitioningRef.current) {
                console.log("[Audio] Ignoring error during transition");
                return;
            }
            const audio = e.target as HTMLAudioElement;
            const errorDetails = {
                code: audio.error?.code,
                message: audio.error?.message,
                src: audio.src,
                networkState: audio.networkState,
                readyState: audio.readyState,
            };

            // Specific detection for format errors (often caused by 500 HTML bodies accidentally loaded as audio)
            if (audio.error?.code === 4 || audio.error?.message?.includes("Format error")) {
                console.error("❌ [Audio] Format Error: The server returned a page or error body instead of audio.", errorDetails);
            } else {
                console.error("❌ [Audio] Playback Error:", e, errorDetails);
            }

            setIsLoading(false);
            setCurrentTrack(prev => prev ? { ...prev, state: "error", error_message: audio.error?.message || "Failed to load audio" } : null);
        };

        audio.addEventListener("play", onPlay);
        audio.addEventListener("pause", onPause);
        audio.addEventListener("timeupdate", onTimeUpdate);
        audio.addEventListener("loadedmetadata", onLoadedMetadata);
        audio.addEventListener("ended", onEnded);
        audio.addEventListener("waiting", onWaiting);
        audio.addEventListener("playing", onPlaying);
        audio.addEventListener("stalled", onStalled);
        audio.addEventListener("error", onError);

        // Initial Volume (will be handled by reactive effect below)
        // audio.volume = volume;

        return () => {
            audio.removeEventListener("play", onPlay);
            audio.removeEventListener("pause", onPause);
            audio.removeEventListener("timeupdate", onTimeUpdate);
            audio.removeEventListener("loadedmetadata", onLoadedMetadata);
            audio.removeEventListener("ended", onEnded);
            audio.removeEventListener("waiting", onWaiting);
            audio.removeEventListener("playing", onPlaying);
            audio.removeEventListener("stalled", onStalled);
            audio.removeEventListener("error", onError);
            audio.pause();
        };
    }, []);

    // 1b. Listen for External Playback (Synchronization)
    useEffect(() => {
        const handleExternalPlayback = (e: any) => {
            if (e.detail?.context !== "streaming") {
                console.log("Streamer: Pausing for external media...");
                if (audioRef.current) {
                    audioRef.current.pause();
                    setIsPlaying(false);
                }
            }
        };

        window.addEventListener("onyx-playback-start", handleExternalPlayback);
        return () => window.removeEventListener("onyx-playback-start", handleExternalPlayback);
    }, []);

    // 🚀 Separate Effect for volume updates to avoid re-initializing audio
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume;
        }
    }, [volume]);

    // 🎹 Keyboard Media Keys Support (MediaSession API)
    useEffect(() => {
        if (!("mediaSession" in navigator)) return;

        // Note: Metadata updates removed to keep browser tab clean as per user request.
        // We still keep the handlers for keyboard control support below.

        // Register action handlers...
        navigator.mediaSession.setActionHandler("play", () => {
            audioRef.current?.play();
        });
        navigator.mediaSession.setActionHandler("pause", () => {
            audioRef.current?.pause();
        });
        navigator.mediaSession.setActionHandler("previoustrack", () => {
            // Use ref to always call latest 'previous' function
            if (currentTime > 3) {
                audioRef.current && (audioRef.current.currentTime = 0);
            } else if (currentIndex > 0 && queue[currentIndex - 1]) {
                // Will be handled by next.current ref
                window.dispatchEvent(new CustomEvent("onyx-media-previous"));
            }
        });
        navigator.mediaSession.setActionHandler("nexttrack", () => {
            // Will be handled by next.current ref
            window.dispatchEvent(new CustomEvent("onyx-media-next"));
        });

        return () => {
            // Cleanup handlers on unmount
            if ("mediaSession" in navigator) {
                navigator.mediaSession.setActionHandler("play", null);
                navigator.mediaSession.setActionHandler("pause", null);
                navigator.mediaSession.setActionHandler("previoustrack", null);
                navigator.mediaSession.setActionHandler("nexttrack", null);
            }
        };
    }, [currentTrack, currentTime, currentIndex, queue]);

    // 2. Playback Actions

    const reportPlay = useCallback(async (track: Track) => {
        try {
            await fetch(`${API_BASE}/api/analytics/report-play`, {
                method: "POST",
                headers: getQueueHeaders(), // 🔒 Use standard headers (includes X-Profile-ID)
                body: JSON.stringify({
                    track_id: typeof track.id === "number" ? track.id : null,
                    youtube_id: track.youtube_id || (typeof track.id === "string" ? track.id : null),
                    title: track.title,
                    artist: track.artist,
                    thumbnail_url: track.thumbnail
                })
            });
        } catch (err: unknown) {
            console.error("Failed to report play", err);
        }
    }, [API_BASE, getQueueHeaders]);

    // Fetch related videos in the background and add to queue
    const isFetchingRelatedRef = useRef(false);
    const lastFetchedTrackRef = useRef<string | number | null>(null);
    // 🚀 CLIENT-SIDE CACHE: Avoid redundant API calls for recently fetched tracks
    const relatedCacheRef = useRef<Map<string, Track[]>>(new Map());
    // 🚀 REQUEST COALESCING: Cancel stale requests on rapid track changes
    const abortControllerRef = useRef<AbortController | null>(null);

    const fetchRelatedTracks = useCallback(async (track: Track, forceRefresh = false) => {
        // Block during queue restore to prevent race conditions (Fix #2)
        if (queuePhase !== "active") return;

        // Only fetch for YouTube tracks
        if (track.source !== "youtube" && !track.youtube_id) return;

        const videoId = track.youtube_id || (typeof track.id === "string" ? track.id : null);
        if (!videoId) return;

        // Prevent duplicate fetches for same track
        if (lastFetchedTrackRef.current === videoId || isFetchingRelatedRef.current) return;

        // 🚀 Check client-side cache first (instant!)
        if (!forceRefresh && relatedCacheRef.current.has(videoId)) {
            console.log(`[Queue] Cache hit for ${videoId}`);
            const cachedTracks = relatedCacheRef.current.get(videoId)!;
            setQueue(prev => {
                const queueIds = new Set(prev.map(t => t.id));
                const newTracks = cachedTracks.filter(t => !queueIds.has(t.id));
                if (newTracks.length > 0) {
                    toast.success(`Added ${newTracks.length} tracks to queue`, { duration: 1500 });
                    return [...prev, ...newTracks];
                }
                return prev;
            });
            return;
        }

        isFetchingRelatedRef.current = true;
        lastFetchedTrackRef.current = videoId;
        setIsQueueLoading(true); // 🚀 Enable skeleton UI

        // 🚀 REQUEST COALESCING: Cancel any in-flight request before starting new one
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        try {
            // 🚀 TWO-PHASE LOADING: Fetch first 5 tracks with high priority
            console.log(`[Queue] Fetching related for ${videoId}...`);
            const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/streaming/youtube/${videoId}/related?limit=25`, {
                signal
            });
            if (!res.ok) return;

            const related = await res.json();
            if (!Array.isArray(related) || related.length === 0) return;

            // Convert to Track format
            const relatedTracks: Track[] = related.map((r: { id: string; title: string; artist?: string; thumbnail?: string; thumbnail_url?: string; duration?: number }) => ensureTrackState({
                id: r.id,
                title: r.title,
                artist: r.artist || "Unknown Artist",
                thumbnail: r.thumbnail_url || r.thumbnail || `https://i.ytimg.com/vi/${r.id}/hqdefault.jpg`,
                duration: r.duration,
                source: "youtube",
                uri: `${import.meta.env.VITE_API_URL || ""}/api/streaming/youtube/${r.id}`,
                youtube_id: r.id
            }));

            // 🚀 Save to client-side cache for instant replay
            relatedCacheRef.current.set(videoId, relatedTracks);

            setQueue(prev => {
                // Filter out existing tracks in queue
                const queueIds = new Set(prev.map(t => t.id));
                const newTracks = relatedTracks.filter(t => !queueIds.has(t.id));
                if (newTracks.length > 0) {
                    return [...prev, ...newTracks];
                }
                return prev;
            });

            // 🚀 PREFETCH first 3 tracks in parallel (not sequential!)
            const API_BASE = import.meta.env.VITE_API_URL || "";
            const prefetchTracks = relatedTracks.slice(0, 3);
            Promise.all(prefetchTracks.map(track =>
                track.youtube_id
                    ? fetch(`${API_BASE}/api/streaming/youtube/${track.youtube_id}/prefetch?priority=2`).catch(() => { })
                    : Promise.resolve()
            ));

            toast.success(`Added ${relatedTracks.length} tracks to queue`, { duration: 1500 });
        } catch (err) {
            // 🚀 AbortError is expected when user skips tracks rapidly - silence it
            if (err instanceof Error && err.name === 'AbortError') {
                console.log('[Queue] Request aborted (track changed)');
                return;
            }
            console.error("Failed to fetch related tracks", err);
        } finally {
            isFetchingRelatedRef.current = false;
            setIsQueueLoading(false); // 🚀 Disable skeleton UI
        }
    }, [queuePhase, activeProfile?.id, API_BASE]);


    // Auto-fetch related when nearing end of song AND queue is nearly empty
    useEffect(() => {
        // Fetch at 5% through song when queue has 5 or fewer tracks left
        // This ensures the queue is always "infinite" like YouTube
        if (progress >= 5 && currentTrack && queue.length - currentIndex <= 5) {
            fetchRelatedTracks(currentTrack);
        }
    }, [progress, currentTrack, queue.length, currentIndex, fetchRelatedTracks]);

    // 🚀 TIME-BASED PREFETCH - Prefetch next songs when current song has < 30s left
    const prefetchTriggeredRef = useRef<string | null>(null);
    useEffect(() => {
        if (!currentTrack || !audioRef.current || isNaN(audioRef.current.duration)) return;

        const duration = audioRef.current.duration;
        const remaining = duration - currentTime;

        // If less than 30s left and we haven't prefetched for this track yet
        if (remaining < 30 && prefetchTriggeredRef.current !== currentTrack.id.toString()) {
            prefetchTriggeredRef.current = currentTrack.id.toString();

            const API_BASE = import.meta.env.VITE_API_URL || "";
            // Prefetch next 2 tracks with High Priority (Prio 2)
            for (let i = 1; i <= 2; i++) {
                const nextIdx = currentIndex + i;
                if (nextIdx < queue.length) {
                    const track = queue[nextIdx];
                    if (track.source === "youtube" && track.youtube_id) {
                        fetch(`${API_BASE}/api/streaming/youtube/${track.youtube_id}/prefetch?priority=2`)
                            .catch(() => { });
                    }
                }
            }
        }
    }, [currentTime, currentTrack, currentIndex, queue]);


    const playTrack = useCallback(async (track: Track, fromQueue = false) => {
        if (!audioRef.current) return;

        // 1. Mark as transitioning to ignore error events during source change
        isTransitioningRef.current = true;

        // 2. Explicitly stop and clear previous state to avoid race conditions
        audioRef.current.pause();
        // Don't call load() on empty src - it triggers an error event
        audioRef.current.src = "";

        // Reset progress immediately for responsive UI
        setCurrentTime(0);
        setProgress(0);
        const stTrack = ensureTrackState(track);
        setCurrentTrack({ ...stTrack, state: "loading" });
        setIsLoading(true);

        try {
            // 2. Resolve URL (Cache or Streaming Proxy)
            const localUrl = await getCachedUrl(stTrack.id);
            const targetUrl = localUrl || stTrack.uri;

            // Guard against empty or origin-only URLs that cause "Empty src" bugs
            if (!targetUrl || targetUrl === "/" || targetUrl === window.location.origin + "/") {
                console.error("❌ [Audio] Aborting: Invalid stream URL detected:", targetUrl);
                setIsLoading(false);
                setCurrentTrack(prev => prev ? { ...prev, state: "error", error_message: "Invalid stream URL" } : null);
                return;
            }

            audioRef.current.src = targetUrl;
            audioRef.current.currentTime = 0;

            // ⚠️ EQ TEMPORARILY DISABLED
            // Web Audio API (EQ) causes complete silence for YouTube streams because:
            // 1. Once audio is connected to MediaElementAudioSource, ALL audio routes through Web Audio
            // 2. YouTube CDN doesn't support CORS, so Web Audio outputs zeroes (silence)
            // 3. This affects even local tracks if YouTube was played first (shared audio element)
            // TODO: Implement separate audio elements or server-side EQ for YouTube support
            // const isLocalTrack = (track.source as string) === "local" || (track.source as string) === "downloaded" || localUrl;
            // if (isLocalTrack) {
            //     connectSource(audioRef.current);
            // }

            // Load new source before playing
            audioRef.current.load();

            // Clear transitioning flag AFTER load is called with valid src
            isTransitioningRef.current = false;

            // 4. Play with auto-resume logic (wait a tick for browser to process the new src)
            await new Promise(resolve => setTimeout(resolve, 50));

            // Dispatch event for synchronization BEFORE play to ensure others pause first
            window.dispatchEvent(new CustomEvent("onyx-playback-start", {
                detail: { context: "streaming" }
            }));

            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => {
                    if (e.name === "AbortError") {
                        // 🚀 Silently ignore AbortError as it's just a promise interruption
                        console.log("[Audio] Playback interrupted by source change");
                    } else if (e.name === "NotSupportedError") {
                        console.error("Source not supported, attempting fresh URL...");
                        setCurrentTrack(prev => prev ? { ...prev, state: "error", error_message: "Playback failed. Try again." } : null);
                    } else {
                        console.warn("Playback failed:", e);
                    }
                });
            }
        } catch (error) {
            console.error("Critical playback error:", error);
            setIsLoading(false);
        }

        // Report play to analytics for auto-caching
        reportPlay(track);

        // Save as last played for Resume feature
        localStorage.setItem("onyx_last_played", JSON.stringify({
            id: track.id,
            title: track.title,
            artist: track.artist,
            album: track.album,
            thumbnail: track.thumbnail,
            duration: track.duration,
            source: track.source,
            uri: track.uri,
            youtube_id: track.youtube_id
        }));

        if (!fromQueue) {
            setQueue([track]);
            setCurrentIndex(0);
            // Reset fetch tracking for new play session
            lastFetchedTrackRef.current = null;

            // 🚀 FIRE-AND-FORGET: Fetch related tracks IMMEDIATELY at click intent
            // This decouples queue loading from playback progress
            fetchRelatedTracks(track);
        }
    }, [reportPlay, getCachedUrl, fetchRelatedTracks]);

    // Play a specific track from queue by clicking it
    const playFromQueue = useCallback((index: number) => {
        if (index < 0 || index >= queue.length) return;

        setCurrentIndex(index);
        playTrack(queue[index], true);

        // 🚀 SEQUENTIAL PREFETCH next 3 tracks (Prio 2: Queue)
        const API_BASE = import.meta.env.VITE_API_URL || "";
        const runPrefetch = async () => {
            for (let i = 1; i <= 3; i++) {
                const prefetchIdx = index + i;
                if (prefetchIdx < queue.length) {
                    const track = queue[prefetchIdx];
                    if (track.source === "youtube" && track.youtube_id) {
                        try {
                            await fetch(`${API_BASE}/api/streaming/youtube/${track.youtube_id}/prefetch?priority=2`);
                            await new Promise(resolve => setTimeout(resolve, 2000));
                        } catch (e) {
                            console.warn("Prefetch failed", e);
                        }
                    }
                }
            }
        };
        runPrefetch();
    }, [queue, playTrack]);


    const playPlaylist = useCallback((tracks: Track[], startIndex = 0) => {
        if (tracks.length === 0) return;
        const normalized = tracks.map(ensureTrackState);
        setQueue(normalized);
        setCurrentIndex(startIndex);
        playTrack(normalized[startIndex], true);
    }, [playTrack]);

    const togglePlay = useCallback(() => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play().catch(e => {
                if (e.name !== "AbortError") console.error("Toggle play failed:", e);
            });
        }
    }, [isPlaying]);

    const next = useCallback(() => {
        if (queue.length === 0) return;

        let nextIndex = currentIndex + 1;

        // Handle Shuffle
        if (isShuffle) {
            nextIndex = Math.floor(Math.random() * queue.length);
        }

        // Handle Bounds
        if (nextIndex >= queue.length) {
            if (repeatMode === "all") {
                nextIndex = 0;
            } else {
                // End of queue - Try to fetch more before stopping
                if (currentTrack) {
                    console.log("Reached end of queue, attempting to fetch more...");
                    fetchRelatedTracks(currentTrack);
                }
                setIsPlaying(false);
                return;
            }
        }

        setCurrentIndex(nextIndex);
        playTrack(queue[nextIndex], true);

        // 🚀 SEQUENTIAL PREFETCH next 3 tracks (Prio 2: Queue)
        const API_BASE = import.meta.env.VITE_API_URL || "";
        const runPrefetch = async () => {
            for (let i = 1; i <= 3; i++) {
                const prefetchIdx = nextIndex + i;
                if (prefetchIdx < queue.length) {
                    const track = queue[prefetchIdx];
                    if (track.source === "youtube" && track.youtube_id) {
                        try {
                            await fetch(`${API_BASE}/api/streaming/youtube/${track.youtube_id}/prefetch?priority=2`);
                            await new Promise(resolve => setTimeout(resolve, 2000));
                        } catch (e) {
                            console.warn("Prefetch failed", e);
                        }
                    }
                }
            }
        };
        runPrefetch();
    }, [queue, currentIndex, isShuffle, repeatMode, playTrack, fetchRelatedTracks, currentTrack]);

    // Keep nextRef updated with latest next function
    useEffect(() => {
        nextRef.current = next;
    }, [next]);

    // 🎹 Listen for media key events (dispatched from MediaSession handlers)
    useEffect(() => {
        const handleMediaNext = () => nextRef.current?.();
        const handleMediaPrevious = () => {
            if (queue.length === 0) return;
            if (currentTime > 3 && audioRef.current) {
                audioRef.current.currentTime = 0;
            } else if (currentIndex > 0) {
                setCurrentIndex(currentIndex - 1);
                playTrack(queue[currentIndex - 1], true);
            }
        };

        window.addEventListener("onyx-media-next", handleMediaNext);
        window.addEventListener("onyx-media-previous", handleMediaPrevious);

        return () => {
            window.removeEventListener("onyx-media-next", handleMediaNext);
            window.removeEventListener("onyx-media-previous", handleMediaPrevious);
        };
    }, [queue, currentIndex, currentTime, playTrack]);

    const seek = useCallback((time: number) => {
        if (!audioRef.current) return;
        audioRef.current.currentTime = time;
        setCurrentTime(time);
    }, []);

    const previous = useCallback(() => {
        if (queue.length === 0) return;

        // If we are more than 3 seconds in, just restart track
        if (currentTime > 3) {
            seek(0);
            return;
        }

        let prevIndex = currentIndex - 1;
        if (prevIndex < 0) {
            prevIndex = repeatMode === "all" ? queue.length - 1 : 0;
        }

        setCurrentIndex(prevIndex);
        playTrack(queue[prevIndex], true);
    }, [queue, currentIndex, currentTime, repeatMode, playTrack, seek]);
    const setVolume = useCallback((val: number) => {
        if (!audioRef.current) return;
        audioRef.current.volume = val;
        setVolumeState(val);
        localStorage.setItem("onyx_volume", val.toString());
    }, []);

    const toggleMute = useCallback(() => {
        if (!audioRef.current) return;
        const newMute = !isMuted;
        audioRef.current.muted = newMute;
        setIsMuted(newMute);
    }, [isMuted]);

    const addToQueue = useCallback((track: Track) => {
        setQueue(prev => [...prev, ensureTrackState(track)]);
        toast.success("Added to queue");
    }, []);

    const removeFromQueue = useCallback((index: number) => {
        setQueue(prev => prev.filter((_, i) => i !== index));
        if (index === currentIndex) {
            next();
        } else if (index < currentIndex) {
            setCurrentIndex(prev => prev - 1);
        }
    }, [currentIndex, next]);

    const clearQueue = useCallback(async () => {
        setQueue([]);
        setCurrentIndex(-1);
        setCurrentTrack(null);
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = "";
            audioRef.current.load();
        }

        // Sync with backend
        try {
            const apiBase = import.meta.env.VITE_API_URL || "";
            await fetch(`${apiBase}/api/queue`, {
                method: "DELETE",
                headers: getQueueHeaders()
            });
        } catch (e) {
            console.error("Failed to clear backend queue", e);
        }
    }, [getQueueHeaders]);

    const toggleShuffle = useCallback(() => setIsShuffle(prev => !prev), []);

    const reorderQueue = useCallback((fromIndex: number, toIndex: number) => {
        setQueue(prev => {
            const newQueue = [...prev];
            const [removed] = newQueue.splice(fromIndex, 1);
            newQueue.splice(toIndex, 0, removed);
            return newQueue;
        });
        // Adjust currentIndex if needed
        if (fromIndex === currentIndex) {
            setCurrentIndex(toIndex);
        } else if (fromIndex < currentIndex && toIndex >= currentIndex) {
            setCurrentIndex(prev => prev - 1);
        } else if (fromIndex > currentIndex && toIndex <= currentIndex) {
            setCurrentIndex(prev => prev + 1);
        }
    }, [currentIndex]);

    const handleSetCrossfadeMs = useCallback((ms: number) => {
        setCrossfadeMs(ms);
        localStorage.setItem("onyx_crossfade", ms.toString());
    }, []);

    const setIsOfflineMode = useCallback((offline: boolean) => {
        setIsOfflineModeState(offline);
        localStorage.setItem("onyx_offline_mode", offline.toString());
    }, []);

    const value: PlaybackContextType = {
        currentTrack,
        queue,
        currentIndex,
        isPlaying,
        progress,
        currentTime,
        duration,
        volume,
        isMuted,
        repeatMode,
        isShuffle,
        isLoading,
        isQueueLoading,
        playTrack,
        playPlaylist,
        playFromQueue,
        addToQueue,
        removeFromQueue,
        reorderQueue,
        clearQueue,
        togglePlay,
        next,
        previous,
        seek,
        setVolume,
        toggleMute,
        setRepeatMode,
        toggleShuffle,
        crossfadeMs,
        setCrossfadeMs: handleSetCrossfadeMs,
        audioRef,
        isOfflineMode,
        setIsOfflineMode,
        analyser
    };

    return <PlaybackContext.Provider value={value}>{children}</PlaybackContext.Provider>;
}

export function usePlayback() {
    const context = useContext(PlaybackContext);
    if (context === undefined) {
        throw new Error("usePlayback must be used within a PlaybackProvider");
    }
    return context;
}
