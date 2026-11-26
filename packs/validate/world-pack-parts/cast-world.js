// The job: checking the world pack's cast (spec §8): each entry is `companion` or `figure`, and one bad entry is refused alone, naming the
// person and the field, while the rest of the cast still loads. A refused entry is a Problem (a warning of the pack), never a refusal of the pack.

import { CAST_KINDS, CAST_START_FIELDS, PORTRAIT_NAME, RETIRED_CAST_FIELDS, SLUG, WORLD_CAST_FIELDS, WORLD_CAST_LIMITS } from '../../limits.js';
import { foldKey, oneLine } from '../../../core/text.js';
import { isObject } from '../core.js';
import { pairs, plain, relationships, ties } from './cast-fields.js';
import { behaviour, meters, stages } from './cast-ladder.js';
import { secrets } from './cast-secrets.js';
import { checkBirthday } from './cast-birthday.js';

// look, voice, personality and the start routine take what NPC State keeps and sends of them.
const TEXTS = { name: 80, role: 120, species: 60, gender: 40, age: 40, apparentAge: 40, look: 800, wears: 600, voice: 600, personality: 900, history: 1200, homeBase: 80, withYou: 320, status: 200, goal: 200 };

// The stored appearance is "<look>; <wears>"; together they stay within the 1200 characters the narrator and NPC State's prompts show.
const LOOK_AND_WEARS = 1195;

const startMax = key => (key === 'routine' ? 300 : 200);

// Format 4 adds `birthday` and says where a retired format 3 field went; format 3 keeps its own list and wording.
function oneEntry(record, say, v4) {
    const fields = v4 ? [...WORLD_CAST_FIELDS, 'birthday'] : WORLD_CAST_FIELDS;
    for (const key of Object.keys(record)) if (!fields.includes(key)) say(key, `"${key}" is not a cast field${v4 && Object.hasOwn(RETIRED_CAST_FIELDS, key) ? ` (${RETIRED_CAST_FIELDS[key]})` : ` (expected ${fields.join(', ')})`}.`, 'UNKNOWN_FIELD');
    if (!CAST_KINDS.includes(record.kind)) say('kind', `kind must be "companion" or "figure".`);
    if (typeof record.id !== 'string' || !SLUG.test(record.id)) say('id', 'id must be a lower-case slug like "sir-lothar".');
    const out = { kind: record.kind, id: record.id };
    for (const [field, max] of Object.entries(TEXTS)) {
        if (record[field] === undefined) { if (field === 'name') say('name', 'name is required.'); continue; }
        // `age` is a number or text (spec v0.14.10): a number is kept as its digits, like the text NPC State stores.
        if (field === 'age' && typeof record.age === 'number') { if (Number.isInteger(record.age) && record.age >= 0 && record.age <= 99999) out.age = String(record.age); else say('age', 'age as a number must be a whole number from 0 to 99999 (or write text: "about 300", "ageless").'); continue; }
        if (!plain(record[field], max)) say(field, `${field} must be plain text of 1 to ${max} characters (no < > { }).`);
        else out[field] = oneLine(record[field]);
    }
    if (out.look && out.wears && out.look.length + out.wears.length > LOOK_AND_WEARS) say('look', `look and wears together must be at most ${LOOK_AND_WEARS} characters.`);
    if (record.aliases !== undefined) {
        if (!Array.isArray(record.aliases) || record.aliases.length > WORLD_CAST_LIMITS.aliases) say('aliases', `aliases must be a list of at most ${WORLD_CAST_LIMITS.aliases} other names.`);
        else if (record.aliases.some(alias => !plain(alias, 80))) say('aliases', 'every alias must be plain text of 1 to 80 characters.');
        else out.aliases = record.aliases.map(alias => oneLine(alias));
    }
    if (record.mannerisms !== undefined) {
        if (!Array.isArray(record.mannerisms) || record.mannerisms.length > WORLD_CAST_LIMITS.mannerisms || record.mannerisms.some(habit => !plain(habit, 120))) say('mannerisms', `mannerisms must be a list of at most ${WORLD_CAST_LIMITS.mannerisms} short habits.`);
        else out.mannerisms = record.mannerisms.map(habit => oneLine(habit));
    }
    if (record.drawnTo !== undefined) {
        if (!Array.isArray(record.drawnTo) || record.drawnTo.length > 6 || record.drawnTo.some(phrase => !plain(phrase, 80))) say('drawnTo', 'drawnTo must be a list of at most 6 short phrases.');
        else out.drawnTo = record.drawnTo.map(phrase => oneLine(phrase));
    }
    if (record.forms !== undefined) out.forms = pairs(record.forms, 'forms', ['name', 'look'], WORLD_CAST_LIMITS.forms, say);
    if (record.start !== undefined) {
        if (!isObject(record.start)) say('start', 'start must be { "place", "goal", "routine" } (not a plain string; status is top level).');
        else {
            for (const key of Object.keys(record.start)) if (!CAST_START_FIELDS.includes(key)) say(`start.${key}`, `"${key}" is not a start field (expected ${CAST_START_FIELDS.join(', ')}).`, 'UNKNOWN_FIELD');
            for (const key of CAST_START_FIELDS) if (record.start[key] !== undefined && !plain(record.start[key], startMax(key))) say(`start.${key}`, `start.${key} must be plain text of 1 to ${startMax(key)} characters.`);
            out.start = Object.fromEntries(CAST_START_FIELDS.filter(key => plain(record.start[key], startMax(key))).map(key => [key, oneLine(record.start[key])]));
        }
    }
    if (v4 && record.birthday !== undefined) { const birthday = checkBirthday(record.birthday, say); if (birthday) out.birthday = birthday; }
    if (record.level !== undefined) { if (Number.isInteger(record.level) && record.level >= 1 && record.level <= 99) out.level = record.level; else say('level', 'level must be a whole number from 1 to 99.'); }
    for (const flag of ['protected', 'canDieUnmet']) if (record[flag] !== undefined) { if (typeof record[flag] === 'boolean') out[flag] = record[flag]; else say(flag, `${flag} must be true or false.`); }
    if (record.portrait !== undefined) { if (typeof record.portrait === 'string' && PORTRAIT_NAME.test(record.portrait)) out.portrait = record.portrait; else say('portrait', 'portrait must be the name of an image file beside the pack, like "lothar.webp".'); }
    const meterMap = meters(record.meters, say);
    if (meterMap && Object.keys(meterMap).length) out.meters = meterMap;
    const lists = { behaviour: behaviour(record.behaviour, say), ties: ties(record.ties, say), keyRelationships: relationships(record.keyRelationships, say), stages: stages(record.stages, meterMap, say), secrets: secrets(record.secrets, say), tastes: pairs(record.tastes, 'tastes', ['item', 'like', 'why'], WORLD_CAST_LIMITS.tastes, say), abilities: pairs(record.abilities, 'abilities', ['name', 'description'], WORLD_CAST_LIMITS.abilities, say), keepsakes: pairs(record.keepsakes, 'keepsakes', ['name', 'description'], WORLD_CAST_LIMITS.keepsakes, say) };
    for (const [field, kept] of Object.entries(lists)) if (record[field] !== undefined) out[field] = kept;
    return out;
}

