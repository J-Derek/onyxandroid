import React, { useEffect, useRef } from "react";
import { usePlayback } from "@/contexts/PlaybackContext";

interface AudioVisualizerProps {
    className?: string;
    barColor?: string;
    barCount?: number;
}

export function AudioVisualizer({
    className = "",
    barColor = "var(--accent-dynamic, #06b6d4)",
    barCount = 64
}: AudioVisualizerProps) {
    const { isPlaying, analyser } = usePlayback();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>();

    useEffect(() => {
        if (!analyser || !isPlaying) {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            return;
        }

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        // Resolve CSS variable to actual color value
        const resolveColor = (color: string): string => {
            if (color.startsWith("var(")) {
                const computed = getComputedStyle(document.documentElement).getPropertyValue("--accent-dynamic").trim();
                return computed || "#06b6d4"; // Fallback to cyan
            }
            return color;
        };

        const render = () => {
            if (!analyser) return;

            analyser.getByteFrequencyData(dataArray);

            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const width = canvas.width;
            const height = canvas.height;
            const barWidth = (width / barCount) * 1.5;
            let x = 0;

            const resolvedColor = resolveColor(barColor);

            for (let i = 0; i < barCount; i++) {
                const barHeight = (dataArray[i] / 255) * height;

                // Gradient bar
                const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
                gradient.addColorStop(0, resolvedColor);
                gradient.addColorStop(1, "rgba(255, 255, 255, 0.2)");

                ctx.fillStyle = gradient;
                ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);

                x += barWidth;
            }

            animationRef.current = requestAnimationFrame(render);
        };

        render();

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [isPlaying, analyser, barColor, barCount]);

    return (
        <canvas
            ref={canvasRef}
            className={className}
            width={300}
            height={100}
            style={{ width: "100%", height: "100%" }}
        />
    );
}
