// Pack events, inspecting: where every event stands against a view (fired, due, waiting, error, invalid), without running a command.

import { evaluateCondition } from '../condition.js';
import { claimKey } from './shared-keys.js';
import { isRecord } from './shared-check.js';
import { normalizeEvents } from './normalize.js';

function claimed(state, id) {
    const claims = state?.meta?.claims;
    return isRecord(claims) && Object.prototype.hasOwnProperty.call(claims, claimKey(id)) && claims[claimKey(id)] === true;
}

/**
 * Where every event stands against a view (`{ state, query }`). Pure: no command runs.
 * `{ events: [{ id, pack, status, why, once, after, when, cue }], fired, due, waiting, invalid, problems }`
 * with status `fired` | `due` | `waiting` | `error` | `invalid`.
 */
export function inspect(view, list, problems = []) {
    const { defs, invalid } = normalizeEvents(list);
    const state = view?.state;
    const env = { state, query: view?.query };
    const known = new Set(defs.map(def => def.id));
    const events = [];
    for (const def of defs) {
        const row = { id: def.id, pack: def.pack, status: 'waiting', why: '', once: def.once, after: def.after, when: def.when, cue: def.cue };
        if (def.once && claimed(state, def.id)) {
            row.status = 'fired';
            row.why = 'It has happened on this line of the story.';
        } else if (def.after && !claimed(state, def.after)) {
            row.why = known.has(def.after)
                ? `It waits for "${def.after}" to happen first.`
                : `It waits for "${def.after}", which no enabled pack defines.`;
        } else {
            const result = evaluateCondition(def.when, env);
            if (result.error) {
                row.status = 'error';
                row.why = `Its condition can't be checked: ${result.error.message}`;
            } else if (result.met) {
                row.status = 'due';
                row.why = def.once ? 'Its condition is met: it happens before the next reply.' : 'Its condition is met: it repeats before every reply while that holds.';
            } else row.why = 'Its condition is not met yet.';
        }
        events.push(row);
    }
    for (const entry of invalid) events.push({ id: entry.id, pack: entry.pack, status: 'invalid', why: entry.why, once: null, after: null, when: null, cue: null });
    const ids = status => events.filter(row => row.status === status).map(row => row.id);
    return {
        events,
        fired: ids('fired'),
        due: ids('due'),
        waiting: events.filter(row => row.status === 'waiting' || row.status === 'error').map(row => ({ id: row.id, why: row.why })),
        invalid: events.filter(row => row.status === 'invalid').map(row => ({ id: row.id, why: row.why })),
        problems: [...problems],
        defs,
    };
}
