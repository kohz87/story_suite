// The history replay engine: plans the replay, runs each reply through the live path and installs the finished copy once.

import { HISTORY_REPLAY_MAX_ATTEMPTS } from './limits.js';
import { isRecord, messageOf, failedResult } from './shared-basics.js';
import { declaredCap, fieldOf, fieldCopy, persistedOf } from './catch-up-field.js';
import { makeSink } from './sink.js';

export function createHistoryReplay(deps = {}) {
    const required = ['copyState', 'viewFor', 'runReply', 'stillValid', 'install', 'publishOnce', 'persistCatchUp', 'progress'];
    for (const name of required) {
        if (typeof deps[name] !== 'function') throw new TypeError(`createHistoryReplay requires deps.${name}()`);
    }

    let phase = 'idle';
    let inFlight = false;
    let done = 0;
    let total = 0;
    let older = 0;
    let attempt = 0;
    let reason = '';
    let lastCatchUp = null;
    let lastResult = null;
    let lastError = null;
    let skipRequested = false;

    const snapshot = () => ({
        state: phase,
        status: phase,
        running: inFlight,
        pending: inFlight || Boolean(lastCatchUp && !lastCatchUp.skipped),
        done,
        total,
        older,
        attempt,
        reason,
        skipped: phase === 'skipped',
        installed: lastResult?.installed === true,
        published: lastResult?.published === true,
        canRetry: Boolean(lastCatchUp && !lastCatchUp.skipped && attempt < HISTORY_REPLAY_MAX_ATTEMPTS),
        maxAttempts: HISTORY_REPLAY_MAX_ATTEMPTS,
        catchUp: fieldCopy(lastCatchUp),
        error: lastError,
    });

    function finish(nextPhase, result) {
        phase = nextPhase;
        inFlight = false;
        lastResult = result;
        lastError = result.error ?? null;
        const answer = { ...result, ...snapshot() };
        return answer;
    }

    function failure(code, error, installed = false, published = false) {
        return finish('failed', {
            ok: false, code, error: messageOf(error), message: messageOf(error), installed, published, skipped: false,
        });
    }

    // Skip pressed: the field stays, marked skipped (nothing is installed), and the run ends.
    async function endSkipped(plan) {
        lastCatchUp = fieldOf({ from: plan.from, to: plan.to, reason, attempt, skipped: true });
        try { await deps.persistCatchUp(fieldCopy(lastCatchUp)); }
        catch (error) { return failure('PERSIST_FAILED', error); }
        return finish('skipped', { ok: true, code: 'SKIPPED', skipped: true, installed: false, published: false });
    }

    function planFor(base, replies, requestedReason) {
        const previous = persistedOf(base) ?? lastCatchUp;
        const runReason = requestedReason === undefined || requestedReason === null
            ? (previous?.reason ?? '')
            : String(requestedReason);
        const resumed = Boolean(previous && previous.reason === runReason);
        const cap = declaredCap(deps.cap);

        if (resumed && previous.skipped) {
            return { previous, resumed, runReason, cap, alreadySkipped: true };
        }

        const length = replies.length;
        let from = Math.max(0, length - cap);
        let to = length - 1;
        let indexes = null;
        let offset = 0;

        if (resumed) {
            const span = previous.to - previous.from + 1;
            if (previous.to < length) {
                from = previous.from;
                to = previous.to;
            } else if (length === span) {
                from = previous.from;
                to = previous.to;
                offset = previous.from;
            } else {
                return { previous, resumed, runReason, cap, stalePlan: true };
            }
            indexes = Array.from({ length: to - from + 1 }, (_unused, index) => offset + index);
        } else {
            indexes = Array.from({ length: Math.max(0, length - from) }, (_unused, index) => from + index);
        }

        return {
            previous, resumed, runReason, cap,
            from, to, indexes,
            older: resumed ? Math.max(0, from) : Math.max(0, length - cap),
            total: indexes.length,
            nextAttempt: resumed ? previous.attempt + 1 : 1,
        };
    }

    async function run({ base = null, replies = [], reason: requestedReason } = {}) {
        if (inFlight) return { ok: false, code: 'BUSY', message: 'A history replay is already running.', ...snapshot() };
        if (!Array.isArray(replies)) return { ok: false, code: 'INVALID', message: 'replies must be an array.', ...snapshot() };

        const source = replies.slice();
        const plan = planFor(base, source, requestedReason);
        done = 0;
        total = plan.total ?? 0;
        older = plan.older ?? 0;
        reason = plan.runReason ?? '';
        attempt = plan.previous?.attempt ?? 0;
        skipRequested = false;
        lastError = null;
        phase = 'running';
        inFlight = true;

        if (plan.alreadySkipped) {
            lastCatchUp = fieldCopy(plan.previous);
            attempt = plan.previous.attempt;
            return finish('skipped', {
                ok: true, code: 'SKIPPED', skipped: true, installed: false, published: false,
            });
        }

        if (plan.stalePlan) {
            lastCatchUp = fieldCopy(plan.previous);
            attempt = plan.previous.attempt;
            return finish('stale', {
                ok: false, code: 'STALE', skipped: false, installed: false, published: false,
                error: 'The saved replay range does not match the supplied replies.',
            });
        }

        attempt = plan.nextAttempt;
        if (attempt > HISTORY_REPLAY_MAX_ATTEMPTS) {
            lastCatchUp = fieldCopy(plan.previous);
            attempt = plan.previous.attempt;
            return finish('blocked', {
                ok: false, code: 'RETRY_CAP', skipped: false, installed: false, published: false,
                error: `History replay stopped after ${HISTORY_REPLAY_MAX_ATTEMPTS} attempts.`,
            });
        }

        if (plan.indexes.length === 0) {
            lastCatchUp = null;
            try { await deps.persistCatchUp(null); }
            catch (error) { return failure('PERSIST_FAILED', error); }
            return finish('done', { ok: true, code: 'EMPTY', skipped: false, installed: false, published: false });
        }

        lastCatchUp = fieldOf({ from: plan.from, to: plan.to, reason, attempt });
        try { await deps.persistCatchUp(fieldCopy(lastCatchUp)); }
        catch (error) { return failure('PERSIST_FAILED', error); }

        try { await deps.progress({ done: 0, total }); }
        catch (error) { return failure('PROGRESS_FAILED', error); }

        if (skipRequested) {
            return endSkipped(plan);
        }

        let copy;
        try { copy = await deps.copyState(base); }
        catch (error) { return failure('COPY_FAILED', error); }
        if (isRecord(copy) && Object.hasOwn(copy, 'catchUp')) delete copy.catchUp;

        const start = Object.freeze({ base, replies: source, reason, from: plan.from, to: plan.to, older, attempt });
        const sink = makeSink();

        for (const replyIndex of plan.indexes) {
            if (skipRequested) break;
            sink.replyIndex = replyIndex;
            try {
                const view = await deps.viewFor(replyIndex);
                const answer = await deps.runReply(copy, view, sink);
                if (failedResult(answer)) throw answer instanceof Error ? answer : new Error(answer?.message || 'runReply failed');
            } catch (error) {
                return failure('REPLY_FAILED', error);
            }
            done += 1;
            try { await deps.progress({ done, total }); }
            catch (error) { return failure('PROGRESS_FAILED', error); }
            if (skipRequested) break;
        }

        if (skipRequested) {
            return endSkipped(plan);
        }

        let valid = false;
        try { valid = await deps.stillValid(start); }
        catch (error) { return failure('STALE', error); }
        if (!valid) {
            lastCatchUp = fieldOf({ from: plan.from, to: plan.to, reason, attempt });
            return finish('stale', {
                ok: false, code: 'STALE', skipped: false, installed: false, published: false,
                error: 'The chat, lineage or head changed during history replay.',
            });
        }

        if (skipRequested) {
            return endSkipped(plan);
        }

        try {
            const installed = await deps.install(copy);
            if (failedResult(installed)) throw installed instanceof Error ? installed : new Error(installed?.message || 'install failed');
        } catch (error) {
            return failure('INSTALL_FAILED', error);
        }

        // The dossiers are installed: a publication that fails is retried by the normal publication path, it does not undo or fail the catch-up.
        let published = true;
        try { await deps.publishOnce(); }
        catch (error) { published = false; try { deps.retryPublish?.(error); } catch { /* the next durable change publishes it */ } }

        try { await deps.persistCatchUp(null); }
        catch (error) { return failure('PERSIST_FAILED', error, true, published); }

        lastCatchUp = null;
        return finish('done', { ok: true, code: 'DONE', skipped: false, installed: true, published });
    }

    async function skip() {
        if (!inFlight) {
            if (lastCatchUp && !lastCatchUp.skipped) {
                const field = { ...lastCatchUp, skipped: true };
                lastCatchUp = field;
                try { await deps.persistCatchUp(fieldCopy(field)); }
                catch (error) { return failure('PERSIST_FAILED', error); }
                phase = 'skipped';
                lastResult = { ok: true, code: 'SKIPPED', skipped: true, installed: false, published: false };
                return snapshot();
            }
            return snapshot();
        }
        skipRequested = true;
        return snapshot();
    }

    return { run, skip, status: snapshot };
}
