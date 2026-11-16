// Settles one interaction segment: checks the recorded payload, derives code-played inputs, plays, claims, guards, applies its changes and returns the receipt.

import { CORE_MODULE_ID } from '../domains/core/constants.js';
import { hashJson } from '../replay.js';
import { interactionError, limitsFor } from './contract.js';
import { deriveSteps } from './derive.js';
import { dice, preludeDice } from './dice.js';
import { INTERACTION_NOTE_TOKENS } from './note.js';
import { isJson } from './preview.js';

const UINT32 = 0xFFFFFFFF;
const HASH = /^[0-9a-f]{64}$/u;
const plain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.length > 0;
const whole = value => Number.isSafeInteger(value) && value >= 0;
const clone = value => structuredClone(value);
const bytes = value => new TextEncoder().encode(JSON.stringify(value)).length;
const titlePart = kindId => {
    const tail = String(kindId ?? 'interaction').split('/').at(-1).replace(/[-_]+/gu, ' ').trim();
    return tail ? tail[0].toUpperCase() + tail.slice(1) : 'interaction';
};
const titleOf = (kind, kindId) => String(kind?.title ?? titlePart(kindId)).trim() || 'interaction';

const damaged = (title, detail = null) => interactionError('DAMAGED', title, detail);

function keyProblem(payload) {
    return payload.key === `i:${encodeURIComponent(payload.id)}:${encodeURIComponent(payload.anchor)}:${payload.offset}`;
}

function inputProblem(input, limits) {
    if (!plain(input) || !text(input.actor) || !text(input.choice)) return 'input';
    if (input.args === undefined) return null;
    if (!plain(input.args)) return 'args';
    try {
        return bytes(input.args) > limits.inputBytes ? 'bytes' : null;
    } catch {
        return 'json';
    }
}

/** Null when a stored settle payload has the recorded shape and stays inside the kind's limits. */
export function settlePayloadProblem(payload, kind = null) {
    const title = titleOf(kind, payload?.kindId);
    if (!plain(payload)) return damaged(title);
    if (payload.v !== 1) return damaged(title, `The saved ${title} uses an unknown format.`);
    if (!text(payload.kindId) || !text(payload.key) || !text(payload.id) || !text(payload.anchor)) return damaged(title);
    if (!Number.isSafeInteger(payload.version) || payload.version < 1) return damaged(title);
    if (!whole(payload.seed) || payload.seed > UINT32 || !whole(payload.offset)) return damaged(title);
    if (!plain(payload.setup) || !Array.isArray(payload.steps)) return damaged(title);
    if (!keyProblem(payload)) return damaged(title);
    if (Number.isSafeInteger(kind?.version) && payload.version > kind.version) {
        return damaged(title, `The saved ${title} was made by a newer version of ${title}.`);
    }
    if (Number.isSafeInteger(kind?.version) && payload.version !== kind.version) {
        return damaged(title, `The saved ${title} was made by an older version of ${title} that this build cannot play.`);
    }

    const opening = payload.opening === true;
    if (payload.opening !== undefined && payload.opening !== true) return damaged(title);
    if (opening) {
        if (payload.steps.length !== 0 || (payload.witness !== null && payload.witness !== undefined)) return damaged(title);
        if (kind && typeof kind.opening !== 'function') return damaged(title);
    } else {
        if (!payload.steps.length) return interactionError('NO_INPUT', title);
        if (!plain(payload.witness) || payload.witness.offset !== payload.offset || !HASH.test(String(payload.witness.hash ?? ''))) return damaged(title);
        if (!text(payload.player) || !plain(payload.policy)) return damaged(title);
        if (!['own', 'party'].includes(payload.policy.choosers) || typeof payload.policy.party !== 'boolean') return damaged(title);
    }
    if ((text(payload.prior) && !text(payload.carriedKey)) || (!text(payload.prior) && text(payload.carriedKey))) return damaged(title);
    if (payload.prior !== undefined && !HASH.test(String(payload.prior))) return damaged(title);

    const limits = limitsFor(kind ?? {});
    try {
        if (bytes(payload.setup) > limits.setupBytes || bytes(payload) > limits.payloadBytes) return interactionError('TOO_BIG', title);
    } catch {
        return damaged(title);
    }
    if (payload.steps.length > limits.steps) return interactionError('TOO_BIG', title);
    for (const step of payload.steps) {
        if (!plain(step) || !Array.isArray(step.inputs) || !step.inputs.length) return damaged(title);
        if (step.inputs.length > limits.stepInputs) return interactionError('TOO_BIG', title);
        for (const input of step.inputs) {
            const problem = inputProblem(input, limits);
            if (problem === 'bytes') return interactionError('TOO_BIG', title);
            if (problem) return damaged(title);
        }
    }
    return null;
}

