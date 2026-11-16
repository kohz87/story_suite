// The npc meters live in the store's people domain (people store P4): `people.bonds` = { npcs: { [npc_id]: record }, problems, keyAway?, cast? }, keyed by the
// same npc_ ids as the dossiers. Story Block owns that domain, so the meter code (written for its own `npc` slice) runs on a copy: `folded(handler)` gives the
// handler a ctx whose read/draft of `npc` are that copy (and whose `standing` shows the Re-read's earlier bonds as `npc`), then checks the copy with the
// slice's own rules and hands it to `people.bonds` in the same transaction (one diff into leaf ops, as before). A handler that refuses stores nothing.
// `bondsOf(state)` is the same copy for queries.

import { NPC_DOMAIN, isObject } from '../npc-meters-config.js';
import { initialNpcSlice, validateNpcSlice } from '../npc-meters-slice.js';

export const PEOPLE_DOMAIN = 'people';
const clone = value => JSON.parse(JSON.stringify(value));
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const bondsIn = domains => (isObject(domains?.[PEOPLE_DOMAIN]?.bonds) && isObject(domains[PEOPLE_DOMAIN].bonds.npcs) ? domains[PEOPLE_DOMAIN].bonds : null);

/** The meter slice of a state (`state.domains.people.bonds`), or the empty slice. Read only. */
export const bondsOf = state => bondsIn(state?.domains) ?? initialNpcSlice();

// The Re-read's earlier state as the meter code reads it: its people bonds under `npc`.
function standingView(standing) {
    if (!isObject(standing)) return standing;
    const bonds = bondsIn(standing.domains);
    return { ...standing, domains: { ...standing.domains, [NPC_DOMAIN]: bonds ?? undefined } };
}

/** `handler(ctx, ...args)` run on the people bonds as its `npc` slice; the changed slice is checked and stored through `people.bonds`. */
export function folded(handler) {
    if (typeof handler !== 'function') return handler;
    return function foldedHandler(ctx, ...args) {
        let copy = null;
        let before = null;
        const take = () => {
            if (copy === null) {
                const stored = bondsIn({ [PEOPLE_DOMAIN]: ctx.read(PEOPLE_DOMAIN) });
                before = stored ? clone(stored) : null;
                copy = stored ? clone(stored) : initialNpcSlice();
            }
            return copy;
        };
        const view = Object.create(ctx, {
            read: { value: domain => (domain === NPC_DOMAIN ? (copy ?? bondsIn({ [PEOPLE_DOMAIN]: ctx.read(PEOPLE_DOMAIN) }) ?? initialNpcSlice()) : ctx.read(domain)) },
            draft: { value: domain => (domain === NPC_DOMAIN ? take() : ctx.draft(domain)) },
            standing: { get: () => standingView(ctx.standing) },
        });
        const out = handler(view, ...args);
        if (copy !== null && !sameJson(copy, before ?? initialNpcSlice())) {
            const problems = validateNpcSlice(copy);
            if (problems.length) ctx.fail('INVALID', `The NPC meters would not be valid: ${problems.join(' ')}`);
            ctx.call('people.bonds', { bonds: clone(copy) });
        }
        return out;
    };
}

/** Every handler of a commands map folded (a command given as { handler, … } keeps its other fields). */
export function foldedCommands(commands) {
    return Object.fromEntries(Object.entries(commands).map(([type, entry]) => [type, typeof entry === 'function' ? folded(entry) : (isObject(entry) ? { ...entry, handler: folded(entry.handler) } : entry)]));
}
