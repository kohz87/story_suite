// Small settings values: the injection depth clamp and the present-cast display normalizer.

// The dossier's depth: 0 to 20, 0 kept (it is the default since 1.2.16).
export function injectDepthOf(settings) {
    const depth = Math.round(Number(settings?.injectDepth));
    return Number.isFinite(depth) ? Math.max(0, Math.min(20, depth)) : 0;
}

const PRESENT_CAST_DISPLAY_MODES = Object.freeze(['full', 'compact', 'storyblock', 'off']);

export function normalizePresentCastDisplay(value) {
    return PRESENT_CAST_DISPLAY_MODES.includes(value) ? value : 'full';
}
