import { useEffect } from "react";
import { usePlayback } from "@/contexts/PlaybackContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { getDominantColor } from "@/lib/color-extractor";

export function DynamicThemeHandler() {
    const { currentTrack } = usePlayback();
    const { currentMedia } = usePlayer();

    const activeThumbnail = currentTrack?.thumbnail || currentMedia?.thumbnail;

    useEffect(() => {
        if (!activeThumbnail) {
            // Reset to defaults
            document.documentElement.style.removeProperty("--accent-dynamic");
            document.documentElement.style.removeProperty("--accent-glow-dynamic");
            return;
        }

        const updateTheme = async () => {
            const color = await getDominantColor(activeThumbnail);
            if (color) {
                document.documentElement.style.setProperty("--accent-dynamic", color);
                // Create a glow version with transparency
                const glow = color.replace("rgb", "rgba").replace(")", ", 0.3)");
                document.documentElement.style.setProperty("--accent-glow-dynamic", glow);
            }
        };

        updateTheme();
    }, [activeThumbnail]);

    return null; // This component logic only
}
