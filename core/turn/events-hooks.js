// Story Suite v2: the hooks run on a received reply, moved out of createEvents unchanged: afterReply (the assist extractor, not awaited) and afterReceive
// (the plan the RPG held lets go). `createReplyHooks(s, deps)` is given the turn's state holder `s` and the turn parts it uses; `captureLate` is the
// late-lines capture an afterReply hook's `capture` runs.
import { missingProblem, repairOutcome } from './events-missing.js';

export function createReplyHooks(s, deps) {
    const { ia, store, problem, events, registry, view, captureLate, keepLog = () => {} } = deps;

    // afterReply (the assist extractor, run after every reply; `lines` are the change lines its capture read): not awaited, a failure is
    // logged. `capture(text, { index, swipe })` runs lines as story captures on that reply while it is the head on the same swipe.
    // A send waits for these runs briefly (assistPending, ASSIST_WAIT_MS).
    function afterReply(index, type, message, lines = [], missing = false) {
        const swipe = Number.isInteger(message?.swipe_id) ? message.swipe_id : 0;
        const sid = store.carrierSid?.(index) ?? null;   // the reply's identity for a late answer (captureAssist)
        const runs = [];
        const results = [];
        for (const { moduleId, fn } of registry.hookEntries('afterReply')) {
            runs.push(Promise.resolve()
                .then(() => fn({ index, swipe, sid, type, lines: [...lines], mes: String(message?.mes ?? ''), missing: missing === true, capture: (text, at = { index, swipe }, opts = {}) => captureLate({ ...at, sid, message }, text, opts) }))
                .then(value => { results.push(value); })
                .catch(error => problem({ module: moduleId, index, code: 'FAILED', message: `afterReply failed: ${error?.message ?? error}` }))
                // C2-ext: what the hook made of the reply (the extractor read it, or failed to) can change
                // the reply's note, so the notes are drawn again.
                .finally(() => { if (store.headIndex() === index) events?.emit('head', { index }); }));
        }
        const all = Promise.allSettled(runs).then(() => {
            if (s.assistPending === all) s.assistPending = null;
            // A reply with no block and nothing stored for it (no repair, or it failed or found nothing) is a Problems row, once.
            if (missing === true && ctxSame(index, message, sid)) {
                const item = missingProblem(index, message.mes, repairOutcome(results));
                // (one row per reply: a Re-read that asked again makes the row's text the latest outcome; one that did not ask leaves it)
                const old = s.problemLog.find(row => row.code === 'NO_CHANGES' && row.index === index && row.sid === sid);
                if (item) {
                    if (old) { if (repairOutcome(results) !== 'off') old.message = item.message; }
                    else problem({ ...item, sid, quiet: true });
                } else if (old) s.problemLog.splice(s.problemLog.indexOf(old), 1);   // (a Re-read's repair stored lines: the warning of the earlier miss is out of date)
                keepLog();
            }
        });
        if (!runs.length && missing !== true) return;
        s.assistPending = all;
    }

    // The reply is still the one asked about (not swiped, replaced or deleted while the hooks ran).
    function ctxSame(index, message, sid) {
        return store.headIndex() === index && (!sid || store.carrierSid?.(index) === sid) && Boolean(message);
    }

    // afterReceive: every reply that arrives, with or without change lines, once its lines have been read and before it is
    // saved (the RPG lets go of the plan it held for the reply). Nothing is asked of it; a failure is a Problem.
    function receivedHooks(index, type) {
        for (const { moduleId, fn } of registry.hookEntries('afterReceive')) {
            try { fn(view(), { index, type }); } catch (error) {
                problem({ module: moduleId, index, code: 'FAILED', message: `afterReceive failed: ${error?.message ?? error}` });
            }
        }
        // The core's own: an interaction reply opens its next segment (or closes it); a chat that never used one has nothing to do (interaction/hooks.js).
        try { ia.afterReceive(view(), { index, type }); } catch (error) {
            problem({ module: 'story-block', index, code: 'FAILED', message: `afterReceive failed: ${error?.message ?? error}` });
        }
    }

    return { afterReply, receivedHooks };
}
