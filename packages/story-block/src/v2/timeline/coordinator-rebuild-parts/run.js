// The rebuild itself: closes the pending selection, drops the module's checkpoint and asks its participant to rebuild.

import { crashing, fail, isObject, makeId } from '../util.js';
import { REBUILD_CODES } from './constants.js';
import { REBUILD_PROBLEM_CODE, readPlan, rebuildMessage, replyNumberAt } from './plan.js';

const OPEN_RESTORE = Object.freeze(['committed', 'participants-pending', 'acked']);
const OPEN_NATIVE = Object.freeze(['prepared']);
const SETTLED_SELECTION = Object.freeze(['complete', 'rebuilt']);

export function createRebuild(s, deps) {
    const {
        archive, block, callParticipant, durable, headNow, here = () => {}, point = async () => {}, release = null,
        barrier = null, raise = () => {}, problem = null, chat = () => [], fallbackEmpty = null, participants = null,
    } = deps;

    // The callback is the participant's own: it reads the head and publishes its fresh state by `nativeMutation`.
    // Both are refused while this timeline is barred, so the journal is closed first and the barrier comes down for
    // that call. A failure puts a permanent block (with the original cause) back before the caller sees it.
    function lowerForParticipant() {
        if (s) { s.barrierOwner = null; s.barrierEarly = false; }
        block.clear();
        if (typeof barrier === 'function') barrier('idle', '');
    }

    const permanentFor = module => {
        const now = block.current();
        const blockedBy = now?.blockedBy;
        if (!blockedBy || blockedBy.module !== module || !REBUILD_CODES.includes(blockedBy.code)) return null;
        return now;
    };

    const outstanding = (ignore = null) => archive.entries().find(entry => entry.id !== ignore
        && ((entry.kind === 'restore' && OPEN_RESTORE.includes(entry.phase))
            || (entry.kind === 'selection' && !SETTLED_SELECTION.includes(entry.phase))
            || (['native-mutation', 'native-event'].includes(entry.kind) && OPEN_NATIVE.includes(entry.phase)))) ?? null;

    async function rebuild(module, input = {}) {
        if (typeof module !== 'string' || !module) return fail('INVALID', 'rebuild names the module whose dossiers are built again.');
        here();
        const plan = readPlan(input);
        if (!plan.ok) return plan;
        const blockedNow = permanentFor(module);
        if (!blockedNow) return fail('REFUSED', 'This branch is not blocked by a permanent dossier failure, so there is nothing to rebuild.');
        if (participants && typeof participants.get === 'function') {
            const participant = participants.get(module);
            if (!participant) return fail('SNAPSHOT_UNAVAILABLE', `The participant ${module} is not registered.`);
            // Do not discard a selection before learning whether this participant can rebuild it.
            if (typeof participant.rebuild !== 'function') return fail('UNSUPPORTED', `The participant ${module} cannot rebuild its dossiers.`);
        }
        // Until the fallback coordinator confirms its candidates are exhausted, keep the old selection intact.
        let empty = false;
        try { if (typeof fallbackEmpty === 'function') empty = await fallbackEmpty(module); } catch { /* fail closed */ }
        if (empty !== true) return fail('REFUSED', 'Earlier saved points have not all been checked for this branch, so it is not rebuilt yet.');
        const now = headNow();
        if (!now) return fail('NOT_FOUND', 'This chat has no story state yet.');
        const reply = replyNumberAt(now.boundary, chat());
        if (!Number.isInteger(reply) || reply < 1) return fail('NOT_FOUND', 'The rebuild could not find the reply it would start from.');

        const entries = archive.entries();
        const pending = [...entries].reverse().find(entry => entry.kind === 'selection' && !SETTLED_SELECTION.includes(entry.phase)) ?? null;
        const busy = outstanding(pending?.id ?? null);
        if (busy) return fail('RESTORE_PENDING', 'Another change is outstanding in this chat; the dossiers cannot be rebuilt until it has settled.');

        // Close the selection (or keep the closed one from an earlier failed attempt) and drop this module's selected
        // checkpoint. The participant publishes a fresh one from its rebuild callback.
        let entry = pending;
        if (entry) {
            entry = archive.patch(entry.id, { phase: 'rebuilt', slots: { ...(entry.slots ?? {}), [module]: { rebuilt: true } } });
        } else {
            const earlier = [...entries].reverse().find(item => item.kind === 'selection' && item.phase === 'rebuilt');
            entry = earlier
                ? archive.patch(earlier.id, { slots: { ...(earlier.slots ?? {}), [module]: { rebuilt: true } } })
                : archive.add({ id: makeId('hs'), kind: 'selection', phase: 'rebuilt', desired: {}, slots: { [module]: { rebuilt: true } } });
        }
        const selection = { ...archive.selection() };
        delete selection[module];
        archive.select(selection);
        await durable();
        await point('rebuild.journaled');

        lowerForParticipant();
        let answer;
        try {
            answer = await callParticipant(module, 'rebuild', { return: entry.id, read: plan.read, replies: plan.replies });
        } catch (error) {
            if (crashing(error)) throw error;
            answer = fail('FAILED', `The participant ${module} could not rebuild its dossiers: ${error?.message ?? error}`);
        }
        here();
        if (!isObject(answer) || answer.ok !== true) {
            const why = isObject(answer) && typeof answer.message === 'string' && answer.message
                ? answer
                : fail('FAILED', `The participant ${module} could not rebuild its dossiers.`);
            block.note(module, { ...why, code: blockedNow.blockedBy.code });
            return why;
        }
        await point('rebuild.participant');
        await durable();
        if (typeof release === 'function') {
            const released = await release(entry.id);
            if (released && released.ok === false) {
                block.note(module, { ...released, code: blockedNow.blockedBy.code });
                return released;
            }
        }
        // A participant that reads on after answering (`started: true`, with its `progress()`) records nothing yet: the banner's note tells when it is done.
        const started = answer.started === true;
        if (!started) try { problem?.({ module, code: REBUILD_PROBLEM_CODE, message: rebuildMessage(reply) }); } catch { /* the reader's list is optional */ }
        await point('rebuild.completed');
        return { ok: true, module, reply, read: plan.read, replies: plan.replies, rebuilt: entry.id, started };
    }

    return { rebuild };
}
