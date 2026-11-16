// Creates the unsent interaction session, names its reply key and settle payload, and stages one step against the kind.

import { hashJson } from '../replay.js';
import { interactionError, limitsFor } from './contract.js';
import { deriveSteps } from './derive.js';
import { dice } from './dice.js';
import { playerOf } from './player.js';
import { STORY_ACTION_POLICY, policyProblem } from './policy.js';

const plain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.length > 0;
const whole = value => Number.isSafeInteger(value) && value >= 0;
const clone = value => structuredClone(value);
const titleOf = kind => String(kind?.title ?? 'interaction').trim() || 'interaction';
const bytes = value => new TextEncoder().encode(JSON.stringify(value)).length;
const partyOf = (policy, kindId) => policy?.party === true || (Array.isArray(policy?.partyKinds) && policy.partyKinds.includes(kindId));

function cleanStep(step, limits, title) {
    if (!plain(step) || !Array.isArray(step.inputs) || step.inputs.length < 1) {
        return { error: interactionError('INVALID', title, `Choose at least one action for the ${title}.`) };
    }
    if (step.inputs.length > limits.stepInputs) {
        return { error: interactionError('TOO_BIG', title, `The ${title} step has too many inputs.`) };
    }
    const inputs = [];
    for (const input of step.inputs) {
        if (!plain(input) || !text(input.actor) || !text(input.choice)) {
            return { error: interactionError('INVALID', title, `The ${title} step has an incomplete input.`) };
        }
        if (input.args !== undefined) {
            if (!plain(input.args)) return { error: interactionError('INVALID', title, `The ${title} input has no JSON arguments.`) };
            try {
                if (bytes(input.args) > limits.inputBytes) return { error: interactionError('TOO_BIG', title, `A ${title} input is too large to save.`) };
            } catch {
                return { error: interactionError('INVALID', title, `The ${title} input is not plain JSON.`) };
            }
        }
        inputs.push(clone(input));
    }
    return { step: { ...clone(step), inputs } };
}

function recordedActors(actors, playerId) {
    if (!Array.isArray(actors) || !text(playerId)) return Array.isArray(actors) ? actors : [];
    return actors.map(actor => {
        const copy = { ...actor };
        if (String(copy.id ?? '') === playerId) copy.player = true;
        else delete copy.player;
        return copy;
    });
}

/** The chat-metadata session for one interaction segment, fixed to an origin, attempt and kind. */
export function createSession({ origin, anchor, attempt = 0, kindId, version = 1, seed, setup = {}, opening = null } = {}) {
    if (!text(origin) || !text(anchor) || !text(kindId) || !Number.isSafeInteger(version) || version < 1
        || !whole(attempt) || !whole(seed) || !plain(setup)) return null;
    const session = {
        v: 1,
        id: `${origin}:${attempt}:${kindId}`,
        kindId,
        version,
        origin,
        anchor,
        attempt,
        seed,
        offset: 0,
        setup: clone(setup),
        steps: [],
    };
    if (opening !== null) session.opening = clone(opening);
    return session;
}

/** The reply key of the segment: `i:<id>:<anchor>:<offset>`. */
export function interactionKey(session) {
    if (!plain(session) || !text(session.id) || !text(session.anchor) || !whole(session.offset)) return null;
    return `i:${encodeURIComponent(session.id)}:${encodeURIComponent(session.anchor)}:${session.offset}`;
}

/** The exact data a settle receipt keeps in `replan.payload`; unsent-only session fields stay out. */
export function interactionPayload(session) {
    const key = interactionKey(session);
    if (!key || !text(session.kindId) || !Number.isSafeInteger(session.version) || !whole(session.seed) || !plain(session.setup)
        || !Array.isArray(session.steps)) return null;
    const payload = {
        v: 1,
        kindId: session.kindId,
        version: session.version,
        key,
        id: session.id,
        anchor: session.anchor,
        seed: session.seed,
        offset: session.offset,
        setup: clone(session.setup),
        steps: clone(session.steps),
        witness: plain(session.witness) ? clone(session.witness) : null,
    };
    if (text(session.player)) payload.player = session.player;
    if (plain(session.policy)) payload.policy = clone(session.policy);
    if (text(session.prior)) payload.prior = session.prior;
    if (text(session.carriedKey)) payload.carriedKey = session.carriedKey;
    return payload;
}

