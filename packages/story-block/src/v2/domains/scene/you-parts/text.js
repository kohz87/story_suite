// Reading a `~ you` line: a part of the look as stored text, and the parts a line gives. Pure.

import { lineBody } from '../../../../../../../core/capture.js';
import { cutPoints, flatten } from '../../../extras.js';
import { YOU_CHARS } from '../constants.js';
import { HAS_WORD } from '../shared.js';

// A part of {{user}}'s look as stored: plain words on one line (markdown, tags and invisible characters gone), cut by code
// points; '' (which clears the part) when it holds no word.
export function youText(raw) {
    const text = flatten(lineBody(`~ you ${raw ?? ''}`).replace(/<[^>]*>?/g, ' ').replace(/[<>]/g, ' '));
    return HAS_WORD.test(text) ? cutPoints(text, YOU_CHARS) : '';
}

// The words a change line may call each part.
const YOU_LABELS = Object.freeze({ rank: 'rank', standing: 'rank', wearing: 'wearing', wear: 'wearing', wears: 'wearing', worn: 'wearing', outfit: 'wearing', clothes: 'wearing', clothing: 'wearing', condition: 'condition', state: 'condition', position: 'position', posture: 'position', pose: 'position' });

/**
 * The parts a `~ you` line gives: `{ rank?, wearing?, condition?, outfit?, look?, position? }` from "rank: … | wearing: … | condition: …" (any of them is fine; a part
 * with no words is '', which clears it). A piece after a `|` with no label of its own goes on the part before it; one with a
 * label that is not a part ("mood: glad") is not used.
 */
export function youParts(raw, { lasting = false } = {}) {
    // With a lasting outfit (gear on, mark `youLook`) `outfit` is its own part and `look` is a part; otherwise `outfit` is what `wearing` is and `look` is not used.
    const labels = lasting ? { ...YOU_LABELS, outfit: 'outfit', look: 'look' } : YOU_LABELS;
    const found = {};
    let last = null;
    for (const piece of lineBody(String(raw ?? '')).split('|')) {
        const named = /^\s*(\p{L}+)\s*:\s*([\s\S]*)$/u.exec(piece);
        const part = named ? labels[named[1].toLowerCase()] : null;
        if (part) {
            found[part] = named[2];
            last = part;
        } else if (named) last = null;   // a label that is not one of the parts: not used, and not part of the one before
        else if (last && piece.trim()) found[last] = `${found[last].trimEnd()}, ${piece.trim()}`;
    }
    for (const part of Object.keys(found)) found[part] = youText(found[part]);
    return found;
}
