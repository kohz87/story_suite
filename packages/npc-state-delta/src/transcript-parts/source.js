// The host's chat context and Scan context readers, wired once by index.js, and the names that are never NPCs.
export let readContext = () => ({ chat: [] });
export let readScanDepth = () => 6;
export function useTranscriptSource({ context, scanDepth }) {
    if (typeof context === 'function') readContext = context;
    if (typeof scanDepth === 'function') readScanDepth = scanDepth;
}


export function currentExclusions() {
    const ctx = readContext();
    return [ctx.name1, ctx.name2].filter(Boolean);
}
