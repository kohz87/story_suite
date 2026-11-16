// Checking places and routes on the map.

import { PLACE_FIELDS, LIMITS, RECORD_LIMITS, MARKET_WORD, MARKET_LIMITS, RARITIES, ROUTE_FIELDS } from '../../limits.js';
import { oneLine, foldKey } from '../../../../../../../core/text.js';
import { isNumber, isText, isObject, slugify } from '../core.js';

// A place on the map: a name, coordinates in map units (x east, y north) and what it is.
export function checkPlace(record, path, label, add) {
    let ok = true;
    const say = (field, message, code = 'BAD_RECORD') => { ok = false; add(code, `${path}.${field}`, `${label}: ${message}`); };
    for (const key of Object.keys(record)) if (!PLACE_FIELDS.includes(key)) say(key, `"${key}" is not a place field (expected ${PLACE_FIELDS.join(', ')}).`, 'UNKNOWN_FIELD');
    for (const axis of ['x', 'y']) if (!isNumber(record[axis]) || Math.abs(record[axis]) > 1e6) say(axis, `${axis} must be a number (map units).`);
    for (const field of ['region', 'kind', 'layer']) if (record[field] !== undefined && !isText(record[field], LIMITS.name)) say(field, `${field} must be text of at most ${LIMITS.name} characters.`);
    const aliases = record.aliases ?? [];
    if (!Array.isArray(aliases) || aliases.some(alias => typeof alias !== 'string' || !alias.trim() || alias.length > LIMITS.name)) say('aliases', 'aliases must be a list of other names for the place.');
    const note = record.note ?? '';
    if (!isText(note, RECORD_LIMITS.note)) say('note', 'note must be text of at most 500 characters.');
    for (const flag of ['hidden', 'secret']) if (record[flag] !== undefined && typeof record[flag] !== 'boolean') say(flag, `${flag} must be true or false.`);
    // Its market (PACKS.md "Markets"): a settlement type and environment tags, each a lowercase word.
    if (record.market !== undefined && !(typeof record.market === 'string' && MARKET_WORD.test(record.market))) say('market', 'market must be a settlement type, a lowercase word like "village" or "city".');
    const placeTags = record.tags ?? [];
    if (!Array.isArray(placeTags) || placeTags.length > MARKET_LIMITS.tags || placeTags.some(tag => typeof tag !== 'string' || !MARKET_WORD.test(tag))) say('tags', `tags must be a list of at most ${MARKET_LIMITS.tags} lowercase words like "river" or "port".`);
    // The most the story's items may be here (`story-block.gear`): { maxRarity }, one of the five; absent = no extra limit.
    if (record.loot !== undefined && !(isObject(record.loot) && Object.keys(record.loot).every(key => key === 'maxRarity') && RARITIES.includes(record.loot.maxRarity))) say('loot', `loot must be { "maxRarity": ${RARITIES.map(word => `"${word}"`).join(' | ')} }.`);
    if (!ok) return null;
    return {
        name: oneLine(record.name, LIMITS.name), aliases: [...new Set(aliases.map(alias => oneLine(alias, LIMITS.name)))],
        region: oneLine(record.region ?? '', LIMITS.name), kind: oneLine(record.kind ?? '', LIMITS.name), layer: oneLine(record.layer ?? '', LIMITS.name),
        x: record.x, y: record.y, note,
        // `secret` is another word for `hidden`; the map reads either.
        ...(record.hidden === true || record.secret === true ? { hidden: true } : {}),
        ...(record.market !== undefined ? { market: record.market } : {}),
        ...(record.loot !== undefined ? { loot: { maxRarity: record.loot.maxRarity } } : {}),
        ...(placeTags.length ? { tags: [...new Set(placeTags)] } : {}),
    };
}

// A route names two places of this pack by name, alias or slug; it is stored with their names.
export function placeRefs(places) {
    const byKey = new Map();
    for (const place of places) for (const key of [place.slug, ...[place.name, ...place.aliases].map(foldKey)]) if (!byKey.has(key)) byKey.set(key, place.name);
    return value => (typeof value === 'string' && value.trim() ? byKey.get(value) ?? byKey.get(foldKey(value)) ?? null : null);
}

export const routeSlug = record => slugify(`${record.from ?? ''} ${record.to ?? ''} ${record.kind ?? ''}`);

export function checkRoute(record, path, add, place) {
    const label = typeof record.from === 'string' && typeof record.to === 'string' ? `Route "${record.from}" to "${record.to}"` : path;
    let ok = true;
    const say = (field, message, code = 'BAD_RECORD') => { ok = false; add(code, `${path}.${field}`, `${label}: ${message}`); };
    for (const key of Object.keys(record)) if (!ROUTE_FIELDS.includes(key)) say(key, `"${key}" is not a route field (expected ${ROUTE_FIELDS.join(', ')}).`, 'UNKNOWN_FIELD');
    const from = place(record.from);
    const to = place(record.to);
    if (!from) say('from', `"${record.from ?? ''}" is not a place of this pack.`, 'UNKNOWN_REF');
    if (!to) say('to', `"${record.to ?? ''}" is not a place of this pack.`, 'UNKNOWN_REF');
    if (from && to && from === to) say('to', 'a route joins two different places.');
    if (typeof record.kind !== 'string' || !record.kind.trim() || record.kind.length > RECORD_LIMITS.word) say('kind', 'kind must say what the route is, like "road" or "river" (at most 40 characters).');
    for (const field of ['km', 'hours']) if (record[field] !== undefined && (!isNumber(record[field]) || record[field] <= 0 || record[field] > 1e6)) say(field, `${field} must be a number above 0, or left out.`);
    if (record.corridor !== undefined && !isText(record.corridor, LIMITS.name)) say('corridor', `corridor must be text of at most ${LIMITS.name} characters.`);
    const note = record.note ?? '';
    if (!isText(note, RECORD_LIMITS.note)) say('note', 'note must be text of at most 500 characters.');
    if (!ok) return null;
    return { from, to, kind: oneLine(record.kind, RECORD_LIMITS.word), km: record.km ?? null, hours: record.hours ?? null, corridor: oneLine(record.corridor ?? '', LIMITS.name), note };
}
