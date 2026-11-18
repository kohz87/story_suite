// The job: checking `content.regions` (spec v0.14.10): `[{ id, name, aliases? }]`, and that every place's region (and the start scene's) is a declared region id.

import { REGION_FIELDS, SLUG, WORLD_LIMITS } from '../../limits.js';
import { foldKey, oneLine } from '../../../core/text.js';
import { isObject } from '../core.js';
import { nameProblem, RESERVED_IDS } from './realms.js';

/** → the kept list. A bad record is refused alone with its own Problem. */
export function checkRegions(list, add) {
    if (!Array.isArray(list)) { add('BAD_CONTENT', 'content.regions', 'content.regions must be a list like [{ "id": "the-march", "name": "The March", "aliases": ["the northern march"] }].'); return []; }
    if (list.length > WORLD_LIMITS.regions) { add('BAD_CONTENT', 'content.regions', `content.regions holds at most ${WORLD_LIMITS.regions} regions.`); return []; }
    const out = [];
    const seen = new Set();
    list.forEach((record, index) => {
        const path = `content.regions[${index}]`;
        if (!isObject(record)) return add('BAD_RECORD', path, `${path} must be an object.`);
        let good = true;
        const say = (field, message, code = 'BAD_RECORD') => { good = false; add(code, `${path}.${field}`, `Region ${typeof record.id === 'string' ? `"${record.id}"` : path}: ${message}`); };
        for (const key of Object.keys(record)) if (!REGION_FIELDS.includes(key)) say(key, `"${key}" is not a region field (expected ${REGION_FIELDS.join(', ')}).`, 'UNKNOWN_FIELD');
        if (typeof record.id !== 'string' || !SLUG.test(record.id)) say('id', 'id must be lower-case-with-hyphens.');
        else if (seen.has(record.id)) say('id', `two regions share the id "${record.id}".`, 'DUPLICATE');
        else if (RESERVED_IDS.includes(record.id)) say('id', `"${record.id}" is a reserved word (a placeholder, @${record.id}); it cannot be an id.`);
        if (typeof record.name !== 'string' || !record.name.trim() || record.name.length > WORLD_LIMITS.name) say('name', `name must be text of 1 to ${WORLD_LIMITS.name} characters.`);
        else if (nameProblem(record.name)) say('name', `the name ${nameProblem(record.name)}.`);
        const aliases = record.aliases;
        if (aliases !== undefined && (!Array.isArray(aliases) || aliases.length > 6 || aliases.some(alias => typeof alias !== 'string' || !alias.trim() || alias.length > WORLD_LIMITS.name || nameProblem(alias)))) say('aliases', 'aliases must be a list of at most 6 other names (no "@" or ": ").');
        if (!good) return;
        seen.add(record.id);
        out.push({ id: record.id, name: oneLine(record.name, WORLD_LIMITS.name), ...(aliases?.length ? { aliases: aliases.map(alias => oneLine(alias, WORLD_LIMITS.name)) } : {}) });
    });
    return out;
}

/** Whole-pack region checks, once the places, realms and start are known. With no `content.regions` there is nothing to compare, and one warning says so. */
export function checkRegionUse({ regions, declared, places, realms, startPlace, add, warn }) {
    const ids = new Set(regions.map(region => region.id));
    if (!declared) {
        if (places.some(place => place.region)) warn('REGIONS_UNDECLARED', 'content.regions', 'The pack declares no content.regions: its places name regions that have no display name or aliases. List each region as { "id", "name" } (spec v0.14.10).');
        return;
    }
    places.forEach((place, index) => {
        if (place.region && !ids.has(place.region)) add('UNKNOWN_REF', `content.places[${index}].region`, `Place "${place.name}": the region "${place.region}" is not a declared region id (content.regions).`);
    });
    if (startPlace?.region && !ids.has(startPlace.region)) add('UNKNOWN_REF', 'start.scene.place.region', `The start scene's region "${startPlace.region}" is not a declared region id (content.regions).`);
    realms.forEach((realm, index) => {
        for (const region of realm.regions) {
            if (!ids.has(region) && !regions.some(entry => foldKey(entry.name) === foldKey(region))) warn('UNKNOWN_REF', `content.realms[${index}].regions`, `Realm "${realm.id}" lists the region "${region}", which content.regions does not declare.`);
        }
    });
}
