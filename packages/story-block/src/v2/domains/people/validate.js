// Checks the shape of the people domain's slice and of the view a mirror sends: version, order equals the keys, plain JSON, no positional records,
// record keys that follow NPC State Delta's own id rule (`npc_` + a name slug, as makeNpcId makes them), safe as JSON-pointer segments,
// portraits that are file references only ({ path, type, hash }, never image bytes) and a socialGraph whose keys are pointer-safe and whose edge ids are people ids.

const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const LISTS = ['candidates', 'dismissed', 'userDismissedGroups'];
const MAPS = ['npcs', 'socialGraph', 'portraitAssets'];

// Delta's ids: `npc_` then letters, digits, `-` and `_` (slug, `_2` suffix, imports); never a pointer or prototype character.
const PEOPLE_ID = /^npc_[\p{L}\p{N}_-]{1,100}$/u;
const isPeopleId = id => typeof id === 'string' && PEOPLE_ID.test(id);

const SAFE_KEY = /^[^/~]+$/;
const RESERVED = new Set(['__proto__', 'constructor', 'prototype']);
const IMAGE_BYTES = /^data:[^,]{0,100};base64,/i;
const fileRef = value => isObject(value) && typeof value.path === 'string' && value.path !== '' && !IMAGE_BYTES.test(value.path) && typeof value.type === 'string' && typeof value.hash === 'string' && !('dataUrl' in value);

// Whether any string in `value` is image bytes (a data URL) or any key is `dataUrl`.
function hasImageBytes(value, depth = 0) {
    if (depth > 40) return false;
    if (typeof value === 'string') return IMAGE_BYTES.test(value);
    if (Array.isArray(value)) return value.some(item => hasImageBytes(item, depth + 1));
    if (!isObject(value)) return false;
    return Object.entries(value).some(([key, item]) => (key === 'dataUrl' && item !== undefined && item !== '') || hasImageBytes(item, depth + 1));
}

// The sentences about socialGraph: keys safe as pointer segments, and the ids of its edges (aId, bId) and open slots (ownerId) people ids.
function graphProblems(graph) {
    if (!isObject(graph)) return [];
    const errors = [];
    if (Object.keys(graph).some(key => !SAFE_KEY.test(key) || RESERVED.has(key))) errors.push('The people socialGraph has a key that is not safe to store.');
    const ids = [];
    for (const edge of Array.isArray(graph.edges) ? graph.edges : []) if (isObject(edge)) ids.push(edge.aId, edge.bId);
    for (const slot of Array.isArray(graph.unresolved) ? graph.unresolved : []) if (isObject(slot)) ids.push(slot.ownerId);
    if (ids.some(id => id !== undefined && id !== null && id !== '' && !isPeopleId(id))) errors.push('The people socialGraph names someone who is not an NPC id (npc_ and a name).');
    return errors;
}

function plain(value, depth = 0) {
    if (depth > 40) return false;
    if (value === null || ['string', 'boolean'].includes(typeof value)) return true;
    if (typeof value === 'number') return Number.isFinite(value);
    if (Array.isArray(value)) return value.every(item => plain(item, depth + 1));
    if (!isObject(value) || Object.getPrototypeOf(value) !== Object.prototype) return false;
    return Object.values(value).every(item => plain(item, depth + 1));
}

/** The problems with a people slice, as a list of sentences (empty when it is sound). */
export function validatePeople(slice) {
    if (!isObject(slice)) return ['The people domain is not an object.'];
    const errors = [];
    if (slice.v !== 1) errors.push('The people domain has an unknown version.');
    if (!Array.isArray(slice.order) || slice.order.some(id => !isPeopleId(id))) errors.push('The people order is not a list of NPC ids (npc_ and a name).');
    for (const key of MAPS) if (slice[key] !== undefined && !isObject(slice[key])) errors.push(`The people ${key} is not a map.`);
    for (const key of LISTS) if (slice[key] !== undefined && !Array.isArray(slice[key])) errors.push(`The people ${key} is not a list.`);
    if (slice.turn !== undefined && !Number.isInteger(slice.turn)) errors.push('The people turn is not a whole number.');
    if (isObject(slice.portraitAssets) && Object.keys(slice.portraitAssets).some(id => !isPeopleId(id))) errors.push('A portrait is keyed by something that is not an NPC id.');
    if (isObject(slice.portraitAssets) && Object.values(slice.portraitAssets).some(record => !fileRef(record))) errors.push('A portrait is not a file reference ({ path, type, hash }); image bytes are never stored.');
    if (hasImageBytes(slice)) errors.push('The people domain holds image bytes (a data URL); portraits are kept as files.');
    errors.push(...graphProblems(slice.socialGraph));
    if (isObject(slice.npcs) && Object.keys(slice.npcs).some(id => !isPeopleId(id))) errors.push('A people record is keyed by something that is not an NPC id (npc_ and a name).');
    if (isObject(slice.npcs) && Array.isArray(slice.order)) {
        const keys = Object.keys(slice.npcs);
        if (new Set(slice.order).size !== slice.order.length || slice.order.length !== keys.length || slice.order.some(id => !Object.hasOwn(slice.npcs, id))) {
            errors.push('The people order does not match the people records.');
        }
        if (keys.some(id => !isObject(slice.npcs[id]))) errors.push('A people record is not an object (records are keyed by id, never by position).');
    }
    if (!plain(slice)) errors.push('The people domain holds something that is not plain JSON.');
    return errors;
}

/** Whether `value` is a sound people view (the shape `people.write` takes). */
export const isPeopleView = value => validatePeople(value).length === 0;
