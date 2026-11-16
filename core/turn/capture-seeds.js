// Story Suite v2: the seeds and occurrences a Re-read hands back to the lines it runs again, moved out of createCaptureFlow unchanged: the mark of a change
// line, the story receipts' seeds by kind and mark, the afterCapture steps' seeds by type, and the occurrence a block of a Re-read takes.
import { operationKey } from '../evidence.js';
import { hash } from '../persist.js';
import { CAPTURE_PREFIX } from '../registry.js';

// The occurrence a block of a Re-read that does `type` with `payload` takes (evidence.js reusePlan): the number of a block it replaces, else the next unused.
export function occurrenceFor(plan, type, payload) {
    try {
        const key = operationKey(type, payload);
        return { key, value: plan.reuse.peek(key), span: plan.reuse.span(key) };
    } catch { return { key: null, value: undefined }; }
}

// For a Re-read: each afterCapture step run again gets the seed of the old one of its type, in order.
export function stepSeeds(record) {
    const stored = (Array.isArray(record?.receipts) ? record.receipts : [])
        .filter(receipt => receipt?.cause === 'system' && receipt.afterCapture === true && Number.isInteger(receipt.seed));
    const used = new Set();
    return type => {
        const at = stored.findIndex((receipt, n) => !used.has(n) && receipt.type === type);
        if (at < 0) return undefined;
        used.add(at);
        return stored[at].seed;
    };
}

// A change line's mark: a hash of its text without spaces (hiding the block breaks up "--" with one).
export const lineMark = raw => hash(String(raw ?? '').replace(/\s+/g, ''));

// For a Re-read (r2-3): each line run again gets the seed of the story receipt it made before, so the
// records it makes keep their IDs and the reader's later actions on them still fit. The reply's story
// receipts are taken in order, a line matching the next one of its kind made by the same line text
// (`line`, lineMark); a line that made none before (it failed, was changed, or is new) gets a fresh
// seed. → (kind, mark) => seed | undefined.
export function storySeeds(record) {
    const stored = (Array.isArray(record?.receipts) ? record.receipts : [])
        .filter(receipt => receipt?.cause === 'story' && typeof receipt.line === 'string' && Number.isInteger(receipt.seed));
    let next = 0;
    return (kind, mark) => {
        const at = stored.findIndex((receipt, n) => n >= next && receipt.type === `${CAPTURE_PREFIX}${kind}` && receipt.line === mark);
        if (at < 0) return undefined;
        next = at + 1;
        return stored[at].seed;
    };
}
