// Checks the shape of the people domain's slice and of the view a mirror sends: version, order equals the keys, plain JSON, no positional records,
// and record keys that follow NPC State Delta's own id rule (`npc_` + a name slug, as makeNpcId makes them), safe as JSON-pointer segments.

const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const LISTS = ['candidates', 'dismissed', 'userDismissedGroups'];
const MAPS = ['npcs', 'socialGraph', 'portraitAssets'];

// Delta's ids: `npc_` then letters, digits, `-` and `_` (slug, `_2` suffix, imports); never a pointer or prototype character.
const PEOPLE_ID = /^npc_[\p{L}\p{N}_-]{1,100}$/u;
const isPeopleId = id => typeof id === 'string' && PEOPLE_ID.test(id);

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

/** Whether `value` is a sound people view (the shape a `people.mirror` sends). */
export const isPeopleView = value => validatePeople(value).length === 0;
