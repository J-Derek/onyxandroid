/**
 * Onyx - Audio Output Device Selector Component
 * 
 * Reusable UI component for selecting audio output devices.
 * Works across all three playback modes (Download, Streaming, Party).
 */
import { useState } from "react";
import { Speaker, Check, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface AudioOutputSelectorProps {
    /** List of available audio output devices */
    availableDevices: MediaDeviceInfo[];
    /** Currently selected device ID (empty string = default) */
    selectedDeviceId: string;
    /** Callback when a device is selected */
    onSelectDevice: (deviceId: string) => void;
    /** Whether the browser supports device selection */
    isSupported: boolean;
    /** Whether we have permission to see device labels */
    hasPermission?: boolean;
    /** Optional: Callback to refresh device list */
    onRefreshDevices?: () => void;
    /** Optional: Callback to request permission */
    onRequestPermission?: () => Promise<boolean>;
    /** Optional: Custom class name */
    className?: string;
}

/**
 * Dropdown component for selecting audio output devices.
 * Hidden entirely if browser doesn't support setSinkId.
 */
export function AudioOutputSelector({
    availableDevices,
    selectedDeviceId,
    onSelectDevice,
    isSupported,
    hasPermission = false,
    onRefreshDevices,
    onRequestPermission,
    className = "",
}: AudioOutputSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isRequesting, setIsRequesting] = useState(false);

    // Don't render anything if not supported
    if (!isSupported) {
        return null;
    }

    // Deduplicate devices by deviceId (keep first occurrence)
    const seenIds = new Set<string>();
    const filteredDevices = availableDevices.filter(d => {
        if (!d.deviceId || seenIds.has(d.deviceId)) {
            return false;
        }
        seenIds.add(d.deviceId);
        return true;
    });

    // Get a readable device name with fallback
    const getDeviceName = (device: MediaDeviceInfo, index: number): string => {
        if (device.label && device.label.trim()) {
            return device.label;
        }
        // Fallback name when label is hidden by browser
        return `Speaker ${index + 1}`;
    };

    // Get display name for selected device (for tooltip)
    const getSelectedDisplayName = (): string => {
        if (!selectedDeviceId || selectedDeviceId === "default") return "Default";
        const idx = filteredDevices.findIndex(d => d.deviceId === selectedDeviceId);
        if (idx >= 0) {
            return getDeviceName(filteredDevices[idx], idx);
        }
        return "Default";
    };

    const selectedName = getSelectedDisplayName();

    // Check if default is selected
    const isDefaultSelected = !selectedDeviceId ||
        selectedDeviceId === "default" ||
        !filteredDevices.some(d => d.deviceId === selectedDeviceId);

    const handleSelect = (deviceId: string) => {
        onSelectDevice(deviceId);
        setIsOpen(false);
    };

    const handleRequestPermission = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!onRequestPermission) return;

        setIsRequesting(true);
        await onRequestPermission();
        setIsRequesting(false);
    };

    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className={`h-9 w-9 rounded-full hover:bg-white/10 ${className}`}
                    title={`Audio output: ${selectedName}`}
                >
                    <Speaker className="w-4 h-4 text-muted-foreground" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="center"
                side="top"
                sideOffset={8}
                className="w-72 max-h-80 overflow-y-auto z-[200]"
                onClick={(e) => e.stopPropagation()}
            >
                <DropdownMenuLabel className="flex items-center justify-between">
                    <span>Audio Output</span>
                    {onRefreshDevices && hasPermission && (
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                onRefreshDevices();
                            }}
                            className="text-xs text-primary hover:underline"
                        >
                            Refresh
                        </button>
                    )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {/* Default Device Option */}
                <DropdownMenuItem
                    onClick={() => handleSelect("")}
                    className="cursor-pointer flex items-center justify-between"
                >
                    <span>System Default</span>
                    {isDefaultSelected && (
                        <Check className="w-4 h-4 text-primary" />
                    )}
                </DropdownMenuItem>

                {/* Show permission request if we don't have device labels */}
                {!hasPermission && onRequestPermission && (
                    <>
                        <DropdownMenuSeparator />
                        <div className="px-2 py-3">
                            <button
                                onClick={handleRequestPermission}
                                disabled={isRequesting}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors disabled:opacity-50"
                            >
                                <Unlock className="w-4 h-4" />
                                {isRequesting ? "Requesting..." : "Show All Devices"}
                            </button>
                            <p className="text-[10px] text-muted-foreground text-center mt-2">
                                Grant permission to see device names
                            </p>
                        </div>
                    </>
                )}

                {/* Available Devices (only show if we have labels) */}
                {hasPermission && filteredDevices.length > 0 && (
                    <>
                        <DropdownMenuSeparator />
                        {filteredDevices.map((device, index) => (
                            <DropdownMenuItem
                                key={device.deviceId}
                                onClick={() => handleSelect(device.deviceId)}
                                className="cursor-pointer flex items-center justify-between"
                            >
                                <span className="truncate mr-2">
                                    {getDeviceName(device, index)}
                                </span>
                                {!isDefaultSelected && selectedDeviceId === device.deviceId && (
                                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                                )}
                            </DropdownMenuItem>
                        ))}
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
