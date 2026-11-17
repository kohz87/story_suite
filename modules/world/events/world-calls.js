// World events, the condition language's extra calls (feature `story-director.world-events`, default off):
//   condition('name')          is this world condition active at the event's `where` (anywhere, with no `where`)?
//   condition('name', 'ref')   is it active at this place, route, region or realm?
//   active('event-id')         did this pack event happen on this line of the story and has it not ended (an `ends_when.any_of` of `fired:` or `set:` anchors)?
//   fact('text')               does a Journal record mention this text (any case)?
// Conditions are read only through the chronicle's `chronicle.conditions` query (the world-engine contract),
// facts through `director.journal`. With the feature off nothing here is wired in: the parser does not know
// these names, so a pack that uses one is refused exactly as before.

import { claimKey } from './engine-parts/shared-keys.js';

export const WORLD_FEATURE = 'story-director.world-events';

/** [fewest, most] values each extra call takes; handed to the parser as its extra calls. */
export const WORLD_ARITY = Object.freeze({ condition: [1, 2], active: [1, 1], fact: [1, 1] });

const MAX_TEXT = 200;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const lower = value => String(value).trim().toLowerCase();

/** Is the switch on for this reader? Only an explicit true: a view with no `feature` (older callers) is off. */
export const worldOn = source => typeof source?.feature === 'function' && source.feature(WORLD_FEATURE) === true;

function text(value, what) {
    if (typeof value !== 'string' || !value.trim()) throw new Error(`${what} needs a word in quotes.`);
    if (value.length > MAX_TEXT) throw new Error(`${what} is longer than ${MAX_TEXT} characters.`);
    return value.trim();
}

function ask(env, name, args) {
    if (typeof env?.query !== 'function') throw new Error(`${name} has nothing to ask: no queries are available here.`);
    const answer = env.query(name, args);
    if (answer && typeof answer.then === 'function') throw new Error(`${name} answers later; a condition needs its answer now.`);
    return answer;
}

/** Every string in a Journal day record (depth-limited), lower-cased. */
function strings(value, out, depth = 0) {
    if (typeof value === 'string') out.push(value.toLowerCase());
    else if (depth < 4 && Array.isArray(value)) for (const item of value) strings(item, out, depth + 1);
    else if (depth < 4 && isRecord(value)) for (const item of Object.values(value)) strings(item, out, depth + 1);
}

/**
 * The extra calls for one evaluation. `env` is the view `{ state, query }`; `where` the event's own place
 * (a ref name or null); `events` a Map of normalized definitions by id (for `ends_when`).
 */
export function worldCalls(env, { where = null, events = new Map() } = {}) {
    return {
        condition(name, ref) {
            const wanted = text(name, 'condition()');
            const at = ref === undefined ? where : text(ref, 'condition()');
            const rows = ask(env, 'chronicle.conditions', { name: wanted, ...(at ? { ref: at } : {}) });
            return Array.isArray(rows) && rows.some(row => isRecord(row) && row.name === wanted && (!at || row.ref === at));
        },
        active(id) {
            const key = text(id, 'active()');
            const claims = env?.state?.meta?.claims;
            if (!isRecord(claims)) return false;
            const happened = happenedOf(claims);
            if (!happened(key)) return false;
            const any = events.get(key)?.ends_when?.any_of;
            return !(Array.isArray(any) && any.some(anchor => anchorMet(anchor, env, happened)));
        },
        fact(needle) {
            const wanted = lower(text(needle, 'fact()'));
            const journal = ask(env, 'director.journal', {});
            const lines = [];
            for (const day of Array.isArray(journal?.days) ? journal.days : []) strings(day, lines);
            return lines.some(line => line.includes(wanted));
        },
    };
}

/** Did this event happen (a claim `event:<id>` or `event:<id>:<at>`)? */
const happenedOf = claims => id => claims[claimKey(id)] === true || Object.keys(claims).some(claim => claim.startsWith(`${claimKey(id)}:`) && claims[claim] === true);

// An `ends_when.any_of` anchor, as far as the store tells: `fired:<event>` (its claim) and `set:<condition>[@ref]` (it is active).
// `ended:`, `cleared:` and the rest need the daily trigger's history (a later job), so they end nothing here.
function anchorMet(anchor, env, happened) {
    const [head, rest = ''] = String(anchor).split(/:(.*)/s);
    if (head === 'fired') return happened(rest);
    if (head !== 'set') return false;
    const [name, ref] = rest.split('@');
    const rows = ask(env, 'chronicle.conditions', { name, ...(ref ? { ref } : {}) });
    return Array.isArray(rows) && rows.some(row => isRecord(row) && row.name === name && (!ref || row.ref === ref));
}
