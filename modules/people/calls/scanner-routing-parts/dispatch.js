/* NPC State Delta: the one scanner provider call, routed, guarded and timed. */
import { SCANNER_REQUEST_TIMEOUT_MS, normalizeScannerMaxOutputTokens } from './shared-limits.js';
import { scannerRoutingError, isScannerRoutingError, stoppedError } from './errors.js';
import { configuredScannerMaxOutputTokens, selectedScannerProfileId, connectionManagerDisabled } from './profile-settings.js';
import { inflight, metrics } from './request-tracking.js';

// The one place the scanner waits for the model: a caller (a history replay) may step aside for that wait, so live readers see the live state.
let aroundWait = promise => promise;
export function setScannerWaitAround(wrap) { aroundWait = typeof wrap === 'function' ? wrap : (promise => promise); }
let sequence = 0;

// No dependency on the host service is loaded for the default generateRaw route.
async function profileService(ctx) {
    if (connectionManagerDisabled(ctx)) {
        throw scannerRoutingError('Connection Profiles is disabled. Enable it or explicitly select the default scanner route.');
    }
    if (typeof ctx?.ConnectionManagerRequestService?.sendRequest === 'function') {
        return ctx.ConnectionManagerRequestService;
    }
    try {
        const { ConnectionManagerRequestService } = await import('../../../shared.js');
        if (typeof ConnectionManagerRequestService?.sendRequest === 'function') return ConnectionManagerRequestService;
    } catch { /* Normalize host module/API availability without copying credentials. */ }
    throw scannerRoutingError('This host does not expose the Connection Manager request service. Update SillyTavern or explicitly select the default scanner route.');
}

function profileSignature(profile) {
    const canonical = value => Array.isArray(value) ? value.map(canonical)
        : value && typeof value === 'object'
            ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
            : value;
    return JSON.stringify(canonical(profile));
}

function providerFailureHint(error) {
    let current = error;
    for (let depth = 0; current && depth < 5; depth += 1, current = current?.cause) {
        const status = Number(current?.status ?? current?.response?.status);
        if (status === 401) return ' The provider rejected authorization (401).';
        if (status === 403) return ' The provider rejected authorization (403).';
        if (status === 429) return ' The provider rate-limited the request (429).';
        const message = String(current?.message || '');
        if (/\b401\b|unauthori[sz]ed/i.test(message)) return ' The provider rejected authorization (401).';
        if (/\b403\b|forbidden/i.test(message)) return ' The provider rejected authorization (403).';
        if (/\b429\b|rate.?limit/i.test(message)) return ' The provider rate-limited the request (429).';
        if (/response not ok/i.test(message)) {
            return ' SillyTavern reported "Response not OK". On SillyTavern 1.18.0 this can be caused by the Connection Manager secret-id bug; re-save the selected profile while that profile\'s provider is the active main connection, then switch back.';
        }
    }
    return '';
}

function scannerMessages(options) {
    const messages = [];
    if (options.systemPrompt) messages.push({ role: 'system', content: String(options.systemPrompt) });
    messages.push({ role: 'user', content: String(options.prompt ?? '') });
    if (options.prefill) messages.push({ role: 'assistant', content: String(options.prefill) });
    return messages;
}

/**
 * One provider call, never an implicit fallback or retry. The caller owns JSON
 * correction and pins profileId/signal/deadline/isCurrent for its whole scan.
 * Default generateRaw has no request-local AbortSignal API: cancellation settles
 * our caller and discards late output, but cannot promise provider-side abort.
 */
