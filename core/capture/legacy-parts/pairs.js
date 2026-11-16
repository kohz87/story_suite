// Story Suite v2: finding the v1 envelopes in a text and cutting them out.

import { closedPairs, HIDDEN_CLOSE } from '../blocks.js';
import { isSpace } from '../lines.js';

// --- Story Block v1's envelope -----------------------------------------------------------------------
// v1 kept a reply's blocks in `<!-- STORY_BLOCKS_V1 … -->` (also STORY_BLOCKS_V1_CUT, and Inventory Block's
// INVENTORY_BLOCK_V05; src/envelope.js on the `v1` branch). v2 never writes one, but a card greeting or an old reply may hold one,
// and a model that sees it in the history copies it, change lines and all. So it is never sent to the model
// (stripBlock, and turn.js for the prompt), and a reply that wrote its changes only there has them read
// (adoptLegacy). `\b` keeps STORY_BLOCKS_V1_CONTEXT_* out; the cut marker is listed first so it wins.
const LEGACY_OPEN = /<!--\s*(?:STORY_BLOCKS_V1_CUT|STORY_BLOCKS_V1|INVENTORY_BLOCK_V05)\b/gi;
export const HAS_LEGACY = /<!--\s*(?:STORY_BLOCKS_V1|INVENTORY_BLOCK_V05)/i;

// Every v1 envelope of `text`: closed ones, and one left open (the reply was cut off in it) to the end.
export function legacyPairs(text) {
    const pairs = closedPairs(text, LEGACY_OPEN, HIDDEN_CLOSE);
    LEGACY_OPEN.lastIndex = pairs.length ? pairs.at(-1).end : 0;
    const open = LEGACY_OPEN.exec(text);
    if (open) pairs.push({ start: open.index, end: text.length, bodyStart: LEGACY_OPEN.lastIndex, bodyEnd: text.length, open: true });
    return pairs;
}

// `text` with each pair taken out with the whitespace before it (not before `from`), or put back as what `put(pair, i)` gives.
export function cutPairs(text, pairs, from = 0, put = () => '') {
    let out = '';
    let at = 0;
    pairs.forEach((pair, i) => {
        let start = pair.start;
        while (start > Math.max(at, from) && isSpace(text[start - 1])) start -= 1;
        const kept = put(pair, i);
        out += text.slice(at, start) + (kept ? `${start > 0 ? '\n\n' : ''}${kept}` : '');
        at = pair.end;
    });
    return out + text.slice(at);
}
