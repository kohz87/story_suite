/* NPC State Delta dossier surface: the ring colour of a library face by bond tone. */

// Ring colour per tone. Catalog rows carry `tone` ('ally' | 'rival' | 'owed', from the bond tone of
// their relationship); any other value (or none) is neutral.
export const FACE_RING_VARS = Object.freeze({ ally: 'var(--good)', rival: 'var(--bad)', owed: 'var(--held)' });

export function faceRingVar(tone = '') {
    return Object.hasOwn(FACE_RING_VARS, tone) ? FACE_RING_VARS[tone] : 'var(--dial)';
}
