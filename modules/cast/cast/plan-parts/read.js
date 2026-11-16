// Story Director v2, part **cast**: parsing and validating the cast planner's reply lines.

import { MAX_DOING, MAX_PLACE, MAX_REASON, cutWords } from '../domain.js';
import { citedClean, citedIn, citesKind } from '../sought.js';
import { CAPS } from './limits.js';

export const MAX_ANSWER_CHARS = 8000;
export const MAX_LINES = 60;

const THINK_BLOCK = /<(think|thinking|reasoning)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const THINK_CLOSE = /<\/(?:think|thinking|reasoning)\s*>/gi;
const DECORATION = /^(?:#{1,6}\s+|>\s+(?=[~>!?])|(?:[*•+-]|\d{1,2}[.)])\s+)+/;
const LINE = /^([~>!?])\s*cast\s+(.+)$/i;
const FENCE = /^(?:```|~~~)/;

// A part as one plain line: markup out, a separator the line form reads never survives inside it.
const part = (value, points) => cutWords(String(value ?? '').replace(/<[^>]*>/g, '').replace(/\*\*|__|`/g, '').replace(/\s[|—–]\s/g, ' ').replace(/\|/g, '/'), points);
const refOf = value => String(value ?? '').replace(/^[\s"'`*_[(]+|[\s"'`*_\])]+$/g, '').toLowerCase();

/**
 * The answer read strictly. `refs`: Map of a ref (lower case) → the key of a person who may be named. `allow`: { come: Set of keys,
 * die: Set of keys } (who a `>` or `!` line may name). Returns `{ moves: [{ key, where, doing }], comes: [{ key, reason }], died:
 * [{ key, text }], sought?: [{ key, words }] }` (`sought` only when a `?` line passed): at most CAPS of each, a person once per label, nothing for a ref it does not know.
 */
export function readCast(text, { refs = new Map(), allow = {}, texts = [] } = {}) {
    const out = { moves: [], comes: [], died: [] };
    let clean = String(text ?? '').slice(0, MAX_ANSWER_CHARS).replace(THINK_BLOCK, '');
    const closes = [...clean.matchAll(THINK_CLOSE)];
    if (closes.length) clean = clean.slice(closes.at(-1).index + closes.at(-1)[0].length);
    const seen = { move: new Set(), come: new Set(), die: new Set(), seek: new Set() };
    for (const raw of clean.split(/\r?\n/).slice(0, MAX_LINES)) {
        const trimmed = raw.trim();
        if (!trimmed || FENCE.test(trimmed)) continue;
        const plain = trimmed.replace(DECORATION, '');
        let match = LINE.exec(plain);
        // The 'sought' call carries one kind of line, so `? ref | "words"` (no `cast`) is read the same.
        if (!match && allow.seek && !allow.come && !allow.die) match = /^(\?)\s*(.+\|.+)$/.exec(plain);
        // A 'sought' answer that leaves off the `? cast` (just `ref | "words"`) is read the same: it is the only line that call can carry.
        if (!match && allow.seek && !allow.come && !allow.die) match = /^()(.+\|.+)$/.exec(plain.replace(/^cast\s+/i, ''));
        // One person was offered and the model left the ref off (`? "words"`): the words are checked all the same (cited, and a word of the kind).
        let alone = null;
        if (!match && allow.seek?.size === 1 && !allow.come && !allow.die) { match = /^\?\s*(?:cast\s+)?([^|]+)$/.exec(plain); if (match) { alone = [...allow.seek][0]; match = ['', '?', `${alone}|${match[1]}`]; } }
        if (!match) continue;
        const bits = alone ? [alone, match[2].slice(alone.length + 1).trim()] : match[2].split('|').map(bit => bit.trim());
        const key = alone ?? refs.get(refOf(bits[0]));
        if (!key) continue;
        const label = match[1] || '?';
        if (label === '~') {
            if (seen.move.has(key) || out.moves.length >= CAPS.move) continue;
            // One part is what they do; two are where and what.
            const where = bits.length >= 3 ? part(bits[1], MAX_PLACE) : '';
            const doing = part(bits.length >= 3 ? bits.slice(2).join(' / ') : bits[1], MAX_DOING);
            if (!where && !doing) continue;
            seen.move.add(key);
            out.moves.push({ key, where, doing });
        } else if (label === '>') {
            if (!allow.come?.has(key) || seen.come.has(key) || out.comes.length >= CAPS.come) continue;
            const reason = part(bits.slice(1).join(' / '), MAX_REASON - 60);
            if (!reason) continue;
            seen.come.add(key);
            out.comes.push({ key, reason: /[.!?…]$/.test(reason) ? reason : `${reason}.` });
        } else if (label === '?') {
            // A request the planner says it read: its words must stand in the message or the reply (whole words), else it is refused.
            const cited = citedClean(bits.slice(1).join(' / '));
            if (!allow.seek?.has(key) || seen.seek.has(key) || (out.sought?.length ?? 0) >= CAPS.seek || !citedIn(cited, texts) || (allow.kind?.has(key) && !citesKind(allow.kind.get(key), cited))) continue;
            seen.seek.add(key);
            (out.sought ??= []).push({ key, words: cited });
        } else {
            if (!allow.die?.has(key) || seen.die.has(key) || out.died.length >= CAPS.die) continue;
            seen.die.add(key);
            out.died.push({ key, text: part(bits.slice(1).join(' / '), MAX_DOING) });
        }
    }
    return out;
}