/** The kept entries of `content.cast` for a world pack (every entry has a `kind`). A bad entry is `warn`ed and left out alone. */
export function checkWorldCast(list, packId, add, warn, v4 = false) {
    if (!Array.isArray(list)) { add('BAD_CONTENT', 'content.cast', 'content.cast must be a list of people.'); return []; }
    const out = [];
    const ids = new Set();
    const names = new Map();
    list.forEach((record, index) => {
        const path = `content.cast[${index}]`;
        if (!isObject(record)) return warn('BAD_RECORD', path, `${path} was refused: it must be an object.`);
        const who = typeof record.name === 'string' && record.name.trim() ? `Cast "${oneLine(record.name, 80)}"` : typeof record.id === 'string' ? `Cast "${record.id}"` : path;
        let good = true;
        const say = (field, message, code = 'BAD_RECORD') => { good = false; warn(code, `${path}.${field}`, `${who} was refused, the rest of the cast still loads: ${message}`); };
        const entry = oneEntry(record, say, v4);
        if (good && ids.has(entry.id)) say('id', `the id "${entry.id}" is already another person's.`, 'DUPLICATE');
        if (good) for (const each of [entry.name, ...(entry.aliases ?? [])]) if (names.has(foldKey(each)) && names.get(foldKey(each)) !== entry.id) say('name', `"${each}" is already a name or alias of another person.`, 'DUPLICATE');
        if (!good) return;
        ids.add(entry.id);
        for (const each of [entry.name, ...(entry.aliases ?? [])]) names.set(foldKey(each), entry.id);
        out.push({ ...entry, pack: packId });
    });
    if (out.length > WORLD_CAST_LIMITS.entries) {
        warn('BAD_CONTENT', 'content.cast', `A pack holds at most ${WORLD_CAST_LIMITS.entries} people; the ${out.length - WORLD_CAST_LIMITS.entries} after the first ${WORLD_CAST_LIMITS.entries} were left out.`);
        out.length = WORLD_CAST_LIMITS.entries;
    }
    return out;
}