export async function dispatchScannerRequest(ctx, options = {}, scope = {}) {
    const route = scope.route || { profileId: scope.profileId === undefined ? selectedScannerProfileId(ctx) : scope.profileId };
    const profileId = String(route.profileId || '').trim();
    const requestedResponseLength = Math.max(1, Math.round(Number(options.responseLength) || 2048));
    if (route.maxOutputTokens === undefined) route.maxOutputTokens = configuredScannerMaxOutputTokens(ctx);
    const configuredMaxOutputTokens = normalizeScannerMaxOutputTokens(route.maxOutputTokens);
    const effectiveResponseLength = configuredMaxOutputTokens || requestedResponseLength;
    const routedOptions = configuredMaxOutputTokens
        ? { ...options, responseLength: effectiveResponseLength }
        : options;
    const record = {
        id: ++sequence, label: String(scope.label || 'scanner request').slice(0, 120),
        route: profileId ? 'profile' : 'default', profileId,
        chatKey: scope.chatKey || '', operationId: scope.operationId ?? null,
        requestedResponseLength, effectiveResponseLength,
        outputOverrideConfigured: configuredMaxOutputTokens > 0,
        startedAt: Date.now(), sent: false,
    };
    metrics.attempts += 1;
    const controller = new AbortController();
    let stop = null;
    let rejectStop;
    const stopped = new Promise((_, reject) => { rejectStop = reject; });
    // A pre-aborted scope may reject before the first asynchronous host call.
    void stopped.catch(() => {});
    const cancel = (timeout = false) => {
        if (stop) return;
        stop = stoppedError(timeout);
        rejectStop(stop);
        controller.abort(stop);
    };
    const onAbort = () => cancel(scope.signal?.reason?.code === 'NPC_SCANNER_ROUTE_TIMEOUT');
    const assertCurrent = () => {
        if (scope.signal?.aborted) onAbort();
        if (!stop && typeof scope.isCurrent === 'function' && !scope.isCurrent()) cancel();
        if (stop) throw stop;
    };
    const timeoutMs = Math.max(1, Math.min(30 * 60 * 1000, Number(scope.timeoutMs) || SCANNER_REQUEST_TIMEOUT_MS));
    const remainingMs = Number.isFinite(scope.deadline) ? Math.min(timeoutMs, scope.deadline - Date.now()) : timeoutMs;
    let timer = null;
    let outcome = 'failure';
    let failureCode = '';
    inflight.set(record.id, { record, cancel, controller });
    scope.signal?.addEventListener?.('abort', onAbort, { once: true });
    if (remainingMs <= 0) cancel(true);
    else timer = setTimeout(() => cancel(true), remainingMs);

    try {
        assertCurrent();
        let invoke;
        let verifyProfile = () => {};
        if (!profileId) {
            if (typeof ctx?.generateRaw !== 'function') {
                throw scannerRoutingError('This host does not expose generateRaw().', 'NPC_SCANNER_DEFAULT_UNAVAILABLE');
            }
            // Keep the accepted default route byte-for-byte when no override is configured.
            // Only the explicit scanner output setting creates a request-local clone.
            invoke = configuredMaxOutputTokens
                ? () => ctx.generateRaw(routedOptions)
                : () => ctx.generateRaw(options);
        } else {
            const service = await Promise.race([profileService(ctx), stopped]);
            assertCurrent();
            let profile;
            try {
                profile = typeof service.getProfile === 'function'
                    ? service.getProfile(profileId)
                    : ctx?.extensionSettings?.connectionManager?.profiles?.find(item => item?.id === profileId);
            } catch { /* A deleted selection remains selected and fails closed. */ }
            if (!profile || String(profile.id || '') !== profileId) {
                throw scannerRoutingError(`Selected profile "${profileId}" is missing. Restore it or choose another NPC scanner connection profile.`);
            }
            let supported = true;
            try {
                if (typeof service.isProfileSupported === 'function') supported = service.isProfileSupported(profile);
            } catch { supported = false; }
            if (!supported) throw scannerRoutingError(`Selected profile "${profile.name || profileId}" is not supported for text generation.`);
            const signature = profileSignature(profile);
            if (route.signature !== undefined && route.signature !== signature) {
                throw scannerRoutingError('The selected profile changed during this scan. Retry with the updated profile.', 'NPC_SCANNER_PROFILE_CHANGED');
            }
            route.signature = signature;
            verifyProfile = () => {
                let current;
                try {
                    current = typeof service.getProfile === 'function' ? service.getProfile(profileId)
                        : ctx?.extensionSettings?.connectionManager?.profiles?.find(item => item?.id === profileId);
                } catch { /* Treat deletion exactly like a route change. */ }
                if (connectionManagerDisabled(ctx) || !current || profileSignature(current) !== signature) {
                    throw scannerRoutingError('The selected profile changed or was removed during this scan. Choose a valid profile and retry.', 'NPC_SCANNER_PROFILE_CHANGED');
                }
            };
            invoke = () => service.sendRequest(profileId, scannerMessages(routedOptions), effectiveResponseLength, {
                stream: false, signal: controller.signal, extractData: true,
                includePreset: true, includeInstruct: true,
            });
        }
        assertCurrent();
        // Count provider invocations, not rejected settings or cancelled preflights.
        record.sent = true;
        metrics.total += 1;
        metrics[profileId ? 'profileRoute' : 'defaultRoute'] += 1;
        const response = await aroundWait(Promise.race([invoke(), stopped]));
        assertCurrent();
        verifyProfile();
        let value = response;
        if (profileId) {
            value = typeof response === 'string' ? response : response?.content;
            // Some providers hand back the JSON reply already parsed (content is an object, as the proxy log shows it): keep it as its text.
            // An empty object carries nothing and stays refused below.
            if (value && typeof value === 'object' && !Array.isArray(value) && value.type === 'text' && typeof value.text === 'string') value = value.text;
            else if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length) value = JSON.stringify(value);
            if (typeof value !== 'string') {
                throw scannerRoutingError('The selected profile returned no text content. Check its text-generation configuration.', 'NPC_SCANNER_PROFILE_RESPONSE');
            }
        }
        outcome = 'success';
        metrics.succeeded += 1;
        return value;
    } catch (cause) {
        const error = stop || (isScannerRoutingError(cause) ? cause
            : cause?.name === 'AbortError' ? stoppedError()
                : profileId ? scannerRoutingError(`Request through profile "${profileId}" failed.${providerFailureHint(cause)} Check that profile's model, credentials, and connection in SillyTavern; no fallback was used.`, 'NPC_SCANNER_PROFILE_REQUEST_FAILED')
                    : cause);
        failureCode = String(error?.code || 'PROVIDER_ERROR');
        outcome = failureCode === 'NPC_SCANNER_ROUTE_TIMEOUT' ? 'timeout'
            : failureCode === 'NPC_SCANNER_ROUTE_CANCELLED' ? 'cancelled' : 'failure';
        if (!record.sent) metrics.rejected += 1;
        else metrics[outcome === 'timeout' ? 'timedOut' : outcome === 'cancelled' ? 'cancelled' : 'failed'] += 1;
        throw error;
    } finally {
        if (timer) clearTimeout(timer);
        scope.signal?.removeEventListener?.('abort', onAbort);
        inflight.delete(record.id);
        // No prompts, responses, profile objects, URLs, or credentials in diagnostics.
        metrics.last = {
            id: record.id, label: record.label, route: record.route, profileId,
            dispatched: record.sent, outcome, code: failureCode,
            requestedResponseLength: record.requestedResponseLength,
            effectiveResponseLength: record.effectiveResponseLength,
            outputOverrideConfigured: record.outputOverrideConfigured,
            durationMs: Math.max(0, Date.now() - record.startedAt), at: Date.now(),
        };
    }
}
