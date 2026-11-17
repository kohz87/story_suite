// Story Director v2, chronicle part: what `chronicle.condition.set` / `.clear` would refuse for a world line's `conditions:` label, asked before
// the call. A refused sub-command fails the whole reply's command on the host (ctx.call keeps the first failure), so the world line asks first
// and calls only what will be taken; what would be refused stays a note on the card and the line itself stands.

import { clockOf } from '../text.js';
import { knownRef } from '../../conditions/known-refs.js';
import { MAX_CONDITIONS, MAX_PER_REF } from '../../conditions/limits.js';

const ask = ctx => (name, args) => ctx.query(name, args);

// The region of the line's place (the atlas's, else the pack's place), for a region or realm condition with no region on the line.
function regionOfPlace(ctx, place) {
    try {
        const region = ctx.query('atlas.place', { name: place })?.region;
        if (typeof region === 'string' && region.trim()) return region.trim();
    } catch { /* no atlas: the pack's places */ }
    try {
        const found = (ctx.query('packs.content', { kind: 'places' }) ?? []).find(entry => String(entry?.name ?? '').toLowerCase() === place.toLowerCase());
        return typeof found?.region === 'string' ? found.region.trim() : '';
    } catch { return ''; }
}

/**
 * For one `{ name, scope }` the pack declares and the line's `place` / `region`: `{ ref }` (the name the store keeps it under) when the
 * command will take it, or `{ refusal }` (the words for the card) when it would refuse. `clear`: lifting needs only a ref.
 */
export function conditionTarget(ctx, known, { place, region }, clear) {
    if (ctx.cause === 'ui') return { refusal: `"${known.name}": conditions are set by the story, not by a click` };
    const wide = ['region', 'realm'].includes(known.scope);
    const asked = wide ? (region || (place && regionOfPlace(ctx, place)) || place) : place;
    if (!asked) return { refusal: `"${known.name}" needs a place on the line` };
    if (clear) return { ref: asked };
    const ref = knownRef(ask(ctx), known.scope, asked);
    if (!ref) return { refusal: `"${known.name}": "${asked}" is not a ${known.scope} of this world` };
    if (clockOf(ctx) === null) return { refusal: `"${known.name}" waits for the story to have a date` };
    const table = ctx.read('chronicle')?.conditions ?? {};
    if (Object.hasOwn(table, `${known.name}@${ref}`)) return { ref };
    if (Object.keys(table).length >= MAX_CONDITIONS) return { refusal: `"${known.name}": the world already carries ${MAX_CONDITIONS} conditions` };
    if (Object.values(table).filter(entry => entry?.ref === ref).length >= MAX_PER_REF) return { refusal: `"${known.name}": ${ref} already carries ${MAX_PER_REF} conditions` };
    return { ref };
}
