// Small settings values: the injection depth clamp.

// The dossier's depth: 0 to 20, 0 kept (it is the default since 1.2.16).
export function injectDepthOf(settings) {
    const depth = Math.round(Number(settings?.injectDepth));
    return Number.isFinite(depth) ? Math.max(0, Math.min(20, depth)) : 0;
}
