// The core's side of interactions: the `interaction.settle` prelude command and the guard answer for `predicate.kind === 'interaction'`.
// The settle and guard logic live in interaction/; this file only wires them to the registry's kinds and the command's ctx.

import { interactionGuard } from '../../interaction/guard.js';
import { settleInteraction } from '../../interaction/settle.js';

export const SETTLE = 'interaction.settle';
export const SETTLED = 'interaction.settled';

/** The query a settle asks for a carried segment's earlier receipt: the stored settle receipts of one key, as the transaction sees them (on a re-plan, those before the block). */
export const settledQuery = (_state, args, tools) => (typeof args?.key === 'string'
    ? tools.receipts().filter(entry => (entry?.receipt ?? entry)?.type === SETTLE && (entry?.receipt ?? entry)?.replan?.payload?.key === args.key) : []);

// What a kind reads as `state`: the domains as this command sees them (the head with the reply's drafts laid over it), read on demand.
function stateOf(ctx) {
    const domains = new Proxy(Object.freeze({}), {
        get: (_, name) => (typeof name === 'string' ? ctx.read(name) : undefined),
        has: (_, name) => typeof name === 'string' && ctx.read(name) != null,
    });
    return Object.freeze({ domains });
}

/**
 * `{ 'interaction.settle': handler }`: a prelude, internal command (the host stores it on a generated reply, no caller can run it).
 * `kindOf(kindId)` is the registered kind or null.
 */
export function createInteractionCommands({ kindOf = () => null } = {}) {
    // The earlier segment's receipt is read through the transaction (ctx.query), so a re-plan sees the receipts before its block, never the store's stale list.
    const handler = (ctx, payload) => settleInteraction(ctx, payload, kindOf, { state: stateOf(ctx), receipts: () => ctx.query(SETTLED, { key: payload?.carriedKey }) });
    return { [SETTLE]: Object.assign(handler, { prelude: true, internal: true }) };
}

/** The replayGuard answer for an interaction block (the host's hook calls it when `predicate.kind === 'interaction'`). */
export const interactionGuardFor = kindOf => (view, info) => interactionGuard(view, info, kindOf);