/** Validates, witnesses, policies and previews one whole step; on success returns the next session and its preview. */
export function stageInteraction({ session, step, kind, kindId = session?.kindId, state, actors = [], policy = STORY_ACTION_POLICY } = {}) {
    const title = titleOf(kind);
    if (!plain(session) || !Array.isArray(session.steps) || !plain(kind) || typeof kind.witness !== 'function'
        || typeof kind.validate !== 'function' || typeof kind.play !== 'function') {
        return { error: interactionError('DAMAGED', title) };
    }
    if (session.invalidated) {
        return { error: interactionError('ENDED', title, `The earlier ${title} was taken back. Restore that reply or discard it.`) };
    }
    const limits = limitsFor(kind);
    const clean = cleanStep(step, limits, title);
    if (clean.error) return clean;
    if (session.steps.length >= limits.steps) {
        return { error: interactionError('ENDED', title, `The ${title} has all the steps it can hold.`) };
    }
    try {
        if (bytes(session.setup) > limits.setupBytes) return { error: interactionError('TOO_BIG', title, `The ${title} setup is too large to save.`) };
    } catch {
        return { error: interactionError('DAMAGED', title, `The ${title} setup is not plain JSON.`) };
    }

    const livePolicy = session.policy ?? policy ?? STORY_ACTION_POLICY;
    const list = recordedActors(actors, session.player);
    const player = session.player ? list.find(actor => String(actor?.id ?? '') === session.player) ?? null : playerOf(list);
    if (!player) {
        return { error: { code: 'NOT_YOURS', message: `Your own character is not on the ${title}.` } };
    }
    const effectivePlayer = String(player.id);
    let witness = plain(session.witness) ? clone(session.witness) : null;
    try {
        const now = hashJson(kind.witness(state, session.setup));
        if (session.steps.length) {
            if (!witness || witness.offset !== session.offset || witness.hash !== now) {
                return { error: interactionError('CHANGED', title) };
            }
        } else witness = { offset: session.offset, hash: now };
    } catch (error) {
        return { error: interactionError('INVALID', title, `The ${title} could not read its setup: ${error?.message ?? error}`) };
    }

    for (const input of clean.step.inputs) {
        const problem = policyProblem(livePolicy, kindId, list, input);
        if (problem) return { error: problem };
    }
    let message;
    try {
        message = kind.validate(state, session.setup, session.steps, clean.step);
    } catch (error) {
        return { error: interactionError('INVALID', title, `The ${title} could not check that step: ${error?.message ?? error}`) };
    }
    if (message !== null && message !== undefined) {
        return { error: interactionError('INVALID', title, typeof message === 'string' ? message : `The ${title} refused that step.`) };
    }

    const stored = [...clone(session.steps), clean.step];
    const completed = deriveSteps({ kind, kindId, state, setup: session.setup, steps: stored, actors: list, policy: livePolicy,
        dice: index => dice(session.seed, session.offset)(index) });
    if (completed.error) return completed;
    let preview;
    try {
        preview = kind.play(state, session.setup, completed.steps, dice(session.seed, session.offset));
    } catch (error) {
        return { error: interactionError('INVALID', title, `The ${title} could not play that step: ${error?.message ?? error}`) };
    }
    if (plain(preview?.error)) return { error: preview.error };
    if (typeof preview?.error === 'string') return { error: interactionError('INVALID', title, preview.error) };
    if (!plain(preview)) return { error: interactionError('INVALID', title, `The ${title} returned no preview.`) };

    const next = clone(session);
    next.steps = stored;
    if (!session.steps.length) {
        next.witness = witness;
        next.player = effectivePlayer;
        next.policy = { choosers: livePolicy.choosers === 'party' ? 'party' : 'own', party: partyOf(livePolicy, kindId) };
    }
    try {
        if (bytes(interactionPayload(next)) > limits.payloadBytes) {
            return { error: interactionError('TOO_BIG', title, `The ${title} is too large to save.`) };
        }
    } catch {
        return { error: interactionError('INVALID', title, `The ${title} step is not plain JSON.`) };
    }
    return { session: next, preview };
}
