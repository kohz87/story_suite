// The open fight as the board's view and offers read it, from the interaction scratch in chat metadata: the same fields the pre-port session had
// (`id`, `anchor`, `setup`, `exchanges`, `groups`), made from the open interaction's steps. Reading only: every change goes through `sdk.interaction`.
import { heldForSid } from '../../../core/interaction/held.js';
import { settleStep } from '../../../core/interaction/watch.js';

export const FIGHT_KIND = 'story-block/fight';
// The steps as the board's view reads them: one `{ actions }` per exchange, each input's `args` with its `choice` as the action's `kind`.
const toExchanges = steps => steps.map(step => ({ actions: step.inputs.map(input => ({ ...input.args, kind: input.choice })) }));
const plain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** A session-shaped view of an open interaction or a settle payload of the fight kind (null for another kind). `id` is the fight's setup id (what its results name as `board.id`). */
export function fightOf(source) {
    if (!plain(source) || source.kindId !== FIGHT_KIND || !plain(source.setup) || !Array.isArray(source.steps)) return null;
    return { id: source.setup.id, interactionId: source.id, origin: source.origin ?? source.anchor, anchor: source.anchor, groups: source.setup.groups, setup: source.setup, exchanges: toExchanges(source.steps), steps: source.steps, ...(plain(source.witness) ? { witness: source.witness } : {}),
        ...(source.setup.resumed ? { resumed: true } : {}), ...(source.invalidated ? { invalidated: true } : {}), ...(source.carriedKey ? { carried: true } : {}), ...(source.idle === true ? { idle: true } : {}) };
}

/** The fight open on this chat, or null. */
export const openFight = meta => fightOf(meta?.storySuiteInteraction?.open);

/** The fight a held reply waits on (`sid`'s marker, unless its settle was kept since), or null: `{ fight, discarded }`. */
export function heldFight(meta, sid, receipts = []) {
    const held = heldForSid(meta, sid, receipts), fight = fightOf(settleStep(held?.current)?.payload);
    return held && fight ? { fight, discarded: meta?.storySuiteInteraction?.heldDiscarded?.[sid] === true } : null;
}