function recordedActors(kind, state, setup, player) {
    let list;
    if (typeof kind?.actors === 'function') list = kind.actors(state, setup);
    else list = [{ id: player, name: '', party: true }];
    if (!Array.isArray(list)) throw new Error('its actor list is not a list');
    return list.filter(actor => plain(actor)).map(actor => {
        const copy = { ...actor };
        delete copy.player;
        if (String(copy.id ?? '') === player) copy.player = true;
        return copy;
    });
}

function refused(error, title, doing) {
    const reason = error && typeof error === 'object' && typeof error.message === 'string' ? error.message : String(error);
    return `${title} could not ${doing}: ${reason}`;
}

function checkPrior(ctx, payload, title, receipts) {
    if (!text(payload.prior)) return;
    let entries = null;
    try {
        if (typeof receipts === 'function') entries = receipts();
        else if (typeof ctx.receipts === 'function') entries = ctx.receipts();
    } catch {
        entries = null;
    }
    const list = Array.isArray(entries) ? entries : [];
    const earlier = list.map(entry => plain(entry?.receipt) ? entry.receipt : entry).find(receipt => receipt?.type === 'interaction.settle'
        && receipt?.replan?.payload?.key === payload.carriedKey);
    const result = earlier?.data?.v2?.result;
    if (!plain(result) || hashJson(result) !== payload.prior) {
        ctx.fail('NO_LONGER_DONE', interactionError('NO_LONGER_DONE', title).message);
    }
}

function checked(settled, kind, openingOnly, title) {
    if (settled && typeof settled.then === 'function') {
        settled.then(null, () => {});
        return { error: `${title} did not settle at once.` };
    }
    if (!plain(settled)) return { error: `${title} returned no settled result.` };
    const result = settled.result;
    if (!plain(result)) return { error: `${title} returned no settled result.` };
    const changes = settled.changes ?? [];
    if (!Array.isArray(changes)) return { error: `${title} returned changes that are not a list.` };
    const allowed = Array.isArray(kind.changes) ? kind.changes : [];
    for (const change of changes) {
        if (!plain(change) || !text(change.type) || !plain(change.payload)) return { error: `${title} returned a damaged change.` };
        if (!allowed.includes(change.type)) return { error: `${title} tried to change something it does not own.` };
    }
    if (!isJson(result) || !changes.every(change => isJson(change?.payload))) return { error: `${title} returned a result that is not plain JSON.` };
    const limits = limitsFor(kind);
    if (changes.length > limits.changes) return { error: `${title} returned too many changes.`, tooBig: true };
    try {
        if (bytes(result) > limits.resultBytes) return { error: `${title} settled into a result too large to save.`, tooBig: true };
    } catch {
        return { error: `${title} returned a result that is not plain JSON.` };
    }
    const stop = settled.stop ?? result.stop ?? (openingOnly ? 'open' : 'done');
    if (!text(stop)) return { error: `${title} returned no stopping word.` };
    return { result: clone(result), changes: clone(changes), stop };
}

function noteOf(kind, result, setup, title, limits, opening) {
    let lines;
    try {
        lines = kind.note(result, setup, { tokens: limits.noteTokens ?? INTERACTION_NOTE_TOKENS, opening });
    } catch (error) {
        return { error: refused(error, title, 'write its note') };
    }
    if (!Array.isArray(lines) || lines.some(line => typeof line !== 'string')) return { error: `${title} returned no note lines.` };
    return { summary: lines.join(' | ') };
}

/**
 * The `interaction.settle` handler. `kindOrLookup` is the kind or `kindId => kind`; `state` is the
 * transaction state the kind reads; `receipts` answers the store's receipts for a carried segment.
 */
