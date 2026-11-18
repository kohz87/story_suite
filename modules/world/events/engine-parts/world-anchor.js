// World events, anchors and condition references of the pack-author spec §3: one vocabulary for `requires`, a window's
// `after`, `likelier_if`, `pre_empted_by` and `ends_when`. Each parser gives `{ value }` or `{ why }`.
//   set:<condition>  cleared:<condition>  fired:<event>  ended:<event>  lapsed:<event>
//   died:<cast id>   departed:<cast id>   fact:<id>      a season (spring..winter)  start
// plus `stage:<event>` in `requires`, and `<condition>@<ref>` (a condition at a place, route, region or realm).

import { parseDuration } from './world-grammar.js';
import { knows } from './world-refs.js';

const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SEASONS = Object.freeze(['spring', 'summer', 'autumn', 'winter']);
const REF_KINDS = Object.freeze(['places', 'routes', 'regions', 'realms']);
const MAX = 200;

/** `name@ref` → `{ condition, at }`, the condition defined and the ref one of the pack's places, routes, regions or realms. */
export function parseConditionRef(raw, refs) {
    const text = typeof raw === 'string' ? raw.trim() : '';
    const cut = text.indexOf('@');
    const condition = cut < 0 ? text : text.slice(0, cut);
    const at = cut < 0 ? '' : text.slice(cut + 1).trim();
    if (text.length > MAX || !NAME.test(condition) || !at) return { why: `"${text || raw}" is not a condition at a place; write name@ref such as "grain-dear@the Marches".` };
    if (!knows(refs, ['conditions'], condition)) return { why: `the condition "${condition}" is not defined in the pack.` };
    if (!knows(refs, REF_KINDS, at)) return { why: `"${at}" is not a place, route, region or realm of the pack.` };
    return { value: { condition, at } };
}

const WITH_ID = Object.freeze({
    fired: ['events', 'event'], ended: ['events', 'event'], lapsed: ['events', 'event'], died: ['cast', 'cast id'], departed: ['cast', 'cast id'], fact: ['facts', 'fact id'], stage: ['events', 'event'],
});

/** One anchor (`stage:` only when `allowStage`) → its text, every id it names defined in the pack. */
export function parseAnchor(raw, refs, { allowStage = false } = {}) {
    const text = typeof raw === 'string' ? raw.trim() : '';
    if (text === 'start' || SEASONS.includes(text)) return { value: text };
    const cut = text.indexOf(':');
    const head = cut < 0 ? '' : text.slice(0, cut);
    const rest = cut < 0 ? '' : text.slice(cut + 1).trim();
    const bad = why => ({ why: `the anchor "${text || raw}" ${why}` });
    if (text.length > MAX || !head) return bad('is not one of set:, cleared:, fired:, ended:, lapsed:, died:, departed:, fact:, a season or start.');
    if (head === 'set' || head === 'cleared') {
        const [name, at] = rest.split('@');
        if (!NAME.test(name ?? '') || (at !== undefined && !at.trim())) return bad(`needs a condition name (and at most one @ref).`);
        if (!knows(refs, ['conditions'], name)) return bad(`names the condition "${name}", which the pack does not define.`);
        if (at !== undefined && !knows(refs, REF_KINDS, at)) return bad(`names "${at}", which is not a place, route, region or realm of the pack.`);
        return { value: `${head}:${rest}` };
    }
    if (!WITH_ID[head] || (head === 'stage' && !allowStage)) return bad('is not one of set:, cleared:, fired:, ended:, lapsed:, died:, departed:, fact:, a season or start.');
    const [kind, label] = WITH_ID[head];
    if (!rest || (head !== 'died' && head !== 'departed' && !NAME.test(rest))) return bad(`needs a ${label} after the colon.`);
    if (!knows(refs, [kind], rest)) return bad(`names the ${label} "${rest}", which the pack does not define.`);
    return { value: `${head}:${rest}` };
}

/** A window start: an anchor, optionally `+ <duration>` ("died:adalmar + 3 days"). */
export function parseWindowStart(raw, refs) {
    const text = typeof raw === 'string' ? raw.trim() : '';
    const cut = text.lastIndexOf(' + ');
    const anchor = parseAnchor(cut < 0 ? text : text.slice(0, cut), refs);
    if (anchor.why) return anchor;
    if (cut < 0) return { value: anchor.value };
    const after = parseDuration(text.slice(cut + 3));
    return after.why ? after : { value: `${anchor.value} + ${after.value.text}` };
}
