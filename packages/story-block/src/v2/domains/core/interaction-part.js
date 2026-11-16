// The core's side of interactions: the `interaction.settle` prelude command and the guard answer for `predicate.kind === 'interaction'`.
// The settle and guard logic live in interaction/; this file only wires them to the registry's kinds and the command's ctx.

import { interactionGuard } from '../../interaction/guard.js';
import { settleInteraction } from '../../interaction/settle.js';

export const SETTLE = 'interaction.settle';

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
    // (a carried segment finds the earlier one's receipt through ctx.receipts(): on a re-plan, the receipts before its block)
    const handler = (ctx, payload) => settleInteraction(ctx, payload, kindOf, { state: stateOf(ctx) });
    return { [SETTLE]: Object.assign(handler, { prelude: true, internal: true }) };
}

/** The replayGuard answer for an interaction block (the host's hook calls it when `predicate.kind === 'interaction'`). */
export const interactionGuardFor = kindOf => (view, info) => interactionGuard(view, info, kindOf);
