// The inputs an interaction settle read, kept true while its reply is in flight: the check (witness, derived inputs, play) every
// turn point shares, the settle step a session carries, and the one commit guard + stop that watch a reply's interaction.

import { hashJson } from '../replay.js';
import { interactionError } from './contract.js';
import { deriveSteps } from './derive.js';
import { dice } from './dice.js';
import { settlePayloadProblem } from './settle.js';

const SETTLE = 'interaction.settle';
const plain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const titleOf = (kind, kindId) => String(kind?.title ?? String(kindId ?? 'interaction').split('/').at(-1)).trim() || 'interaction';

/** The segment's settle step in a reply's prelude list (an opening-only step is not it), or undefined. */
export const settleStep = current => current?.prechecks?.find(step => step?.type === SETTLE && plain(step.payload) && step.payload.opening !== true);

/** The opening prelude `{ payload, seed }` a reply's prelude list settles before its segment, or undefined. */
export const openingStep = current => {
    const step = current?.prechecks?.find(item => item?.type === SETTLE && plain(item.payload) && item.payload.opening === true);
    return step ? { payload: step.payload, seed: step.seed } : undefined;
};

/**
 * Why a settle payload cannot be played on `state` now (witness, feature, readiness, derived inputs, play), or null. `kindOf(kindId)` → the kind.
 * The segment is played on the state its opening leaves (`opening`: { payload, seed }; `preview(payload, seed, state)` → that state or null), as the reply's preludes run.
 */
export function interactionInputError(state, payload, { kindOf, featureOn = () => true, opening = null, preview = null } = {}) {
    const kindId = String(payload?.kindId ?? '');
    let kind = null;
    try { kind = kindOf(kindId); } catch { kind = null; }
    const title = titleOf(kind, kindId);
    if (!plain(kind)) return interactionError('NOT_READY', title).message;
    try { if (kind.ready?.() !== true) return interactionError('NOT_READY', title).message; } catch { return interactionError('NOT_READY', title).message; }
    if (typeof kind.feature === 'string' && kind.feature) {
        let on = true;
        try { on = featureOn(kind.feature) !== false; } catch { on = false; }
        if (!on) return interactionError('FEATURE_OFF', title, kind.feature).message;
    }
    const shape = settlePayloadProblem(payload, kind);
    if (shape) return shape.message;
    if (payload.opening === true) return null;
    try {
        if (plain(opening) && typeof preview === 'function') {
            state = preview(opening.payload, opening.seed, state);
            if (!state) return `The ${title} opening could not be prepared.`;
        }
        if (hashJson(kind.witness(state, payload.setup)) !== payload.witness.hash) return interactionError('CHANGED', title).message;
        const actors = (typeof kind.actors === 'function' ? kind.actors(state, payload.setup) : [{ id: payload.player, name: '', party: true }])
            .filter(plain).map(actor => ({ ...actor, player: String(actor.id ?? '') === payload.player ? true : undefined }));
        const stream = dice(payload.seed, payload.offset);
        const done = deriveSteps({ kind, kindId, state, setup: payload.setup, steps: payload.steps, actors, policy: payload.policy, dice: stream });
        if (done.error) return done.error.message;
        const played = kind.play(state, payload.setup, done.steps, stream);
        const detail = typeof played?.error === 'string' ? played.error : played?.error?.message;
        return detail || (plain(played) ? null : interactionError('INVALID', title).message);
    } catch (error) {
        return `${title} could not be checked: ${error?.message ?? error}`;
    }
}

/**
 * The reply's interaction watch. `watch.commitCheck(next, receipt)` is the commit guard's answer for an interaction reply in flight
 * (a reader's edit that changes what the settle read is refused); `watch.stopChanged()` aborts a reply whose inputs changed anyway.
 */
export function createInteractionWatch(s, { store, problem, notify, kindOf, featureOn, preview }) {
    const errorOf = (state, payload, opening = null) => interactionInputError(state, payload, { kindOf, featureOn, opening, preview });
    const payloadOf = () => (s.replyBusy ? settleStep(s.session)?.payload ?? null : null);
    const commitCheck = (next, receipt) => {
        if (receipt?.cause !== 'ui') return null;
        const payload = payloadOf();
        if (!payload) return null;
        return errorOf(next(), payload, openingStep(s.session)) ? `Wait for the reply to finish before changing what the ${titleOf(kindOf(payload.kindId), payload.kindId)} used.` : null;
    };
    const stopChanged = () => {
        const current = s.session, payload = payloadOf();
        if (!payload || current.interactionInvalid) return;
        const error = errorOf(store.head(), payload, openingStep(s.session));
        if (!error) return;
        current.interactionInvalid = true;
        const reason = `${error} Restore what it used before retrying, or discard it.`;
        problem({ module: 'story-block', code: 'INTERACTION_CHANGED', message: reason });
        try { s.abortBoard?.(true); } catch { /* the reason is still shown */ }
        try { notify?.(reason, 'story-block'); } catch { /* the problem remains visible */ }
    };
    return { errorOf, commitCheck, stopChanged };
}
