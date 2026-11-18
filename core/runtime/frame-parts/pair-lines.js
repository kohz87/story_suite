// The job: the Problems lines a chat's start gives for its world and game (pack format 4, §4.2): a start date that falls back, a birthday that is
// dropped and a names culture left unused, each in the pairing check's own words. (A world event that never fires is said by the world's daily step.)

const SAID = new Set(['PAIR_START_DATE', 'PAIR_BIRTHDAY', 'PAIR_CULTURE']);

/**
 * `installed`: the store (`packs/installed.js`; its `pair` is the checker's `checkPairing`, there once a pack has been read); `pair`: `{ world, game }` as
 * resolve.js `selectedPair` reads them. → `[{ code, message, quiet: true }]`, none without a world.
 */
export function pairLines(installed, { world, game }) {
    if (!world || typeof installed?.pair !== 'function') return [];
    let out;
    try { out = installed.pair(world, game); } catch { return []; }
    return [...(out?.errors ?? []), ...(out?.warnings ?? [])].filter(entry => SAID.has(entry?.code)).map(entry => ({ code: entry.code, message: String(entry.message), quiet: true }));
}
