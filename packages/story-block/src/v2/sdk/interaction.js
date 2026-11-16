// Coordinates the unsent interaction in chat metadata: open, stage, auto, send, discard and the current view.

import { interactionError, limitsFor } from '../interaction/contract.js';
import { dice, interactionSeed } from '../interaction/dice.js';
import { STORY_ACTION_POLICY, policyProblem } from '../interaction/policy.js';
import { markSend } from '../interaction/send.js';
import { discardHeld } from '../interaction/held.js';
import { actorsOf, currentFor, playPreview } from '../interaction/preview.js';
import { createSession, stageInteraction } from '../interaction/session.js';
import { hashJson } from '../replay.js';
import { hashText } from '../assist/common.js';
import { readRecord } from '../persist.js';

const META_KEY = 'storySuiteInteraction';
const plain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.length > 0;
const whole = value => Number.isSafeInteger(value) && value >= 0;
const titleOf = kind => String(kind?.title ?? 'interaction').trim() || 'interaction';
const clone = value => structuredClone(value);
const failed = (code, kind, detail) => interactionError(code, titleOf(kind), detail);

function kindOf(registry, kindId) {
    if (!text(kindId)) return null;
    try {
        const indexed = typeof registry?.interaction === 'function' ? registry.interaction(kindId) : null;
        if (indexed) return indexed.definition ?? indexed.def ?? indexed.kindDef ?? indexed;
        const at = kindId.indexOf('/');
        if (at < 1 || at === kindId.length - 1) return null;
        return registry?.module?.(kindId.slice(0, at))?.interactions?.[kindId.slice(at + 1)] ?? null;
    } catch {
        return null;
    }
}

function metaOf(readMeta) {
    try {
        const value = readMeta();
        return plain(value) ? value : null;
    } catch {
        return null;
    }
}

function boxOf(meta, create = false) {
    if (!plain(meta)) return null;
    if (!plain(meta[META_KEY])) {
        if (!create) return null;
        meta[META_KEY] = {};
    }
    return meta[META_KEY];
}

function sessionOf(box, id) {
    return plain(box?.open) && text(id) && box.open.id === id ? box.open : null;
}

function readHead(head) {
    try {
        const found = head();
        if (text(found)) return { sid: found };
        return plain(found) && text(found.sid) ? found : null;
    } catch {
        return null;
    }
}

function pendingOf(chat) {
    try {
        const list = chat();
        const last = Array.isArray(list) ? list.at(-1) : null;
        const anchor = readRecord(Array.isArray(list) ? list.at(-2) : null)?.sid;
        if (!last?.is_user || !text(anchor)) return null;
        const message = hashText(String(last.mes ?? '').trim());
        return text(message) ? { anchor, message } : null;
    } catch {
        return null;
    }
}

function personaOf(persona) {
    try {
        return typeof persona === 'function' ? String(persona() ?? '') : String(persona ?? '');
    } catch {
        return '';
    }
}

function stateOf(state) {
    try {
        return typeof state === 'function' ? state() : state;
    } catch {
        return null;
    }
}

function readKind(kind) {
    return Boolean(kind) && Number.isSafeInteger(kind.version) && kind.version > 0
        && typeof kind.open === 'function' && typeof kind.witness === 'function' && typeof kind.validate === 'function'
        && typeof kind.play === 'function' && typeof kind.settle === 'function' && typeof kind.note === 'function'
        && typeof kind.ready === 'function' && typeof kind.title === 'string' && Array.isArray(kind.changes);
}

function ready(kind, title) {
    if (typeof kind?.ready !== 'function') return null;
    let answer = true;
    try {
        answer = kind.ready();
    } catch {
        answer = false;
    }
    return answer === false ? interactionError('NOT_READY', title) : null;
}

function featureProblem(kind, featureOn, title, label = null) {
    if (!text(kind?.feature)) return null;
    let on = true;
    try {
        on = featureOn(kind.feature) !== false;
    } catch {
        on = false;
    }
    // (the reader sees the feature's name, never its id)
    return on ? null : interactionError('FEATURE_OFF', title, text(label) ? `the ${label.trim()} feature` : 'its feature in the Features');
}

