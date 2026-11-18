// The chat frame's shape (pack format 4, D12): the slice a chat keeps of the world and game it began with, its starting value and its check.

import { canonicalJson, isPlainJson } from '../../replay.js';

/** (not exported) The longest the frame's calendar and currency may be together, in characters of JSON. */
const MAX_FRAME_JSON = 20000;

/** The slice before any frame is written. `set` says a frame was written; `refresh` is "use the current game" waiting for the next reply; `told` is the last update note given. */
export const initialFrame = () => ({ set: false, refresh: false, world: null, game: null, calendar: null, currency: null, told: '' });

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const HASH = /^(?:[0-9a-f]{64})?$/;

/** An entry of the frame, `{ pack, version, hash }` (`pack`: the pack's id; a key named `id` must be an item-style ID, so it is not used), checked: the strings are short and the hash is empty or 64 hex characters. */
function entryOk(value) {
    return isRecord(value) && Object.keys(value).length === 3
        && typeof value.pack === 'string' && value.pack.length > 0 && value.pack.length <= 200
        && typeof value.version === 'string' && value.version.length <= 80
        && typeof value.hash === 'string' && HASH.test(value.hash);
}

/** Why `{ world, game, calendar, currency }` is not a frame, or '' when it is one (the payload of `packs.frame`). */
export function frameProblem(value) {
    if (!isRecord(value) || Object.keys(value).some(key => !['world', 'game', 'calendar', 'currency'].includes(key))) return 'packs.frame takes { world, game, calendar, currency }.';
    if (value.world !== null && !entryOk(value.world)) return 'The frame\'s world is null or { pack, version, hash }.';
    if (value.game !== 'built-in' && !entryOk(value.game)) return 'The frame\'s game is "built-in" or { pack, version, hash }.';
    for (const key of ['calendar', 'currency']) {
        if (value[key] !== null && (!isRecord(value[key]) || !isPlainJson(value[key]))) return `The frame's ${key} is null or plain data.`;
    }
    if (canonicalJson({ calendar: value.calendar, currency: value.currency }).length > MAX_FRAME_JSON) return 'The frame\'s calendar and currency are too long.';
    return '';
}

/** The domain's validator: the errors of a whole slice (`[]` when it is sound). */
export function validateFrame(slice) {
    if (!isRecord(slice)) return ['frame is not an object.'];
    const errors = [];
    if (typeof slice.set !== 'boolean') errors.push('frame.set is not true or false.');
    if (typeof slice.refresh !== 'boolean') errors.push('frame.refresh is not true or false.');
    if (typeof slice.told !== 'string' || slice.told.length > 1000) errors.push('frame.told is not a short string.');
    if (slice.set === true) {
        const problem = frameProblem({ world: slice.world, game: slice.game, calendar: slice.calendar, currency: slice.currency });
        if (problem) errors.push(problem);
    }
    return errors;
}
