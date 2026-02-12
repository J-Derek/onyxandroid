/**
 * Onyx - Audio Output Device Selection Hook
 * 
 * Pure infrastructure hook for selecting audio output devices.
 * Uses the Web Audio Output Routing API (setSinkId).
 * 
 * This hook is intentionally context-free - it does NOT depend on:
 * - AuthContext
 * - PlaybackContext
 * - PartyPlaybackContext
 */
import { useState, useEffect, useCallback, RefObject } from "react";

const STORAGE_KEY = "onyx_output_device";

export interface UseAudioOutputDeviceReturn {
    /** List of available audio output devices */
    availableDevices: MediaDeviceInfo[];
    /** Currently selected device ID (empty string = default) */
    selectedDeviceId: string;
    /** Whether the browser supports setSinkId */
    isSupported: boolean;
    /** Whether we have permission to see device labels */
    hasPermission: boolean;
    /** Change the output device */
    setOutputDevice: (deviceId: string) => Promise<void>;
    /** Refresh the device list */
    refreshDevices: () => Promise<void>;
    /** Request permission to see device names */
    requestPermission: () => Promise<boolean>;
}

/**
 * Hook for managing audio output device selection.
 * 
 * @param audioRef - Reference to the HTMLAudioElement to control
 * @returns Device selection state and controls
 */
export function useAudioOutputDevice(
    audioRef: RefObject<HTMLAudioElement | null>
): UseAudioOutputDeviceReturn {
    const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
    const [isSupported, setIsSupported] = useState<boolean>(false);
    const [hasPermission, setHasPermission] = useState<boolean>(false);

    // Check for browser support on mount
    useEffect(() => {
        const supported = "setSinkId" in HTMLMediaElement.prototype;
        setIsSupported(supported);

        if (!supported) {
            console.warn("[AudioOutput] setSinkId not supported in this browser");
        }
    }, []);

    // Fetch available audio output devices
    const refreshDevices = useCallback(async () => {
        if (!isSupported) return;

        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioOutputs = devices.filter(d => d.kind === "audiooutput");
            setAvailableDevices(audioOutputs);

            // Check if we have labeled devices (indicates permission granted)
            const hasLabels = audioOutputs.some(d => d.label && d.label.trim() !== "");
            setHasPermission(hasLabels);

            // Check if stored device is still available
            const storedId = localStorage.getItem(STORAGE_KEY) || "";
            if (storedId && !audioOutputs.find(d => d.deviceId === storedId)) {
                // Device no longer available - clear selection
                console.warn("[AudioOutput] Saved device no longer available, falling back to default");
                localStorage.removeItem(STORAGE_KEY);
                setSelectedDeviceId("");
            }
        } catch (err) {
            console.error("[AudioOutput] Failed to enumerate devices:", err);
        }
    }, [isSupported]);

    // Request permission to see device labels
    const requestPermission = useCallback(async (): Promise<boolean> => {
        try {
            // Request a temporary audio stream to get permission
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // Immediately stop the stream - we just needed permission
            stream.getTracks().forEach(track => track.stop());
            setHasPermission(true);
            // Refresh devices to get labels
            await refreshDevices();
            return true;
        } catch (err) {
            console.warn("[AudioOutput] Permission request denied:", err);
            return false;
        }
    }, [refreshDevices]);

    // Apply device selection to audio element
    const applyDeviceToAudio = useCallback(async (deviceId: string) => {
        if (!audioRef.current || !isSupported) return;

        try {
            // TypeScript doesn't know about setSinkId, so we cast
            const audio = audioRef.current as HTMLAudioElement & {
                setSinkId: (sinkId: string) => Promise<void>;
            };

            await audio.setSinkId(deviceId);
            console.log(`[AudioOutput] Set output device to: ${deviceId || "default"}`);
        } catch (err: any) {
            if (err.name === "NotFoundError") {
                console.warn("[AudioOutput] Device not found, falling back to default");
                localStorage.removeItem(STORAGE_KEY);
                setSelectedDeviceId("");
            } else if (err.name === "NotAllowedError") {
                console.warn("[AudioOutput] Permission denied for device selection");
            } else {
                console.error("[AudioOutput] Failed to set output device:", err);
            }
        }
    }, [audioRef, isSupported]);

    // Set a new output device
    const setOutputDevice = useCallback(async (deviceId: string) => {
        if (!isSupported) return;

        await applyDeviceToAudio(deviceId);
        setSelectedDeviceId(deviceId);

        // Persist selection
        if (deviceId) {
            localStorage.setItem(STORAGE_KEY, deviceId);
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    }, [isSupported, applyDeviceToAudio]);

    // Initialize on mount
    useEffect(() => {
        if (!isSupported) return;

        // Load stored preference
        const storedId = localStorage.getItem(STORAGE_KEY) || "";
        setSelectedDeviceId(storedId);

        // Fetch device list
        refreshDevices();

        // Listen for device changes (connect/disconnect)
        const handleDeviceChange = () => {
            refreshDevices();
        };
        navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);

        return () => {
            navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
        };
    }, [isSupported, refreshDevices]);

    // Apply device when audioRef changes or selection changes
    useEffect(() => {
        if (!isSupported || !audioRef.current) return;
        applyDeviceToAudio(selectedDeviceId);
    }, [audioRef.current, selectedDeviceId, isSupported, applyDeviceToAudio]);

    return {
        availableDevices,
        selectedDeviceId,
        isSupported,
        hasPermission,
        setOutputDevice,
        refreshDevices,
        requestPermission,
    };
}
