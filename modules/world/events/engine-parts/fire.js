// Pack events, the fire command: the `events.fire` handler that claims the event, runs its `then` and tells the cue.

import { evaluateCondition } from '../condition.js';
import { claimKey, repeatKey } from './shared-keys.js';
import { checkId } from './shared-check.js';
import { normalizeEvents } from './normalize.js';
import { inspect } from './inspect.js';

/**
 * The `events.fire` handler (SPEC §3.2), for the event definitions `events(view)` gives (the enabled
 * packs'): claim, run `then`, tell the cue. Payload `{ id, at }` as `beforeGenerate` sends it; the cue,
 * `once` and `then` always come from the pack's own definition, never from the payload (B3-1). Runs only
 * as the host's own `system` cue at the top (REFUSED otherwise, and for an id no enabled pack defines or
 * whose condition is not met), and is marked internal for the registry. Its steps run with
 * ctx.caller `event:<id>`. A once event claims `event:<id>`; a repeating one `event:<id>:<at>`
 * (`at` = the index of the reply being written), so it pays at most once per reply (B3-9).
 */
export function createFireEvent(events = () => []) {
    function fireEvent(ctx, payload) {
        if (ctx.cause !== 'system' || ctx.caller) ctx.fail('REFUSED', 'An event happens only when Story Block checks the events before a reply, never from a button, a change line or another command.');
        const idProblem = checkId(payload?.id, 'An event');
        if (idProblem) ctx.fail('INVALID', idProblem);
        // The condition is checked again here, on the transaction's state: its domains are read as asked.
        const domains = new Proxy({}, {
            get: (_, name) => (typeof name === 'string' ? ctx.read(name) ?? undefined : undefined),
            getOwnPropertyDescriptor: (_, name) => {
                const value = typeof name === 'string' ? ctx.read(name) : null;
                return value === null || value === undefined ? undefined : { value, enumerable: true, configurable: true, writable: false };
            },
            has: (_, name) => typeof name === 'string' && ctx.read(name) !== null,
        });
        const view = { state: { domains }, query: (name, args) => ctx.query(name, args) };
        let list;
        try { list = events(view); } catch { list = []; }
        const defs = normalizeEvents(Array.isArray(list) ? list : []).defs;
        let def = defs.find(entry => entry.id === payload.id);
        if (!def) ctx.fail('REFUSED', `No enabled pack has an event "${payload.id}".`);
        if (def.decision) {
            const snapshot = ctx.query('events.replayState');
            const state = { domains, meta: { claims: snapshot.claims } };
            const group = defs.filter(entry => entry.pack === def.pack && entry.decision === def.decision);
            const report = inspect({ ...view, state }, group);
            if (report.events.some(row => row.status === 'error')) ctx.fail('FAILED', 'The event decision could not be checked.');
            def = group.find(entry => report.due.includes(entry.id));
            if (!def) ctx.fail('NO_LONGER_DONE', 'No event in this decision is due on this line of the story.');
            const predicate = { kind: 'events.decision', pack: def.pack, decision: def.decision };
            ctx.replayGuard({ owner: 'story-block', version: 2, epoch: ctx.epoch, rulesHash: null, inputHash: snapshot.hash, predicate });
        }
        const met = evaluateCondition(def.when, view);
        if (met.error || !met.met) ctx.fail('REFUSED', `The event "${def.id}" is not due: its condition is not met.`);
        const at = Number.isSafeInteger(payload.at) && payload.at >= 0 ? payload.at : null;
        if (def.once && !ctx.claim(claimKey(def.id))) ctx.fail('CLAIMED', `The event "${def.id}" has already happened on this line of the story.`);
        if (!def.once && at !== null && !ctx.claim(repeatKey(def.id, at))) ctx.fail('CLAIMED', `The event "${def.id}" has already happened for this reply.`);
        for (const step of def.then) ctx.call(step.command, step.payload, { as: `event:${def.id}` });
        return { summary: def.cue, narrate: true, data: { event: def.id, then: def.then.map(step => step.command) }, ...(def.decision ? { replan: true } : {}) };
    }
    // An internal command (registry.js): the bus refuses it with cause 'ui' and the public sdk never sends it.
    Object.defineProperty(fireEvent, 'internal', { value: true, enumerable: true });
    return fireEvent;
}

/** events.fire with no events to fire (every id is refused); createEventsPart builds the real one. */
export const fireEvent = createFireEvent();
