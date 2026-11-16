// A death the host has confirmed (Story Director, combat): `confirmDeath({ event, npc, expectedHead })` marks the dossier of the `np_` identity dead the way the rules do
// (Delta's own terminal death record), and stores it as one `people.write` on the reply the host's head stands on, so it is in the store and in `npc.dossier`, and a
// delete or rewind of that reply brings the person back. There is no timeline participant: the people store is the one timeline. The head is checked first (`STALE`), the
// identity is looked up by id only (`REFUSED` for one NPC State does not know: the death is held, never guessed from a name), the same event again is acknowledged, and the
// answer is `ok` only once the store holds the death. After the store took it, the death is set on the cache as it is NOW (`setRecord`, in place): changes NPC
// State made while the commit was awaited (a scan, a cast dossier, an edit) stay, and so does the scan bookkeeping (never the whole-state hydrate).

import { confirmedDeath } from '../storysuite-participant/participant.js';
import { isTerminalNpcDeath } from '../../terminal-lifecycle.js';

const fail = (code, message) => ({ ok: false, code, message });

/**
 * { sdk(), peopleSync, identity(args) → the npc.identity answer, readState(), setRecord(record) → boolean (sets that one person's record in the cache, in place), now() }
 * → { confirmDeath(input) → Promise<{ ok, event?, ack? } | { ok: false, code, message }> }.
 */
export function createNativeDeath({ sdk, peopleSync, identity, readState, setRecord, now = () => Date.now() }) {
    const events = new Map();   // event id -> the dossier id it was delivered for (this run)
    return {
        async confirmDeath(input) {
            if (!input || typeof input !== 'object' || typeof input.event !== 'string' || !input.event || typeof input.npc !== 'string' || !input.npc || typeof input.expectedHead !== 'string' || !input.expectedHead) {
                return fail('INVALID', 'confirmDeath takes { event, npc, expectedHead }.');
            }
            const api = sdk();
            if (!api || typeof api.timeline?.head !== 'function') return fail('FAILED', 'There is no story state.');
            await peopleSync.sync();
            const head = await api.timeline.head({});
            if (head?.ok !== true || !head.source) return fail('NOT_FOUND', 'There is no story state.');
            if (head.headHash !== input.expectedHead) return fail('STALE', 'The head moved since it was read; the event was not delivered.');
            const who = identity({ id: input.npc });
            if (!who || who.id !== input.npc || typeof who.nativeKey !== 'string' || !who.nativeKey) return fail('REFUSED', 'The native target of that death is unknown, so the death is held rather than guessed.');
            if (events.has(input.event) && events.get(input.event) !== who.nativeKey) return fail('CONFLICT', 'That event was delivered already for another person.');
            const state = readState();
            const at = Array.isArray(state?.npcs) ? state.npcs.findIndex(record => record?.id === who.nativeKey) : -1;
            if (at < 0) return fail('REFUSED', 'The native target of that death is unknown, so the death is held rather than guessed.');
            events.set(input.event, who.nativeKey);
            const next = isTerminalNpcDeath(state.npcs[at]) ? state : structuredClone(state);
            if (next !== state) next.npcs[at] = confirmedDeath(next.npcs[at], { event: input.event, now: now() });
            // The store first: the cache changes only once the store holds the death (a same event again checks the store too, whatever the cache says).
            const out = await peopleSync.commit(next);
            if (out.sent !== true && out.skipped !== true) { events.delete(input.event); return fail(out.stale ? 'STALE' : 'FAILED', 'The death was not stored; the story moved or the store refused it.'); }
            if (next !== state) {
                // The cache as it is now (it may have moved during the commit): only this person's record takes the death.
                const current = readState();
                const record = Array.isArray(current?.npcs) ? current.npcs.find(item => item?.id === who.nativeKey) : null;
                const dead = record ? (isTerminalNpcDeath(record) ? record : confirmedDeath(structuredClone(record), { event: input.event, now: now() })) : next.npcs[at];
                if (setRecord(dead) !== true) { events.delete(input.event); await peopleSync.hydrate(); return fail('FAILED', 'NPC State could not take the death yet; try again in a moment.'); }
                // A change commit queued during the death's commit read the cache before the death was set on it: the cache now (death and changes) is stored once more.
                await peopleSync.commit();
            }
            return { ok: true, event: input.event, ack: true };
        },
    };
}
