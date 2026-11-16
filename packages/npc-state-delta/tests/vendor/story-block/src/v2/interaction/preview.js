// Plays the open interaction's preview for the sdk: the kind's actors, derived inputs, play and view, and the current snapshot.

import { interactionError } from './contract.js';
import { dice } from './dice.js';
import { deriveSteps } from './derive.js';
import { defaultActors, markPlayer } from './player.js';
import { STORY_ACTION_POLICY } from './policy.js';

const plain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const titleOf = kind => String(kind?.title ?? 'interaction').trim() || 'interaction';
const clone = value => structuredClone(value);

/** True when a value is plain JSON (no functions, undefined, NaN or class instances). */
export function isJson(value) {
    if (value === null || ['string', 'boolean'].includes(typeof value)) return true;
    if (typeof value === 'number') return Number.isFinite(value);
    if (Array.isArray(value)) return value.every(isJson);
    if (plain(value) && Object.getPrototypeOf(value) === Object.prototype) return Object.values(value).every(isJson);
    return false;
}

export function actorsOf(kind, state, setup, persona, title) {
    let actors;
    try {
        if (typeof kind?.actors !== 'function') return { actors: defaultActors(persona) };
        actors = kind.actors(state, setup);
    } catch (error) {
        return { error: interactionError('INVALID', title, `${title} could not read its actors: ${error?.message ?? error}`) };
    }
    return { actors: markPlayer(actors, persona) };
}

export function playPreview(kind, state, session, persona, title) {
    const actors = actorsOf(kind, state, session.setup, persona, title);
    if (actors.error) return actors;
    const livePolicy = session.policy ?? STORY_ACTION_POLICY;
    const completed = deriveSteps({
        kind,
        kindId: session.kindId,
        state,
        setup: session.setup,
        steps: session.steps,
        actors: actors.actors,
        policy: livePolicy,
        dice: index => dice(session.seed, session.offset)(index),
    });
    if (completed.error) return completed;
    try {
        const preview = kind.play(state, session.setup, completed.steps, dice(session.seed, session.offset));
        if (!plain(preview)) return { error: interactionError('INVALID', title, `${title} returned no preview.`) };
        if (plain(preview.error)) return { error: preview.error };
        if (typeof preview.error === 'string') return { error: interactionError('INVALID', title, preview.error) };
        return { preview, steps: completed.steps };
    } catch (error) {
        return { error: interactionError('INVALID', title, `${title} could not play that step: ${error?.message ?? error}`) };
    }
}

export function currentFor(box, kindId, kind, state, persona, title) {
    const session = plain(box?.open) && box.open.kindId === kindId ? box.open : null;
    if (!session) return null;
    const played = playPreview(kind, state, session, persona, title);
    let view = null;
    if (!played.error) {
        try {
            view = typeof kind.view === 'function'
                ? kind.view(state, session.setup, played.steps, played.preview)
                : played.preview?.view ?? null;
        } catch {
            view = played.preview?.view ?? null;
        }
        if (!isJson(view ?? null)) view = null;
    }
    const sent = plain(box?.send) && box.send.anchor === session.anchor;
    const invalidated = session.invalidated === true;
    return {
        id: session.id,
        kindId: session.kindId,
        title,
        state: invalidated ? 'invalidated' : sent ? 'sent' : session.steps.length ? 'staged' : 'open',
        steps: clone(session.steps),
        canSend: !invalidated && !sent && session.steps.length > 0,
        canDiscard: true,
        view: view === undefined ? null : clone(view),
    };
}
