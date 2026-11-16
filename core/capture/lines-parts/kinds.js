// Story Suite v2: the kind words a module declares and the line heads its grammar writes.

import { escapeRe } from './shared-text.js';

export const KIND_WORD = /^\p{L}[\p{L}\p{N}_-]*$/u;

/**
 * The heads each kind's grammar line writes, from [{ kind, grammar }] (registry.contexts()' kinds):
 * a Set of "op kind" ("! encounter", "+ present", "- present").
 */
export function grammarHeads(kinds) {
    const heads = new Set();
    for (const entry of Array.isArray(kinds) ? kinds : []) {
        const word = String(entry?.kind ?? '').toLowerCase();
        if (!KIND_WORD.test(word)) continue;
        // A kind's own `heads` (registry.contexts()): taken as they are written, for a kind with no grammar line in the prompt.
        for (const head of Array.isArray(entry?.heads) ? entry.heads : []) if (typeof head === 'string' && new RegExp(`^[+\\-~!?] ${escapeRe(word)}$`, 'iu').test(head)) heads.add(head.toLowerCase());
        const re = new RegExp(`(?:^|[\\s(;,])([+\\-~!?]) ${escapeRe(word)}(?![\\p{L}\\p{N}_-])`, 'gu');
        for (const found of String(entry?.grammar ?? '').matchAll(re)) heads.add(`${found[1]} ${word}`);
    }
    return heads;
}
