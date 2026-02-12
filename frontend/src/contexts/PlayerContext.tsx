import { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from 'react';

export interface MediaItem {
    id: string;
    title: string;
    artist?: string;
    src: string;
    thumbnail?: string;
    type: 'audio' | 'video';
    source: 'local' | 'downloaded' | 'stream';
    duration?: number;
}

interface PlayerState {
    currentMedia: MediaItem | null;
    playlist: MediaItem[];
    currentIndex: number;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    isMuted: boolean;
    playbackSpeed: number;
    isMinimized: boolean;
    isPiP: boolean;
}

interface PlayerContextType extends PlayerState {
    // Actions
    play: (media: MediaItem) => void;
    playPlaylist: (items: MediaItem[], startIndex?: number) => void;
    pause: () => void;
    togglePlay: () => void;
    next: () => void;
    previous: () => void;
    seek: (time: number) => void;
    setVolume: (volume: number) => void;
    toggleMute: () => void;
    setPlaybackSpeed: (speed: number) => void;
    close: () => void;
    minimize: () => void;
    maximize: () => void;
    updateTime: (time: number) => void;
    updateDuration: (duration: number) => void;
    // Refs
    audioRef: React.RefObject<HTMLAudioElement>;
    videoRef: React.RefObject<HTMLVideoElement>;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

const PLAYER_STORAGE_KEY = 'onyx_player_state';

export function PlayerProvider({ children }: { children: ReactNode }) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Load saved state from localStorage
    const [state, setState] = useState<PlayerState>(() => {
        try {
            const saved = localStorage.getItem(PLAYER_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Only restore the media info, not playing state
                return {
                    currentMedia: parsed.currentMedia || null,
                    playlist: parsed.playlist || [],
                    currentIndex: parsed.currentIndex ?? -1,
                    isPlaying: false, // Don't auto-play on load
                    currentTime: parsed.currentTime || 0,
                    duration: parsed.duration || 0,
                    volume: parsed.volume ?? 0.8,
                    isMuted: parsed.isMuted ?? false,
                    playbackSpeed: parsed.playbackSpeed ?? 1,
                    isMinimized: true, // Start minimized if restoring
                    isPiP: false,
                };
            }
        } catch (e) {
            console.error('Failed to load player state:', e);
        }
        return {
            currentMedia: null,
            playlist: [],
            currentIndex: -1,
            isPlaying: false,
            currentTime: 0,
            duration: 0,
            volume: 0.8,
            isMuted: false,
            playbackSpeed: 1,
            isMinimized: false,
            isPiP: false,
        };
    });

    // Save state to localStorage when it changes (debounced for time updates)
    useEffect(() => {
        if (!state.currentMedia) {
            localStorage.removeItem(PLAYER_STORAGE_KEY);
            return;
        }

        // Only save non-blob sources (can't restore blob URLs after refresh)
        if (state.currentMedia.src.startsWith('blob:')) return;

        const toSave = {
            currentMedia: state.currentMedia,
            playlist: state.playlist.filter(p => !p.src.startsWith('blob:')),
            currentIndex: state.currentIndex,
            currentTime: state.currentTime,
            duration: state.duration,
            volume: state.volume,
            isMuted: state.isMuted,
            playbackSpeed: state.playbackSpeed,
        };
        localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(toSave));
    }, [state.currentMedia, state.playlist, state.currentIndex, state.volume, state.isMuted, state.playbackSpeed]);

    const getMediaElement = useCallback(() => {
        if (!state.currentMedia) return null;
        return state.currentMedia.type === 'video' ? videoRef.current : audioRef.current;
    }, [state.currentMedia]);

    const play = useCallback((media: MediaItem) => {
        setState(prev => ({
            ...prev,
            currentMedia: media,
            isPlaying: true,
            currentTime: 0,
            isMinimized: false,
        }));
    }, []);

    // Effect to handle actual playback when state changes
    useEffect(() => {
        const el = getMediaElement();
        if (state.isPlaying && el) {
            // Signal others to pause
            window.dispatchEvent(new CustomEvent("onyx-playback-start", {
                detail: { context: "downloads" }
            }));

            el.play().catch(error => {
                console.warn('Playback failed:', error);
            });
        } else if (!state.isPlaying && el) {
            el.pause();
        }
    }, [state.currentMedia, state.isPlaying, getMediaElement]);

    // 🚀 Dynamic Tab Title Update
    useEffect(() => {
        if (state.currentMedia && state.isPlaying) {
            document.title = `▶ ${state.currentMedia.title} - Onyx`;
        } else if (state.currentMedia) {
            document.title = `II ${state.currentMedia.title} - Onyx`;
        } else {
            document.title = "Onyx - Download YouTube Videos";
        }
    }, [state.currentMedia, state.isPlaying]);

    // Listen for External Playback (Synchronization)
    useEffect(() => {
        const handleExternalPlayback = (e: any) => {
            if (e.detail?.context !== "downloads") {
                console.log("Downloads: Pausing for external media...");
                const el = getMediaElement();
                if (el) {
                    el.pause();
                }
                setState(prev => ({ ...prev, isPlaying: false }));
            }
        };

        window.addEventListener("onyx-playback-start", handleExternalPlayback);
        return () => window.removeEventListener("onyx-playback-start", handleExternalPlayback);
    }, [getMediaElement]);

    const playPlaylist = useCallback((items: MediaItem[], startIndex = 0) => {
        if (items.length === 0) return;
        const index = Math.max(0, Math.min(startIndex, items.length - 1));
        setState(prev => ({
            ...prev,
            playlist: items,
            currentIndex: index,
            currentMedia: items[index],
            isPlaying: true,
            currentTime: 0,
            isMinimized: false,
        }));
    }, []);

    const next = useCallback(() => {
        setState(prev => {
            if (prev.playlist.length === 0) return prev;
            const nextIndex = (prev.currentIndex + 1) % prev.playlist.length;
            return {
                ...prev,
                currentIndex: nextIndex,
                currentMedia: prev.playlist[nextIndex],
                isPlaying: true,
                currentTime: 0,
            };
        });
    }, []);

    const previous = useCallback(() => {
        setState(prev => {
            if (prev.playlist.length === 0) return prev;
            const prevIndex = prev.currentIndex <= 0 ? prev.playlist.length - 1 : prev.currentIndex - 1;
            return {
                ...prev,
                currentIndex: prevIndex,
                currentMedia: prev.playlist[prevIndex],
                isPlaying: true,
                currentTime: 0,
            };
        });
    }, []);

    const pause = useCallback(() => {
        const el = getMediaElement();
        el?.pause();
        setState(prev => ({ ...prev, isPlaying: false }));
    }, [getMediaElement]);

    const togglePlay = useCallback(() => {
        const el = getMediaElement();
        if (!el) return;

        if (state.isPlaying) {
            el.pause();
            setState(prev => ({ ...prev, isPlaying: false }));
        } else {
            el.play().catch(() => { });
            setState(prev => ({ ...prev, isPlaying: true }));
        }
    }, [getMediaElement, state.isPlaying]);

    const seek = useCallback((time: number) => {
        const el = getMediaElement();
        if (el) {
            el.currentTime = time;
            setState(prev => ({ ...prev, currentTime: time }));
        }
    }, [getMediaElement]);

    const setVolume = useCallback((volume: number) => {
        const el = getMediaElement();
        if (el) {
            el.volume = volume;
        }
        setState(prev => ({ ...prev, volume, isMuted: false }));
    }, [getMediaElement]);

    const toggleMute = useCallback(() => {
        const el = getMediaElement();
        if (el) {
            el.muted = !state.isMuted;
        }
        setState(prev => ({ ...prev, isMuted: !prev.isMuted }));
    }, [getMediaElement, state.isMuted]);

    const setPlaybackSpeed = useCallback((speed: number) => {
        const el = getMediaElement();
        if (el) {
            el.playbackRate = speed;
        }
        setState(prev => ({ ...prev, playbackSpeed: speed }));
    }, [getMediaElement]);

    const close = useCallback(() => {
        const el = getMediaElement();
        el?.pause();
        setState(prev => ({
            ...prev,
            currentMedia: null,
            isPlaying: false,
            currentTime: 0,
            isMinimized: false,
        }));
    }, [getMediaElement]);

    const minimize = useCallback(() => {
        setState(prev => ({ ...prev, isMinimized: true }));
    }, []);

    const maximize = useCallback(() => {
        setState(prev => ({ ...prev, isMinimized: false }));
    }, []);

    // Direct state updaters for video element in FloatingPlayer
    const updateTime = useCallback((time: number) => {
        setState(prev => ({ ...prev, currentTime: time }));
    }, []);

    const updateDuration = useCallback((duration: number) => {
        setState(prev => ({ ...prev, duration }));
    }, []);

    // Update time from media element
    const handleTimeUpdate = useCallback((e: React.SyntheticEvent<HTMLAudioElement>) => {
        const el = e.currentTarget;
        setState(prev => ({ ...prev, currentTime: el.currentTime }));
    }, []);

    const handleLoadedMetadata = useCallback((e: React.SyntheticEvent<HTMLAudioElement>) => {
        const el = e.currentTarget;
        setState(prev => ({ ...prev, duration: el.duration }));
    }, []);

    const handleEnded = useCallback(() => {
        setState(prev => ({ ...prev, isPlaying: false }));
    }, []);


    return (
        <PlayerContext.Provider
            value={{
                ...state,
                play,
                playPlaylist,
                pause,
                togglePlay,
                next,
                previous,
                seek,
                setVolume,
                toggleMute,
                setPlaybackSpeed,
                close,
                minimize,
                maximize,
                updateTime,
                updateDuration,
                audioRef,
                videoRef,
            }}

        >
            {children}
            {/* Hidden audio element for audio playback */}
            <audio
                ref={audioRef}
                crossOrigin="anonymous"
                src={state.currentMedia?.type === 'audio' ? state.currentMedia.src : undefined}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleEnded}
                style={{ display: 'none' }}
            />
        </PlayerContext.Provider>
    );
}

export function usePlayer() {
    const context = useContext(PlayerContext);
    if (!context) {
        throw new Error('usePlayer must be used within a PlayerProvider');
    }
    return context;
}
