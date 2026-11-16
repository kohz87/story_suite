// Whether and how a cast dossier is given, or told it lost, the pack's picture.

import { portraitFileKnownGone, portraitHasImage } from '../../portrait/portrait-file.js';
import { isObject } from './shared-text.js';

/**
 * Whether a dossier made from the cast may be given the pack's picture now: it came from the cast, holds no portrait of its own
 * (an upload, a generated picture or the pack's own all count as its own) and the reader has not removed one on purpose
 * (`castFrom.portraitRemoved`, set when the reader removes the portrait of a cast dossier). Pure: the pack's answer is asked separately.
 */
export function castPortraitWanted(npc) {
    return isObject(npc) && isObject(npc.castFrom) && Boolean(npc.castFrom.key)
        && npc.castFrom.portraitRemoved !== true && (!portraitHasImage(npc.portrait) || portraitFileKnownGone(npc.portrait));
}

/** The dossier with the pack's portrait record set on it (a new object; the dossier unchanged without a usable record or when it may not be filled). */
export function applyCastPortrait(npc, portrait) {
    if (!castPortraitWanted(npc) || !portraitHasImage(portrait)) return npc;
    return { ...npc, portrait };
}

/** The dossier of a cast person after the reader removed its portrait: the removal is recorded in `castFrom` so the pack's picture is not put back. */
export function markCastPortraitRemoved(npc) {
    if (!isObject(npc) || !isObject(npc.castFrom) || !npc.castFrom.key) return npc;
    return { ...npc, castFrom: { ...npc.castFrom, portraitRemoved: true } };
}
