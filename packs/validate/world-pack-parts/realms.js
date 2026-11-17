// The job: checking `realms` and the names and ids of the map: no "@" or ": " in a name, ids unique across realms, regions and places.

import { REALM_FIELDS, SLUG, WORLD_LIMITS } from '../../limits.js';
import { foldKey, oneLine } from '../../../core/text.js';
import { isObject } from '../core.js';

const BAD_NAME = /@|: /;
/** A place, route, region or realm name may not hold "@" or ": " (they break the <condition>@<ref>: <duration> line). */
export const nameProblem = name => (typeof name === 'string' && BAD_NAME.test(name) ? 'may not contain "@" or ": " (they would break the <condition>@<ref>: <duration> syntax)' : null);

/** `realms: [{ id, name, regions }]` → the kept list. A bad record is refused alone with its own Problem. */
export function checkRealms(list, add) {
    if (!Array.isArray(list)) { add('BAD_CONTENT', 'content.realms', 'content.realms must be a list like [{ "id": "highmark", "name": "Highmark", "regions": ["the-marches"] }].'); return []; }
    if (list.length > WORLD_LIMITS.realms) { add('BAD_CONTENT', 'content.realms', `content.realms holds at most ${WORLD_LIMITS.realms} realms.`); return []; }
    const out = [];
    const seen = new Set();
    const regionOwner = new Map();
    list.forEach((record, index) => {
        const path = `content.realms[${index}]`;
        if (!isObject(record)) return add('BAD_RECORD', path, `${path} must be an object.`);
        let good = true;
        const say = (field, message, code = 'BAD_RECORD') => { good = false; add(code, `${path}.${field}`, `Realm ${typeof record.id === 'string' ? `"${record.id}"` : path}: ${message}`); };
        for (const key of Object.keys(record)) if (!REALM_FIELDS.includes(key)) say(key, `"${key}" is not a realm field (expected ${REALM_FIELDS.join(', ')}).`, 'UNKNOWN_FIELD');
        if (typeof record.id !== 'string' || !SLUG.test(record.id)) say('id', 'id must be lower-case-with-hyphens.');
        else if (seen.has(record.id)) say('id', `two realms share the id "${record.id}".`, 'DUPLICATE');
        if (typeof record.name !== 'string' || !record.name.trim() || record.name.length > WORLD_LIMITS.name) say('name', `name must be text of 1 to ${WORLD_LIMITS.name} characters.`);
        else if (nameProblem(record.name)) say('name', `the name ${nameProblem(record.name)}.`);
        if (!Array.isArray(record.regions) || record.regions.some(region => typeof region !== 'string' || !region.trim())) say('regions', 'regions must be a list of region ids or names.');
        else for (const region of record.regions) {
            if (nameProblem(region)) say('regions', `the region "${region}" ${nameProblem(region)}.`);
            else if (regionOwner.has(foldKey(region)) && regionOwner.get(foldKey(region)) !== record.id) say('regions', `the region "${region}" is already in realm "${regionOwner.get(foldKey(region))}"; a region belongs to one realm.`, 'DUPLICATE');
            else regionOwner.set(foldKey(region), record.id);
        }
        if (!good) return;
        seen.add(record.id);
        out.push({ id: record.id, name: oneLine(record.name, WORLD_LIMITS.name), regions: record.regions.map(region => oneLine(region, WORLD_LIMITS.name)) });
    });
    return out;
}

/** B9 names, and ids unique across realms, regions and places. `places`, `routes` are the normalized lists, `realms` the kept ones. */
export function checkMapNames({ places, routes, realms }, add) {
    places.forEach((place, index) => {
        if (nameProblem(place.name)) add('BAD_RECORD', `content.places[${index}].name`, `Place "${place.name}": the name ${nameProblem(place.name)}.`);
        if (place.region && nameProblem(place.region)) add('BAD_RECORD', `content.places[${index}].region`, `Place "${place.name}": the region "${place.region}" ${nameProblem(place.region)}.`);
    });
    routes.forEach((route, index) => {
        if (route.name && nameProblem(route.name)) add('BAD_RECORD', `content.routes[${index}].name`, `Route "${route.name}": the name ${nameProblem(route.name)}.`);
    });
    const owner = new Map();
    const claim = (id, what, path) => {
        if (owner.has(id)) add('DUPLICATE', path, `The id "${id}" names a ${owner.get(id)} and a ${what}; ids are unique across realms, regions and places (repeat only the display name and add aliases).`);
        else owner.set(id, what);
    };
    realms.forEach((realm, index) => claim(realm.id, 'realm', `content.realms[${index}].id`));
    const regions = new Set([...realms.flatMap(realm => realm.regions), ...places.map(place => place.region).filter(Boolean)]);
    for (const region of regions) if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(region)) claim(region, 'region', 'content.places');
    places.forEach((place, index) => claim(place.slug, 'place', `content.places[${index}]`));
}