function success(current) {
    return current ? { ok: true, ...current } : { ok: true };
}

/** Creates `sdk.interaction` from a registry, the chat metadata and the head/state readers. */
export function createInteractionApi({
    registry,
    store = null,
    chat = () => [],
    meta: readMeta = () => null,
    save = () => {},
    state = () => store?.head?.(),
    head = () => null,
    persona = '',
    policy = STORY_ACTION_POLICY,
    featureOn = id => registry?.featureOn?.(id) ?? true,
    query = null,
    preview = null,
} = {}) {
    const persist = () => { try { save(); } catch { /* the in-memory choice stands */ } };
    const stateNow = () => stateOf(state);
    // A session with an opening is played on the state its opening leaves (the reply's preludes run opening first; `preview(payload, seed, state)` → that state).
    const stateFor = session => {
        const head = stateNow();
        if (!plain(session?.opening) || typeof preview !== 'function') return head;
        try { return preview(session.opening.payload, session.opening.seed, head) ?? head; } catch { return head; }
    };
    const ask = (name, args) => (typeof query === 'function' ? query(name, args) : undefined);

    function open(kindId, args = {}) {
        const kind = kindOf(registry, kindId);
        if (!kind) return interactionError('NOT_READY', 'interaction');
        const title = titleOf(kind);
        try {
            for (const problem of [ready(kind, title), featureProblem(kind, featureOn, title, registry?.feature?.(kind.feature)?.label)]) if (problem) return problem;
            if (!readKind(kind)) return failed('DAMAGED', kind);
            const meta = metaOf(readMeta);
            if (!meta) return failed('DAMAGED', kind, `The ${title}'s chat metadata is not available.`);
            const before = boxOf(meta);
            if (plain(before?.open)) return interactionError('BUSY', title, titleOf(kindOf(registry, before.open.kindId)));
            const reply = readHead(head);
            if (!reply) return interactionError('NO_REPLY', title);
            const attempts = plain(before?.attempts) ? before.attempts : {};
            const attempt = whole(attempts[reply.sid]) ? attempts[reply.sid] : 0;
            const seed = interactionSeed(reply.sid, attempt, kindId);
            const start = plain(before?.start) && before.start.kindId === kindId && before.start.anchor === reply.sid ? before.start : null;
            let opened;
            try {
                // (a fight a pre-check offered opens on the sheet its opening leaves: the foes it found stand there)
                opened = kind.open(stateFor({ opening: start?.opening }), { anchor: reply.sid, seed, attempt, args: clone(args), query: (name, data) => ask(name, data) });
            } catch (error) {
                return interactionError('INVALID', title, `${title} could not open: ${error?.message ?? error}`);
            }
            if (plain(opened?.error)) return opened.error;
            if (typeof opened?.error === 'string') return interactionError('INVALID', title, opened.error);
            if (!plain(opened) || !plain(opened.setup)) return interactionError('INVALID', title, `${title} returned no setup.`);
            const session = createSession({
                origin: reply.sid,
                anchor: reply.sid,
                attempt,
                kindId,
                version: kind.version,
                seed,
                setup: opened.setup,
                opening: plain(start?.opening) ? start.opening : null,
            });
            if (!session) return failed('DAMAGED', kind);
            const played = playPreview(kind, stateFor(session), session, personaOf(persona), title);
            if (played.error) return played.error;
            const box = boxOf(meta, true);
            box.open = session;
            delete box.send;
            persist();
            return success(currentFor(box, kindId, kind, stateFor(session), personaOf(persona), title));
        } catch (error) {
            return failed('DAMAGED', kind, `${title} could not open: ${error?.message ?? error}`);
        }
    }

    function stage(id, step) {
        const meta = metaOf(readMeta);
        const box = boxOf(meta);
        const session = sessionOf(box, id);
        if (!session) return interactionError('ENDED', 'interaction');
        const kind = kindOf(registry, session.kindId);
        if (!kind) return failed('NOT_READY', { title: session.kindId });
        const title = titleOf(kind);
        try {
            for (const problem of [ready(kind, title), featureProblem(kind, featureOn, title, registry?.feature?.(kind.feature)?.label)]) if (problem) return problem;
            const actors = actorsOf(kind, stateFor(session), session.setup, personaOf(persona), title);
            if (actors.error) return actors.error;
            if (session.steps.length) {
                const now = playPreview(kind, stateFor(session), session, personaOf(persona), title);
                if (!now.error && now.preview.stop !== 'open') return interactionError('ENDED', title);
            }
            const next = stageInteraction({
                session,
                step,
                kind,
                kindId: session.kindId,
                state: stateFor(session),
                actors: actors.actors,
                policy,
            });
            if (next.error) return next.error;
            box.open = clone(next.session);
            persist();
            return success(currentFor(box, session.kindId, kind, stateFor(session), personaOf(persona), title));
        } catch (error) {
            return failed('DAMAGED', kind, `${title} could not stage that step: ${error?.message ?? error}`);
        }
    }

    function auto(id, n = 1) {
        if (!Number.isSafeInteger(n) || n < 1) return interactionError('INVALID', 'interaction', 'Choose how many steps Auto plays.');
        const meta = metaOf(readMeta);
        const box = boxOf(meta);
        let session = sessionOf(box, id);
        if (!session) return interactionError('ENDED', 'interaction');
        const kind = kindOf(registry, session.kindId);
        if (!kind) return failed('NOT_READY', { title: session.kindId });
        const title = titleOf(kind);
        try {
            for (const problem of [ready(kind, title), featureProblem(kind, featureOn, title, registry?.feature?.(kind.feature)?.label)]) if (problem) return problem;
            if (typeof kind.auto !== 'function') return interactionError('REFUSED', title);
            let done = 0;
            while (done < n) {
                if (session.invalidated) return interactionError('ENDED', title, `The earlier ${title} was taken back. Restore that reply or discard it.`);
                if (session.steps.length >= limitsFor(kind).steps) return interactionError('ENDED', title, `The ${title} has all the steps it can hold.`);
                const before = playPreview(kind, stateFor(session), session, personaOf(persona), title);
                if (before.error) return before.error;
                if (before.preview.stop !== 'open') break;
                const actors = actorsOf(kind, stateFor(session), session.setup, personaOf(persona), title);
                if (actors.error) return actors.error;
                const livePolicy = session.policy ?? policy ?? STORY_ACTION_POLICY;
                const choosers = actors.actors.filter(actor => !policyProblem(livePolicy, session.kindId, actors.actors, { actor: actor.id }));
                if (!choosers.length) return interactionError('NOT_YOURS', title);
                const source = dice(session.seed, session.offset)(session.steps.length);
                const inputs = [];
                for (const actor of choosers) {
                    let input;
                    try {
                        input = kind.auto(stateFor(session), session.setup, session.steps, actor.id, source);
                    } catch (error) {
                        return interactionError('INVALID', title, `${title} could not choose for ${String(actor.name ?? actor.id)}: ${error?.message ?? error}`);
                    }
                    if (!plain(input) || !text(input.choice)) return interactionError('INVALID', title, `${title} did not choose for ${String(actor.name ?? actor.id)}.`);
                    if (input.actor !== undefined && String(input.actor) !== String(actor.id)) return interactionError('INVALID', title, `${title} chose for the wrong actor.`);
                    inputs.push({ ...clone(input), actor: actor.id });
                }
                const next = stageInteraction({
                    session,
                    step: { inputs },
                    kind,
                    kindId: session.kindId,
                    state: stateFor(session),
                    actors: actors.actors,
                    policy: livePolicy,
                });
                if (next.error) return next.error;
                session = next.session;
                box.open = clone(session);
                done += 1;
                if (next.preview?.stop !== 'open') break;
            }
            persist();
            const current = currentFor(box, session.kindId, kind, stateFor(session), personaOf(persona), title);
            return current ? { ok: true, staged: done, ...current } : { ok: true, staged: done };
        } catch (error) {
            return failed('DAMAGED', kind, `${title} could not play Auto: ${error?.message ?? error}`);
        }
    }

    function send(id) {
        const meta = metaOf(readMeta);
        const box = boxOf(meta);
        const session = sessionOf(box, id);
        if (!session) return interactionError('ENDED', 'interaction');
        const kind = kindOf(registry, session.kindId);
        if (!kind) return failed('NOT_READY', { title: session.kindId });
        const title = titleOf(kind);
        try {
            for (const problem of [ready(kind, title), featureProblem(kind, featureOn, title, registry?.feature?.(kind.feature)?.label)]) if (problem) return problem;
            if (!session.steps.length) return interactionError('NO_INPUT', title);
            if (session.invalidated) return interactionError('CHANGED', title, `The earlier ${title} was taken back. Restore that reply or discard it.`);
            const pending = pendingOf(chat);
            if (!pending || pending.anchor !== session.anchor) {
                return interactionError('CHANGED', title, `The message to send with the ${title} is not waiting any more.`);
            }
            let witness;
            try {
                witness = hashJson(kind.witness(stateFor(session), session.setup));
            } catch (error) {
                return interactionError('INVALID', title, `${title} could not read its setup: ${error?.message ?? error}`);
            }
            if (!plain(session.witness) || session.witness.hash !== witness || session.witness.offset !== session.offset) {
                return interactionError('CHANGED', title);
            }
            const played = playPreview(kind, stateFor(session), session, personaOf(persona), title);
            if (played.error) return played.error;
            if (!markSend(box, pending, session)) return interactionError('CHANGED', title);
            persist();
            return success(currentFor(box, session.kindId, kind, stateFor(session), personaOf(persona), title));
        } catch (error) {
            return failed('DAMAGED', kind, `${title} could not be sent: ${error?.message ?? error}`);
        }
    }

    function discard(id) {
        const meta = metaOf(readMeta);
        const box = boxOf(meta);
        const session = sessionOf(box, id);
        if (!session) return interactionError('ENDED', 'interaction');
        const kind = kindOf(registry, session.kindId);
        const title = kind ? titleOf(kind) : String(session.kindId ?? 'interaction').split('/').at(-1) || 'interaction';
        try {
            if (!plain(box.attempts)) box.attempts = {};
            box.attempts[session.origin] = (whole(box.attempts[session.origin]) ? box.attempts[session.origin] : session.attempt ?? 0) + 1;
            if (plain(box.send) && box.send.anchor === session.anchor) delete box.send;
            // A held reply keeps its marker (regenerate it); it is only marked discarded so a restore no longer resumes it. A waiting choice goes.
            discardHeld(meta, session.id);
            if (plain(box.start) && box.start.id === session.id) delete box.start;
            delete box.open;
            persist();
            return { ok: true, discarded: true, id: session.id, kindId: session.kindId, title };
        } catch (error) {
            return failed('DAMAGED', kind, `${title} could not be discarded: ${error?.message ?? error}`);
        }
    }

    function current() {
        try {
            const box = boxOf(metaOf(readMeta));
            const session = plain(box?.open) ? box.open : null;
            if (!session) return null;
            const kind = kindOf(registry, session.kindId);
            if (!kind) return null;
            return currentFor(box, session.kindId, kind, stateFor(session), personaOf(persona), titleOf(kind));
        } catch {
            return null;
        }
    }

    // Every refusal carries ok:false (§1.2).
    const refusing = fn => (...args) => {
        const answer = fn(...args);
        return plain(answer) && answer.ok === undefined && text(answer.code) ? { ok: false, ...answer } : answer;
    };
    return Object.freeze({ version: 1, open: refusing(open), stage: refusing(stage), auto: refusing(auto), send: refusing(send), discard: refusing(discard), current });
}
