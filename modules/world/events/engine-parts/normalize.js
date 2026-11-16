// Pack events, normalizing: checks a list of event definitions into sorted defs and the invalid ones with why.

import { compile } from '../condition.js';
import { FIRE, EVENT_LIMITS } from './shared-keys.js';
import { checkId, isRecord } from './shared-check.js';

/** Plain JSON data only (SPEC §2.1): objects, arrays, strings, finite numbers, booleans, null. */
function isPlain(value, depth = 0) {
    if (depth > 16) return false;
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
    if (typeof value === 'number') return Number.isFinite(value);
    if (Array.isArray(value)) return value.every(item => isPlain(item, depth + 1));
    const proto = typeof value === 'object' ? Object.getPrototypeOf(value) : undefined;
    if (proto !== Object.prototype && proto !== null) return false;   // functions, Dates, Maps, class instances
    return Object.values(value).every(item => isPlain(item, depth + 1));
}

/** A JSON copy of a payload record, or null when it is not plain data (or larger than 4 KB). */
function plainCopy(value) {
    if (value === undefined) return {};
    if (!isRecord(value) || !isPlain(value)) return null;
    const text = JSON.stringify(value);
    return text.length > 4000 ? null : JSON.parse(text);
}

/** The fire payload's own fields (`id`, `cue`, `once`, `then`): `{ value }` or `{ why }`. */
function normalizeFire(raw) {
    const idProblem = checkId(raw?.id, 'An event');
    if (idProblem) return { why: idProblem };
    const id = raw.id;
    if (typeof raw.cue !== 'string' || !raw.cue.trim()) return { why: `The event "${id}" has no cue to tell.` };
    const cue = raw.cue.trim();
    if (cue.length > EVENT_LIMITS.cue) return { why: `The cue of "${id}" is longer than ${EVENT_LIMITS.cue} characters.` };
    const once = raw.once === undefined ? true : raw.once;
    if (typeof once !== 'boolean') return { why: `The event "${id}" has once: ${JSON.stringify(once)}; use true or false.` };
    const list = raw.then === undefined || raw.then === null ? [] : raw.then;
    if (!Array.isArray(list)) return { why: `The "then" of "${id}" must be a list of commands.` };
    if (list.length > EVENT_LIMITS.then) return { why: `The event "${id}" runs more than ${EVENT_LIMITS.then} commands.` };
    const then = [];
    for (const [index, step] of list.entries()) {
        const where = `Command ${index + 1} of "${id}"`;
        if (!isRecord(step) || typeof step.command !== 'string' || !step.command.trim()) return { why: `${where} needs a command name.` };
        if (step.command === FIRE) return { why: `${where} can't fire another event.` };
        const payload = plainCopy(step.payload);
        if (!payload) return { why: `${where} (${step.command}) has a payload that is not a plain record of data.` };
        then.push({ command: step.command, payload });
    }
    return { value: { id, cue, once, then } };
}

/**
 * Check a list of event definitions. `{ defs, invalid }`: defs sorted by id, each
 * `{ id, pack, when, cue, once, after, then }`; invalid `[{ id, pack, why }]` in list order.
 * A condition that does not parse makes its event invalid (it could never be met).
 */
export function normalizeEvents(list) {
    const defs = [];
    const invalid = [];
    const seen = new Set();
    const source = Array.isArray(list) ? list : [];
    if (source.length > EVENT_LIMITS.events) invalid.push({ id: null, pack: null, why: `Only the first ${EVENT_LIMITS.events} events are read.` });
    for (const raw of source.slice(0, EVENT_LIMITS.events)) {
        const pack = isRecord(raw) && typeof raw.pack === 'string' ? raw.pack : null;
        const id = isRecord(raw) && typeof raw.id === 'string' ? raw.id : null;
        const reject = why => invalid.push({ id, pack, why });
        if (!isRecord(raw)) { reject('An event must be a record.'); continue; }
        const fire = normalizeFire(raw);
        if (fire.why) { reject(fire.why); continue; }
        if (raw.decision !== undefined && (checkId(raw.decision, 'A decision') || fire.value.once === false)) { reject('A decision needs an id and a once event.'); continue; }
        if (seen.has(id)) { reject(`Two events share the id "${id}"; the first one is kept.`); continue; }
        if (typeof raw.when !== 'string' || !raw.when.trim()) { reject(`The event "${id}" has no condition ("when").`); continue; }
        const parsed = compile(raw.when);
        if (!parsed.ok) { reject(`The condition of "${id}" can't be read: ${parsed.error.message}`); continue; }
        let after = raw.after === undefined || raw.after === null || raw.after === '' ? null : raw.after;
        if (after !== null) {
            const problem = checkId(after, `The "after" of "${id}"`);
            if (problem) { reject(problem); continue; }
            if (after === id) { reject(`The event "${id}" waits for itself.`); continue; }
        }
        seen.add(id);
        defs.push({ id, pack, when: raw.when, ...fire.value, after, ...(raw.decision === undefined ? {} : { decision: raw.decision }) });
    }
    // `after` must name a once event (only those leave a claim), and chains must not loop.
    const byId = new Map(defs.map(def => [def.id, def]));
    const kept = defs.filter(def => {
        const target = def.after && byId.get(def.after);
        if (target && !target.once) {
            invalid.push({ id: def.id, pack: def.pack, why: `The event "${def.id}" waits for "${def.after}", which repeats (once: false) and so never counts as happened.` });
            return false;
        }
        for (let step = def.after, hops = 0; step && hops <= defs.length; step = byId.get(step)?.after, hops += 1) {
            if (step === def.id) {
                invalid.push({ id: def.id, pack: def.pack, why: `The event "${def.id}" is part of a loop of "after" events, so none of them can happen.` });
                return false;
            }
        }
        return true;
    });
    kept.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return { defs: kept, invalid };
}
