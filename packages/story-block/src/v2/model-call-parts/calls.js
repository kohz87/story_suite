// The rules around a model call: one in flight per module, a time limit, the feature switch and the queue.

import { answerText } from '../assist/st-adapter.js';
import { MODEL_CALL_TIMEOUT_MS, MODEL_CALL_TIMEOUT_MIN, MODEL_CALL_TIMEOUT_MAX, MODEL_CALL_TOKENS } from './limits.js';
import { MODEL_CALL_TOKENS_MAX } from './shared-consts.js';
import { MODEL_CALL_ERRORS, MODEL_CALL_TEXT } from './messages.js';
import { CallError, safeReason } from './errors.js';
import { profileName } from './profiles.js';
import { stModelCall } from './st-call.js';
import { createCallQueue } from './queue.js';
import { fill, now } from './shared-helpers.js';

const intIn = (value, min, max, fallback) => (Number.isFinite(value) && value > 0 ? Math.min(max, Math.max(min, Math.round(value))) : fallback);

/**
 * The rules around a model call. `deps`: { call(prompt, { maxTokens, profile, system, signal }) → text
 * (stModelCall by default; the runtime's `callModel` option, the testkit's fake), featureOn(id) → bool,
 * featureModule(id) → the module id that declares it (or null), timeoutMs (MODEL_CALL_TIMEOUT_MS), log(line),
 * timer ({ setTimeout, clearTimeout }), gate?: { whenIdle() → Promise } (a call on the chat's connection
 * waits for it: no reply in progress; a profile's call does not), queue?: createCallQueue() (one call at a time
 * per connection; default: a queue of its own) }.
 * Returns { callModel(request), busy(module) }: `callModel({ profile, system, prompt, maxTokens, signal,
 * feature, module, timeoutMs })` → Promise<{ ok: true, text, error: null } | { ok: false, text: '', error
 * (a MODEL_CALL_ERRORS code), message }>, never rejecting. The module is `module`, else the owner of
 * `feature`, else '' (callers that name neither share one slot).
 */
