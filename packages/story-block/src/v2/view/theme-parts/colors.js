// Story Suite v2: reading a CSS colour and its luminance.

const NAMED = Object.freeze({ black: [0, 0, 0, 1], white: [255, 255, 255, 1], transparent: [0, 0, 0, 0] });
const clampByte = n => Math.min(255, Math.max(0, n));
const clampUnit = n => Math.min(1, Math.max(0, n));
/**
 * A CSS colour as { r, g, b, a } (0–255, alpha 0–1), or null when it is not one this reads: #rgb, #rgba,
 * #rrggbb, #rrggbbaa, rgb()/rgba() with commas or spaces (numbers or percentages, alpha after a comma or
 * a slash), black, white, transparent. Enough for SillyTavern's theme variables, which it writes as rgba().
 */
export function parseColor(value) {
    const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!text) return null;
    if (Object.hasOwn(NAMED, text)) {
        const [r, g, b, a] = NAMED[text];
        return { r, g, b, a };
    }
    const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(text);
    if (hex) {
        let digits = hex[1];
        if (digits.length <= 4) digits = [...digits].map(d => d + d).join('');
        const byte = i => parseInt(digits.slice(i, i + 2), 16);
        return { r: byte(0), g: byte(2), b: byte(4), a: digits.length === 8 ? Math.round((byte(6) / 255) * 1000) / 1000 : 1 };
    }
    const fn = /^rgba?\(\s*([^)]*)\)$/.exec(text);
    if (!fn) return null;
    const [channels, alphaPart] = fn[1].includes('/') ? fn[1].split('/') : [fn[1], null];
    const parts = channels.split(/[\s,]+/).filter(Boolean);
    let alpha = alphaPart;
    if (alpha === null && parts.length === 4) alpha = parts.pop();
    if (parts.length !== 3) return null;
    const channel = part => {
        const m = /^(-?\d*\.?\d+)(%?)$/.exec(part);
        if (!m) return null;
        return clampByte(m[2] ? (Number(m[1]) / 100) * 255 : Number(m[1]));
    };
    const [r, g, b] = parts.map(channel);
    if ([r, g, b].some(n => n === null || Number.isNaN(n))) return null;
    let a = 1;
    if (alpha !== null) {
        const m = /^\s*(-?\d*\.?\d+)(%?)\s*$/.exec(alpha);
        if (!m) return null;
        a = clampUnit(m[2] ? Number(m[1]) / 100 : Number(m[1]));
    }
    return { r, g, b, a };
}

/** WCAG relative luminance of a colour (0 black … 1 white), alpha ignored. */
export function luminance(color) {
    const lin = c => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(color.r) + 0.7152 * lin(color.g) + 0.0722 * lin(color.b);
}
