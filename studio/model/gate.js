// The job: reading and writing a hidden gate through the game's own grammar (packs/validate/world-pack-parts/gate.js), and checking it.
//
// A gate is one string: terms joined by "and" / "or" ("and" binds tighter, no parentheses). Here it is `groups`: a list of "or" groups,
// each a list of "and" terms. A term is { type: 'anchor', kind, id, ref? } | { type: 'place', id } | { type: 'quote', text } |
// { type: 'stage', of?, at } | { type: 'meter', name, of?, at } | { type: 'raw', text } (what no rule reads: kept so nothing is lost).
// Writing a gate back gives the canonical spacing and the "meter <m> of <id> >= n" order; the meaning is the same.

import { ANCHORS, JOIN, TESTS, checkGate } from '../../packs/validate/world-pack-parts/gate.js';
import { buildIndex } from '../../packs/validate/world-pack-parts/index.js';
import { parseEntry } from '../../packs/validate/world-pack-parts/grammar.js';

const JOINS = new RegExp(JOIN.source, 'g');

function parseTerm(text) {
    let match;
    if ((match = TESTS.stage.exec(text))) return { type: 'stage', ...(match[1] ? { of: match[1] } : {}), at: match[2].startsWith('"') ? match[2].slice(1, -1) : Number(match[2]), named: match[2].startsWith('"') };
    if ((match = TESTS.meter.exec(text))) return { type: 'meter', name: match[1], ...(match[2] ? { of: match[2] } : {}), at: Number(match[3]) };
    if ((match = TESTS.meterOf.exec(text))) return { type: 'meter', name: match[1], of: match[3], at: Number(match[2]) };
    if (text.startsWith('place:')) return { type: 'place', id: text.slice(6).trim() };
    if (text.startsWith('quote:')) return { type: 'quote', text: text.slice(6).trim() };
    if (/^(?:stage|meter)\b/.test(text)) return { type: 'raw', text };
    const anchor = parseEntry(text);
    if (anchor.type !== 'anchor' || anchor.error || !ANCHORS.includes(anchor.kind) || anchor.offset) return { type: 'raw', text };
    return { type: 'anchor', kind: anchor.kind, id: anchor.id, ...(anchor.ref !== undefined ? { ref: anchor.ref } : {}) };
}

/** Reads a gate string → `{ ok, groups }`; a term the grammar does not know comes back as `raw` and `ok` is false. */
export function parseGate(text) {
    const raw = typeof text === 'string' ? text.trim() : '';
    if (!raw) return { ok: false, groups: [] };
    const words = [...raw.matchAll(JOINS)].map(found => found[0].trim());
    const groups = [[]];
    raw.split(JOIN).map(part => part.trim()).forEach((part, at) => {
        if (at > 0 && words[at - 1] === 'or') groups.push([]);
        groups.at(-1).push(parseTerm(part));
    });
    return { ok: !groups.flat().some(term => term.type === 'raw'), groups };
}

const termText = term => ({
    anchor: () => `${term.kind}:${term.id}${term.ref !== undefined ? `@${term.ref}` : ''}`,
    place: () => `place:${term.id}`,
    quote: () => `quote:${term.text}`,
    stage: () => `stage${term.of ? ` of ${term.of}` : ''} >= ${term.named ? `"${term.at}"` : term.at}`,
    meter: () => `meter ${term.name}${term.of ? ` of ${term.of}` : ''} >= ${term.at}`,
    raw: () => term.text,
})[term.type]();

/** Writes `groups` back as a gate string ("" when there is nothing to write). */
export function composeGate(groups) {
    return (groups ?? []).filter(group => group.length).map(group => group.map(termText).join(' and ')).join(' or ');
}

/** Checks a gate string with the game's own rules against a pack's `content`; `ownerId` is the cast id a secret belongs to (null for a lore gate).
 *  → `[{ level: 'error' | 'warning', code, message }]`, empty when the game would take the gate. */
export function checkGateText(text, content, ownerId = null) {
    // The pack text names a place by `id` (a format 3 pack by `slug`); the game's index reads `slug`.
    const places = (content?.places ?? []).map(place => ({ ...place, slug: place.slug ?? place.id }));
    const index = buildIndex({ ...content, places, legacyEvents: content?.events ?? [], deferCalendar: true });
    const problems = [];
    const collect = { facts: new Set(), factRefs: new Set(), timed: new Set(), cleared: new Set(), warnings: [] };
    const say = (field, message, code = 'BAD_RECORD') => problems.push({ level: 'error', code, message });
    const owner = ownerId === null ? null : index.person(ownerId);
    if (ownerId !== null && !owner) return [{ level: 'error', code: 'UNKNOWN_REF', message: `"${ownerId}" is not a cast id.` }];
    checkGate(text, { index, collect, placeholders: false, say }, 'gate', owner);
    for (const [, message] of collect.warnings) problems.push({ level: 'warning', code: 'WORLD_WARNING', message });
    return problems;
}
