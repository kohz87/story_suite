// Parsing place names for parent relationships and formatting place lines.

import { keyOf } from '../domain.js';

// The name as the atlas keeps it: trimmed, inner spaces once.
const tidy = value => String(value ?? '').trim().replace(/\s+/g, ' ');
// Words that join a spot to a town ("Pale Market in Auvoth").
const JOINER = /^(in|at|of)$/i;
// Words that only say what a place is ("(settlement)", "(village, region)"): a bracket of them describes the place, it names no parent.
const KIND_WORD = /^(?:settlement|village|town|city|hamlet|district|region|ward|quarter|area|outskirts|province|county|realm|capital|farm|homestead|camp|outpost)$/i;

/**
 * The parent of a place name, or null. `world`: worldOf's `{ places, find }` (`find` takes a name, an alias or an id).
 * Rules, the first that gives a parent wins: "X / Y", "X (Y)", "Y in|at|of X" (X must resolve), and a name that starts with a known
 * place name and a space (the longest whole-word prefix; an alias works). In "X / Y" and "X (Y)" the first part is the parent, unless
 * only the second resolves ("Guild Office / Bluewatch Village", "Lime-Shed (Salt-and-Ash Yard)"): then the second is; a parent no part
 * resolves to is made from the first. A bracket with a comma or only kind words ("(settlement, Bluewatch)") describes the place and
 * is left out; the in- and prefix rules read the name without it. A known place with no parent of its own
 * (a name `find` answers to, without a `parent` field) is not split by the prefix rule, so "Bluewatch Village" stays whole.
 * Returns `{ text, part, parent, rule }`: `text` the parent's name (the world's when it resolves, else as written), `part` the
 * child's own part, `parent` the resolved place or null, `rule` 'slash' | 'paren' | 'in' | 'prefix'.
 */
export function parentOf(name, world) {
    const full = tidy(name);
    if (!keyOf(full) || typeof world?.find !== 'function') return null;
    const paren = full.match(/^(.+?)\s*\(([^()]+)\)$/);
    const note = Boolean(paren) && (paren[2].includes(',') || paren[2].trim().split(/\s+/).every(word => KIND_WORD.test(word)));
    const text = note ? tidy(paren[1]) : full;
    const words = text.split(' ');
    const self = world.find(full) ?? world.find(text);
    // Each candidate: the parent's text and place (null when it does not resolve), the child's part, the rule, and whether the parent must resolve.
    const candidates = [];
    const pair = (outer, inner, rule) => {
        const first = world.find(outer) ?? null;
        const second = world.find(inner) ?? null;
        const swap = !first && second;
        candidates.push({ parentText: swap ? inner : outer, part: swap ? outer : inner, parent: swap ? second : first, rule, mustResolve: false });
    };
    const slash = text.match(/^(.+?) \/ (.+)$/);
    if (slash) pair(slash[1], slash[2], 'slash');
    if (paren && !note) pair(paren[1], paren[2], 'paren');
    for (let at = 1; at < words.length - 1; at++) {
        if (!JOINER.test(words[at])) continue;
        const parentText = words.slice(at + 1).join(' ');
        candidates.push({ parentText, part: words.slice(0, at).join(' '), parent: world.find(parentText) ?? null, rule: 'in', mustResolve: true });
    }
    if (!(self && !self.parent)) {
        for (let count = words.length - 1; count >= 1; count--) {
            const parentText = words.slice(0, count).join(' ');
            candidates.push({ parentText, part: words.slice(count).join(' '), parent: world.find(parentText) ?? null, rule: 'prefix', mustResolve: true });
        }
    }
    for (const candidate of candidates) {
        if (candidate.mustResolve && !candidate.parent) continue;
        if (!keyOf(candidate.parentText) || !keyOf(candidate.part) || keyOf(candidate.parentText) === keyOf(candidate.part)) continue;
        return { text: candidate.parent?.name ?? tidy(candidate.parentText), part: tidy(candidate.part), parent: candidate.parent, rule: candidate.rule };
    }
    return null;
}

/**
 * The place line "Town · Spot": the parent's name, then the child's own part ("Auvoth · Southern Gatehouse"). The town alone when the
 * place has no parent ("Auvoth"). `place`: `{ name, parent? }` (a saved `parent` id wins over the name's); `world`: as for parentOf.
 */
export function placeLine(place, world) {
    const name = tidy(place?.name);
    const found = parentOf(name, world);
    const saved = place?.parent && typeof world?.find === 'function' ? world.find(place.parent) : null;
    if (saved && saved.id !== place.id) return `${saved.name} · ${found?.parent?.id === saved.id ? found.part : name}`;
    return found ? `${found.text} · ${found.part}` : name;
}
