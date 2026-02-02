export interface RGB {
    r: number;
    g: number;
    b: number;
}

/**
 * Calculates the relative luminance of a color.
 * Formula: 0.2126 * R + 0.7152 * G + 0.0722 * B
 * where R, G and B are defined as:
 * if sRGB <= 0.03928 then RGB = sRGB/12.92 else RGB = ((sRGB+0.055)/1.055) ^ 2.4
 */
export function getLuminance({ r, g, b }: RGB): number {
    const a = [r, g, b].map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

/**
 * Calculates the contrast ratio between two colors.
 * Formula: (L1 + 0.05) / (L2 + 0.05), where L1 is the lighter luminance.
 */
export function getContrastRatio(rgb1: RGB, rgb2: RGB): number {
    const l1 = getLuminance(rgb1);
    const l2 = getLuminance(rgb2);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/**
 * Parses a CSS color string into RGB.
 * Supports: hex, rgb, rgba.
 */
export function parseColor(color: string): RGB | null {
    if (!color) return null;

    // Handle hex
    if (color.startsWith('#')) {
        const hex = color.slice(1);
        if (hex.length === 3) {
            return {
                r: parseInt(hex[0] + hex[0], 16),
                g: parseInt(hex[1] + hex[1], 16),
                b: parseInt(hex[2] + hex[2], 16),
            };
        }
        if (hex.length === 6) {
            return {
                r: parseInt(hex.slice(0, 2), 16),
                g: parseInt(hex.slice(2, 4), 16),
                b: parseInt(hex.slice(4, 6), 16),
            };
        }
    }

    // Handle rgb/rgba
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
    if (match) {
        return {
            r: parseInt(match[1], 10),
            g: parseInt(match[2], 10),
            b: parseInt(match[3], 10),
        };
    }

    // Named colors or transparent (simple fallback)
    if (color === 'transparent') return { r: 255, g: 255, b: 255 };

    return null;
}

/**
 * Adjusts the text color to meet a target contrast ratio against a background.
 * Prioritizes black or white.
 */
export function adjustColorForContrast(bg: RGB, targetRatio: number): RGB {
    const black = { r: 17, g: 17, b: 17 }; // near-black #111111
    const white = { r: 255, g: 255, b: 255 }; // pure white #FFFFFF

    const contrastWithWhite = getContrastRatio(white, bg);
    const contrastWithBlack = getContrastRatio(black, bg);

    if (contrastWithBlack >= targetRatio) return black;
    if (contrastWithWhite >= targetRatio) return white;

    // If neither black nor white is enough (unlikely for normal backgrounds), return the better one
    return contrastWithBlack > contrastWithWhite ? black : white;
}
