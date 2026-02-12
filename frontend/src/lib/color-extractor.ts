/**
 * Extracts the dominant color from an image URL.
 */
export async function getDominantColor(imageUrl: string): Promise<string | null> {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imageUrl;

        img.onload = () => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            if (!ctx) return resolve(null);

            canvas.width = 50; // Downscale for performance
            canvas.height = 50;

            ctx.drawImage(img, 0, 0, 50, 50);

            try {
                const imageData = ctx.getImageData(0, 0, 50, 50).data;
                let r = 0, g = 0, b = 0;
                let count = 0;

                for (let i = 0; i < imageData.length; i += 4) {
                    // Skip transparent or near-black/near-white pixels
                    const ir = imageData[i];
                    const ig = imageData[i + 1];
                    const ib = imageData[i + 2];

                    const brightness = (ir + ig + ib) / 3;
                    if (brightness > 30 && brightness < 230) {
                        r += ir;
                        g += ig;
                        b += ib;
                        count++;
                    }
                }

                if (count === 0) return resolve(null);

                r = Math.floor(r / count);
                g = Math.floor(g / count);
                b = Math.floor(b / count);

                resolve(`rgb(${r}, ${g}, ${b})`);
            } catch (e) {
                console.error("Color extraction failed:", e);
                resolve(null);
            }
        };

        img.onerror = () => resolve(null);
    });
}
