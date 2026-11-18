// Story Suite v2: is a message edit prose-only (perf PB8, docs/dev/edit-prose-only.md)? The text each message had is
// remembered (`remember`: references, nothing copied) at install and after every head, turn and committed event; at
// MESSAGE_EDITED SillyTavern has already written the new text, so `proseOnly(index)` compares it with what was remembered.
// It is prose-only, so the turn may skip the reconcile, only when all of these hold, by exact equality: the index is a whole
// message of the chat, the message and its swipe and the chat's length are the ones remembered, the message is a carrier
// holding a record, and its capture-relevant text is the same (the block region from the first `<Changes` or hidden-comment
// marker to the end, the stray change lines in the story, and no v1 envelope either side) and the edit adds or removes no word a capture reads (edit-words.js: a day or month name, a cast name or alias, a "#N"). Anything else: null (the full path).

import { readRecord } from '../persist.js';
import { strayLines } from '../capture.js';
import { touchesCaptureWords } from './edit-words.js';

// (the cut payloadText makes: the reply up to its <Changes> block, or the hidden comment that holds it once read)
const MARKER = /<Changes\b|<!--\s*STORY_SUITE_V2\b/i;
const blockRegion = text => {
    const at = text.search(MARKER);
    return at < 0 ? '' : text.slice(at).trimEnd();
};
const strayKey = (text, heads) => {
    const { taken, problems } = strayLines(text, heads);
    return JSON.stringify([taken.map(each => each.line), problems.map(each => each.line)]);
};

/** `createProseEdits({ ctx, isCarrier, changeHeads, names = () => null })` → { remember(), proseOnly(index) → the message index when prose-only, else null }. */
export function createProseEdits({ ctx, isCarrier, changeHeads, names = () => null }) {
    let seen = { arr: null, length: -1, texts: new WeakMap() };

    function remember() {
        const arr = ctx?.chat;
        if (!Array.isArray(arr)) { seen = { arr: null, length: -1, texts: new WeakMap() }; return; }
        const texts = new WeakMap();
        for (const message of arr) if (message && typeof message === 'object') texts.set(message, { mes: message.mes, swipe: message.swipe_id });
        seen = { arr, length: arr.length, texts };
    }

    function proseOnly(index) {
        const arr = ctx?.chat;
        const at = typeof index === 'string' && index.trim() !== '' ? Number(index) : index;
        if (!Array.isArray(arr) || !Number.isInteger(at) || at < 0 || at >= arr.length) return null;
        if (seen.arr !== arr || seen.length !== arr.length) return null;
        const message = arr[at];
        const was = message && typeof message === 'object' ? seen.texts.get(message) : undefined;
        if (!was || was.swipe !== message.swipe_id || typeof was.mes !== 'string' || typeof message.mes !== 'string') return null;
        if (!isCarrier(message) || !readRecord(message)) return null;
        const before = was.mes, after = message.mes;
        if (blockRegion(before) !== blockRegion(after)) return null;
        if (touchesCaptureWords(before, after, names)) return null;
        const heads = changeHeads();
        return strayKey(before, heads) === strayKey(after, heads) ? at : null;
    }

    return { remember, proseOnly };
}