export function settleInteraction(ctx, payload, kindOrLookup, { state = null, receipts = null } = {}) {
    if (ctx.cause !== 'system' || ctx.caller !== null) ctx.fail('REFUSED', 'The interaction is settled before the reply, not called by another command.');
    const kindId = String(payload?.kindId ?? '');
    let kind = null;
    try { kind = typeof kindOrLookup === 'function' ? kindOrLookup(kindId) : kindOrLookup; } catch { kind = null; }
    const title = titleOf(kind, kindId);
    if (!plain(kind)) ctx.fail('NOT_READY', interactionError('NOT_READY', title).message);
    let ready = false;
    try { ready = typeof kind.ready === 'function' && kind.ready() === true; } catch { ready = false; }
    if (!ready) ctx.fail('NOT_READY', interactionError('NOT_READY', title).message);
    if (!Number.isSafeInteger(kind.version) || kind.version < 1 || typeof kind.witness !== 'function'
        || typeof kind.note !== 'function' || (!payload?.opening && (typeof kind.play !== 'function' || typeof kind.settle !== 'function'))) {
        ctx.fail('DAMAGED', damaged(title, `The saved ${title} is damaged.`).message);
    }
    const problem = settlePayloadProblem(payload, kind);
    if (problem) ctx.fail(problem.code, problem.message);

    const setup = clone(payload.setup), stored = clone(payload.steps), openingOnly = payload.opening === true;
    const stream = dice(payload.seed, payload.offset);
    const stepDice = index => stream(index);
    let witnessInput;
    try { witnessInput = kind.witness(state, setup); } catch (error) {
        ctx.fail('FAILED', refused(error, title, 'read its setup'));
    }
    if (!openingOnly && hashJson(witnessInput) !== payload.witness.hash) {
        ctx.fail('NO_LONGER_DONE', interactionError('CHANGED', title).message);
    }

    let completed = { steps: stored, derived: [] };
    if (!openingOnly) {
        let actors;
        try { actors = recordedActors(kind, state, setup, payload.player); } catch (error) {
            ctx.fail('FAILED', refused(error, title, 'name its actors'));
        }
        completed = deriveSteps({ kind, kindId, state, setup, steps: stored, actors, policy: payload.policy, dice: stepDice });
        if (completed.error) ctx.fail(completed.error.code, completed.error.message);
        let preview;
        try { preview = kind.play(state, setup, completed.steps, stepDice); } catch (error) {
            ctx.fail('FAILED', refused(error, title, 'play its step'));
        }
        if (preview && typeof preview.then === 'function') {
            preview.then(null, () => {});
            ctx.fail('FAILED', `${title} did not play at once.`);
        }
        const detail = typeof preview?.error === 'string' ? preview.error : preview?.error?.message;
        if (detail) ctx.fail('NO_LONGER_DONE', detail);
        if (!plain(preview)) ctx.fail('INVALID', interactionError('INVALID', title, `${title} returned no preview.`).message);
    }
    checkPrior(ctx, payload, title, receipts);

    let settled;
    try {
        settled = openingOnly ? kind.opening(state, setup, preludeDice(payload.seed)) : kind.settle(state, setup, completed.steps, stepDice);
    } catch (error) {
        ctx.fail('FAILED', refused(error, title, 'settle'));
    }
    const checkedResult = checked(settled, kind, openingOnly, title);
    if (checkedResult.error) ctx.fail(checkedResult.tooBig ? 'TOO_BIG' : 'INVALID', interactionError(checkedResult.tooBig ? 'TOO_BIG' : 'INVALID', title, checkedResult.error).message);

    const limits = limitsFor(kind);
    const note = noteOf(kind, checkedResult.result, setup, title, limits, openingOnly);
    if (note.error) ctx.fail('FAILED', note.error);

    const sid = ctx.reply?.sid;
    if (!text(sid)) ctx.fail('FAILED', `The ${title} has no reply to settle into.`);
    const claimId = `ia:${kindId}:${payload.key}:reply:${sid}`;
    if (!ctx.claim(claimId)) ctx.fail('CLAIMED', interactionError('CLAIMED', title).message);

    const predicate = { kind: 'interaction', id: kindId, v: payload.version, key: payload.key, setup: ctx.hash(payload),
        ...(payload.prior ? { prior: payload.prior } : {}) };
    ctx.replayGuard({ owner: CORE_MODULE_ID, version: 2, epoch: ctx.epoch, rulesHash: null, predicate,
        inputHash: ctx.hash({ source: ctx.source, predicate, witness: witnessInput }) }, clone(payload));

    const changes = [];
    for (const change of checkedResult.changes) {
        const answer = ctx.call(change.type, clone(change.payload));
        changes.push({ type: change.type, summary: typeof answer?.summary === 'string' ? answer.summary : '' });
    }
    const cut = kindId.indexOf('/');
    const module = cut > 0 ? kindId.slice(0, cut) : CORE_MODULE_ID;
    const kindName = cut > 0 ? kindId.slice(cut + 1) : kindId;
    return {
        summary: note.summary,
        narrate: true,
        replan: true,
        data: {
            v2: { key: claimId, result: checkedResult.result },
            interaction: { module, kind: kindName, key: payload.key, stop: checkedResult.stop, changes },
        },
    };
}
