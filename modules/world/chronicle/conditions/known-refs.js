// Which places, routes, regions and realms the story knows by name, for a condition's `ref`. Pure.

import { foldKey } from '../../../../core/text.js';
import { ask } from '../queries-parts/shared-ask.js';

const rows = (query, name, args) => { const out = ask(query, name, args); return Array.isArray(out) ? out : []; };
const fold = text => foldKey(text).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const text = value => (typeof value === 'string' && value.trim() ? value.trim() : '');

// Every name the scope knows, each as { key, name }: the name is what the condition is kept under.
function names(query, scope) {
    const out = [];
    const add = (first, ...others) => { for (const each of [first, ...others]) if (text(each)) out.push({ key: fold(each), name: text(first) }); };
    const places = [...rows(query, 'atlas.places', {}), ...rows(query, 'packs.content', { kind: 'places' })];
    if (scope === 'place') for (const place of places) add(place?.name, ...(Array.isArray(place?.aliases) ? place.aliases : []));
    if (scope === 'region' || scope === 'realm') for (const place of places) add(place?.region);
    if (scope === 'realm') for (const pack of rows(query, 'packs.list', {})) add(pack?.name);
    if (scope === 'route') {
        for (const route of rows(query, 'packs.content', { kind: 'routes' })) {
            const ends = [route?.from, route?.to].filter(text);
            if (ends.length !== 2) continue;
            const named = [`${ends[0]} ${ends[1]}`, `${ends[1]} ${ends[0]}`];
            const display = `${ends[0]}-${ends[1]}`;
            for (const each of [route.corridor, ...named, ...named.map(pair => `${pair} ${text(route.kind)}`), route.slug]) {
                if (text(each)) out.push({ key: fold(each), name: each === route.corridor ? text(each) : display });
            }
        }
    }
    return out;
}

/** The name the story keeps `ref` under for `scope` (a place, route, region or realm it knows), or null. */
export function knownRef(query, scope, ref) {
    const key = fold(ref);
    return key ? names(query, scope).find(entry => entry.key === key)?.name ?? null : null;
}