export function createModelCalls({ call = stModelCall, featureOn = () => true, featureModule = () => null, timeoutMs = MODEL_CALL_TIMEOUT_MS, log = line => console.info(line), timer = globalThis, gate = null, queue = createCallQueue() } = {}) {
    const inFlight = new Set();
    const defaultTimeout = intIn(timeoutMs, MODEL_CALL_TIMEOUT_MIN, MODEL_CALL_TIMEOUT_MAX, MODEL_CALL_TIMEOUT_MS);
    const fail = (error, message) => ({ ok: false, text: '', error, message });
    const tell = (module, profile, started, outcome) => {
        try {
            log(`[Story Suite] model call: ${module || 'a module'}, ${profile || 'the chat\'s connection'}, ${Math.max(0, Math.round(now() - started))} ms, ${outcome}`);
        } catch { /* a log that fails changes nothing */ }
    };

    // `internal` (the host's own calls, never the sdk's): { idle: false } skips the whenIdle wait (the
    // pre-roll asks while the reply is being prepared).
    async function callModel(request = {}, internal = {}) {
        const started = now();
        const req = request && typeof request === 'object' ? request : {};
        const feature = typeof req.feature === 'string' && req.feature.trim() ? req.feature.trim() : null;
        let owner = '';
        try { owner = typeof req.module === 'string' && req.module.trim() ? req.module.trim() : feature ? String(featureModule(feature) ?? '') : ''; } catch { owner = ''; }
        const profile = profileName(req.profile);
        const done = (result, outcome = result.ok ? 'ok' : result.error) => {
            tell(owner, profile, started, outcome);
            return result;
        };
        if (typeof req.prompt !== 'string' || !req.prompt.trim()) return done(fail(MODEL_CALL_ERRORS.BAD_REQUEST, MODEL_CALL_TEXT.noPrompt));
        if (req.system !== undefined && req.system !== null && typeof req.system !== 'string') return done(fail(MODEL_CALL_ERRORS.BAD_REQUEST, MODEL_CALL_TEXT.noSystem));
        let on = true;
        if (feature) {
            try { on = featureOn(feature) === true; } catch { on = false; }
        }
        if (!on) return done(fail(MODEL_CALL_ERRORS.FEATURE_OFF, fill(MODEL_CALL_TEXT.featureOff, { feature })));
        const signal = req.signal ?? null;
        if (signal?.aborted) return done(fail(MODEL_CALL_ERRORS.ABORTED, MODEL_CALL_TEXT.aborted));
        if (inFlight.has(owner)) return done(fail(MODEL_CALL_ERRORS.BUSY, fill(MODEL_CALL_TEXT.busy, { module: owner || 'This module' })));

        const limit = intIn(req.timeoutMs, MODEL_CALL_TIMEOUT_MIN, MODEL_CALL_TIMEOUT_MAX, defaultTimeout);
        const maxTokens = intIn(req.maxTokens, 1, MODEL_CALL_TOKENS_MAX, MODEL_CALL_TOKENS);
        const inner = new AbortController();
        inFlight.add(owner);
        let handle = null;
        let onAbort = null;
        try {
            const stop = new Promise(resolve => {
                handle = timer.setTimeout(() => resolve(fail(MODEL_CALL_ERRORS.TIMEOUT, fill(MODEL_CALL_TEXT.timeout, { seconds: Math.round(limit / 100) / 10 }))), limit);
                if (signal && typeof signal.addEventListener === 'function') {
                    onAbort = () => resolve(fail(MODEL_CALL_ERRORS.ABORTED, MODEL_CALL_TEXT.aborted));
                    signal.addEventListener('abort', onAbort, { once: true });
                }
            });
            const answer = (async () => {
                try {
                    // The chat's connection waits for a reply in progress (the time limit and signal still hold).
                    if (!profile && internal?.idle !== false && typeof gate?.whenIdle === 'function') {
                        await Promise.race([gate.whenIdle(), new Promise(resolve => inner.signal.addEventListener('abort', resolve, { once: true }))]);
                        if (inner.signal.aborted) return fail(MODEL_CALL_ERRORS.ABORTED, MODEL_CALL_TEXT.aborted);
                    }
                    // One at a time per connection (the queue); a call that runs out of time or is cancelled
                    // while it waits leaves it (inner.signal) and is never made.
                    const text = await queue.run(profile, () => call(req.prompt, { maxTokens, profile, system: typeof req.system === 'string' ? req.system : '', signal: inner.signal }), { signal: inner.signal });
                    const out = typeof text === 'string' ? text : answerText(text);
                    return out.trim() ? { ok: true, text: out, error: null } : fail(MODEL_CALL_ERRORS.EMPTY, MODEL_CALL_TEXT.empty);
                } catch (error) {
                    if (error?.code === 'QUEUE_LEFT') return fail(MODEL_CALL_ERRORS.ABORTED, MODEL_CALL_TEXT.aborted);
                    if (error instanceof CallError) return fail(error.code, error.message);
                    return fail(MODEL_CALL_ERRORS.FAILED, fill(MODEL_CALL_TEXT.failed, { why: safeReason(error) }));
                }
            })();
            const result = await Promise.race([answer, stop]);
            // Timed out or cancelled: the call is told to stop (a profile's request is cut off; the chat's
            // connection cannot be, and its late answer is dropped).
            if (!result.ok && (result.error === MODEL_CALL_ERRORS.TIMEOUT || result.error === MODEL_CALL_ERRORS.ABORTED)) inner.abort();
            return done(result);
        } catch (error) {
            return done(fail(MODEL_CALL_ERRORS.FAILED, fill(MODEL_CALL_TEXT.failed, { why: safeReason(error) })));
        } finally {
            inFlight.delete(owner);
            if (handle !== null) timer.clearTimeout(handle);
            if (onAbort) signal.removeEventListener?.('abort', onAbort);
        }
    }

    return { callModel, busy: module => inFlight.has(String(module ?? '')), queue };
}
