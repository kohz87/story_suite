// The job: checking `powers` (factions and rulers) and `scores` (world meters): ids, standing range, starts, held places, drift.

import { POWER_FIELDS, SCORE_FIELDS, SLUG, STANDING, WORLD_LIMITS } from '../../limits.js';
import { foldKey, oneLine } from '../../../core/text.js';
import { isObject, isText } from '../core.js';

const whole = (value, lo = STANDING.min, hi = STANDING.max) => Number.isInteger(value) && value >= lo && value <= hi;

function listOf(list, kind, max, add, one) {
    if (!Array.isArray(list)) { add('BAD_CONTENT', `content.${kind}`, `content.${kind} must be a list.`); return []; }
    if (list.length > max) { add('BAD_CONTENT', `content.${kind}`, `content.${kind} holds at most ${max} entries.`); return []; }
    const out = [];
    const seen = new Set();
    list.forEach((record, index) => {
        const path = `content.${kind}[${index}]`;
        if (!isObject(record)) return add('BAD_RECORD', path, `${path} must be an object.`);
        const label = `${kind === 'powers' ? 'Power' : 'Score'} ${typeof record.id === 'string' ? `"${record.id}"` : path}`;
        let good = true;
        const say = (field, message, code = 'BAD_RECORD') => { good = false; add(code, `${path}.${field}`, `${label}: ${message}`); };
        if (typeof record.id !== 'string' || !SLUG.test(record.id)) say('id', 'id must be lower-case-with-hyphens (the id is what power:<id> and score:<id> name).');
        else if (seen.has(record.id)) say('id', `two ${kind} share the id "${record.id}".`, 'DUPLICATE');
        if (typeof record.name !== 'string' || !record.name.trim() || record.name.length > WORLD_LIMITS.name) say('name', `name must be text of 1 to ${WORLD_LIMITS.name} characters.`);
        const made = one(record, say);
        if (!good) return;
        seen.add(record.id);
        out.push({ id: record.id, name: oneLine(record.name, WORLD_LIMITS.name), ...made });
    });
    return out;
}

/** `powers: [{ id, name, aliases?, start, factions?, holds? }]`; `holds` places are resolved by `resolvePlace` (name, alias or id). */
export function checkPowers(list, resolvePlace, ripplesNames, add, warn) {
    return listOf(list, 'powers', WORLD_LIMITS.powers, add, (record, say) => {
        for (const key of Object.keys(record)) if (!POWER_FIELDS.includes(key)) say(key, `"${key}" is not a power field (expected ${POWER_FIELDS.join(', ')}).`, 'UNKNOWN_FIELD');
        if (!whole(record.start)) say('start', `start must be a whole number from ${STANDING.min} to ${STANDING.max}.`);
        const aliases = record.aliases ?? [];
        if (!Array.isArray(aliases) || aliases.some(alias => !isText(alias, WORLD_LIMITS.name) || !alias.trim())) say('aliases', 'aliases must be a list of other names.');
        const factions = record.factions ?? [];
        if (!Array.isArray(factions) || factions.some(entry => !isText(entry, WORLD_LIMITS.name) || !entry.trim())) say('factions', 'factions must be a list of faction names.');
        const holds = record.holds ?? [];
        if (!Array.isArray(holds)) say('holds', 'holds must be a list of places.');
        else for (const place of holds) if (!resolvePlace(place)) say('holds', `holds names "${String(place)}", which is not a place of this pack.`, 'UNKNOWN_REF');
        if (typeof record.name === 'string' && ripplesNames.has(foldKey(record.name))) warn('DOUBLE_POWER', 'content.powers', `Power "${record.id}": "${record.name}" is also in ripples.powers; the engine reads only content.powers, so write its starting standing there and drop the ripples entry.`);
        return { start: record.start, ...(aliases.length ? { aliases: aliases.map(alias => oneLine(alias, WORLD_LIMITS.name)) } : {}), ...(factions.length ? { factions: factions.map(entry => oneLine(entry, WORLD_LIMITS.name)) } : {}), ...(holds.length ? { holds: [...holds] } : {}) };
    });
}

/** `scores: [{ id, name, range?, start, means?, drift? }]`; the range defaults to −100..100. */
export function checkScores(list, add) {
    return listOf(list, 'scores', WORLD_LIMITS.scores, add, (record, say) => {
        for (const key of Object.keys(record)) if (!SCORE_FIELDS.includes(key)) say(key, `"${key}" is not a score field (expected ${SCORE_FIELDS.join(', ')}).`, 'UNKNOWN_FIELD');
        const range = record.range ?? [STANDING.min, STANDING.max];
        if (!Array.isArray(range) || range.length !== 2 || !whole(range[0]) || !whole(range[1]) || range[0] >= range[1]) say('range', `range must be [low, high] whole numbers inside ${STANDING.min}..${STANDING.max}, low below high.`);
        else if (!whole(record.start, range[0], range[1])) say('start', `start must be a whole number inside the range ${range[0]}..${range[1]}.`);
        if (record.means !== undefined && (!isText(record.means, 300) || !record.means.trim())) say('means', 'means must be one plain sentence of at most 300 characters.');
        if (record.drift !== undefined && typeof record.drift !== 'boolean') say('drift', 'drift must be true or false (false: only events and effects move this score).');
        return { range: [...range], start: record.start, ...(record.means ? { means: oneLine(record.means, 300) } : {}), ...(record.drift !== undefined ? { drift: record.drift } : {}) };
    });
}
