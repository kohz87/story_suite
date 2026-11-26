// Story Director v2, chronicle part: what `chronicle.condition.set` / `.clear` would refuse for a world line's `conditions:` label, asked before
// the call. A refused sub-command fails the whole reply's command on the host (ctx.call keeps the first failure), so the world line asks first
// and calls only what will be taken; what would be refused stays a note on the card and the line itself stands. The ref is read as the
// condition's scope (spec §2): a place condition takes the line's place; a region or realm condition the line's `region:` / `realm:`, else
// the place's region or realm; a route condition (or any other ref) an explicit `name@ref` in the label (seam audit E38).

import { clockOf } from '../text.js';
import { hostGeo, knownRef, placeIdsOn } from '../../conditions/known-refs.js';
import { setRefusal } from '../../conditions/refusal.js';
import { WILDS } from '../../../daily/geo.js';

const ask = ctx => (name, args) => ctx.query(name, args);
const low = text => String(text ?? '').trim().toLowerCase();

// The region of the line's place: the packs' map, else the atlas's place.
function regionOfPlace(ctx, geo, place) {
    const own = geo.byName.get(low(place));
    if (own) return own.region;
    try {
        const region = ctx.query('atlas.place', { name: place })?.region;
        return typeof region === 'string' ? region.trim() : '';
    } catch { return ''; }
}

// The ref a line names for a condition of `scope`, before it is checked.
function askedRef(ctx, geo, scope, { place, region, realm, explicit }) {
    if (explicit) return explicit;
    if (scope === 'place') return place;
    if (scope === 'region') return region || (place && regionOfPlace(ctx, geo, place)) || '';
    if (scope === 'realm') {
        if (realm) return realm;
        const own = region || (place && regionOfPlace(ctx, geo, place));
        return own ? geo.regionRealm.get(low(own)) ?? WILDS : '';
    }
    return '';
}

/**
 * For one `{ name, scope, placeStatus? }` the pack declares and the line's `place` / `region` / `realm` / `explicit` ref: `{ ref }` (the
 * name the store keeps it under) when the command will take it, or `{ refusal }` (the words for the card) when it would refuse.
 */
export function conditionTarget(ctx, known, { place, region = '', realm = '', explicit = '' }, clear) {
    if (ctx.cause === 'ui') return { refusal: `"${known.name}": conditions are set by the story, not by a click` };
    const geo = hostGeo(ask(ctx), ctx.carrier);
    const asked = askedRef(ctx, geo, known.scope, { place, region, realm, explicit });
    if (!asked) return { refusal: known.scope === 'route' ? `"${known.name}" is a route condition: write it as ${known.name}@<route>` : `"${known.name}" needs a place on the line` };
    const table = ctx.draft('chronicle')?.conditions ?? {};
    const ref = knownRef(ask(ctx), known.scope, asked, geo)
        ?? (clear ? Object.values(table).find(entry => entry?.name === known.name && low(entry.ref) === low(asked))?.ref : null);
    if (!ref) return { refusal: `"${known.name}": "${asked}" is not a ${known.scope} of this world` };
    if (clear) return { ref };
    // The draft: it holds what this same line set a moment ago (the commands run on the reply's drafts).
    const refusal = setRefusal({ query: ask(ctx), chronicle: ctx.draft('chronicle') ?? {}, geo, declared: known, ref, now: clockOf(ctx), by: 'narrator', homes: placeIdsOn(ctx.carrier) });
    return refusal ? { refusal: `"${known.name}": ${refusal}` } : { ref };
}
