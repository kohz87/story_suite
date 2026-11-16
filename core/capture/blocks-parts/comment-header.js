// Story Suite v2: the hidden comment's header: whether there is one, the display kinds read while off, and the caps.

import { KIND_WORD } from '../lines.js';
import { replacePairs } from './pairs.js';
import { hiddenPairs } from './marker.js';
import { commentParts } from './comment-parts.js';

/** True when `mes` holds Story Suite's hidden comment (whatever is in it). */
export function hasHidden(mes) {
    return hiddenPairs(String(mes ?? '')).length > 0;
}

/**
 * `mes` with the header of each hidden comment from `from` on saying which display kinds (written words,
 * `words`) were off when its lines were read (`off:choice,chatter`), or nothing when none: displayLines
 * then leaves those lines out (B-a1-5). A Re-read marks every comment of the reply anew.
 */
export function markOff(mes, words, from = 0) {
    const text = String(mes ?? '');
    const list = [...new Set(words ?? [])].map(word => String(word).toLowerCase()).filter(word => KIND_WORD.test(word)).sort();
    const pairs = hiddenPairs(text).filter(pair => pair.start >= from);
    return replacePairs(text, pairs, pair => {
        const body = text.slice(pair.bodyStart, pair.bodyEnd);
        const nl = body.indexOf('\n');
        const words = (nl < 0 ? body : body.slice(0, nl)).trim().split(/\s+/).filter(word => word && !word.startsWith('off:'));
        if (list.length) words.push(`off:${list.join(',')}`);
        return `${text.slice(pair.start, pair.bodyStart)}${words.map(word => ` ${word}`).join('')}${nl < 0 ? '' : body.slice(nl)}${text.slice(pair.bodyEnd, pair.end)}`;
    });
}

/**
 * `mes` with the header of each hidden comment from `from` on saying how many lines of a display kind a reply
 * could show when its lines were read (`cap:chatter=5`), for a kind whose cap is the reader's setting: the same
 * reply shows the same lines whatever the setting is later. `caps`: { [written word]: whole number }; a kind not
 * in it loses its mark (a Re-read marks every comment of the reply anew).
 */
export function markCaps(mes, caps, from = 0) {
    const text = String(mes ?? '');
    const list = Object.entries(caps ?? {}).filter(([word, n]) => KIND_WORD.test(String(word).toLowerCase()) && Number.isInteger(n) && n > 0).map(([word, n]) => `cap:${String(word).toLowerCase()}=${n}`).sort();
    const pairs = hiddenPairs(text).filter(pair => pair.start >= from);
    if (!pairs.length) return text;
    return replacePairs(text, pairs, pair => {
        const body = text.slice(pair.bodyStart, pair.bodyEnd);
        const nl = body.indexOf('\n');
        const words = (nl < 0 ? body : body.slice(0, nl)).trim().split(/\s+/).filter(word => word && !word.startsWith('cap:'));
        words.push(...list);
        return `${text.slice(pair.start, pair.bodyStart)}${words.map(word => ` ${word}`).join('')}${nl < 0 ? '' : body.slice(nl)}${text.slice(pair.bodyEnd, pair.end)}`;
    });
}

/** The caps a reply's hidden comments carry (markCaps): { [kind word]: n }, the largest where comments differ. */
export function capsOf(mes) {
    const text = String(mes ?? '');
    const out = {};
    for (const pair of hiddenPairs(text)) {
        for (const word of commentParts(text, pair).head) {
            const found = /^cap:([a-z][a-z0-9_-]*)=(\d{1,4})$/.exec(word);
            if (found && Number(found[2]) > 0) out[found[1]] = Math.max(out[found[1]] ?? 0, Number(found[2]));
        }
    }
    return out;
}
