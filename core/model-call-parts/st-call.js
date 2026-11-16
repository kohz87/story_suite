// The SillyTavern call behind sdk.callModel, on the chat's connection or a profile.

import { answerText, findProfile } from '../../modules/assist/st-adapter.js';
import { MODEL_CALL_TOKENS } from './limits.js';
import { MODEL_CALL_ERRORS, MODEL_CALL_TEXT } from './messages.js';
import { CallError } from './errors.js';
import { cmDisabled, profileName } from './profiles.js';
import { context, fill } from './shared-helpers.js';

/**
 * The SillyTavern call behind sdk.callModel: `prompt` → the model's text (throws a CallError or an
 * error). `options`: { maxTokens, profile ('' = the chat's connection, else a Connection Manager profile's
 * name or id), system, signal }. A named profile that is missing is an error (the reader chose that
 * model on purpose, so the chat's is not used in its place).
 */
export async function stModelCall(prompt, { maxTokens = MODEL_CALL_TOKENS, profile = '', system = '', signal = null } = {}) {
    const ctx = context();
    if (!ctx) throw new CallError(MODEL_CALL_ERRORS.UNAVAILABLE, MODEL_CALL_TEXT.noSt);
    const name = profileName(profile);
    const text = String(prompt);
    if (name) {
        if (cmDisabled(ctx)) throw new CallError(MODEL_CALL_ERRORS.NO_PROFILE, fill(MODEL_CALL_TEXT.cmOff, { name }));
        const service = ctx.ConnectionManagerRequestService;
        if (typeof service?.sendRequest !== 'function') throw new CallError(MODEL_CALL_ERRORS.NO_PROFILE, fill(MODEL_CALL_TEXT.noCm, { name }));
        const found = findProfile(ctx, name) ?? ctx.extensionSettings?.connectionManager?.profiles?.find?.(item => item?.id === name) ?? null;
        if (!found?.id) throw new CallError(MODEL_CALL_ERRORS.NO_PROFILE, fill(MODEL_CALL_TEXT.noProfile, { name }));
        const messages = system ? [{ role: 'system', content: String(system) }, { role: 'user', content: text }] : [{ role: 'user', content: text }];
        return answerText(await service.sendRequest(found.id, messages, maxTokens, { stream: false, signal, extractData: true }));
    }
    const raw = ctx.generateRaw;
    if (typeof raw !== 'function') throw new CallError(MODEL_CALL_ERRORS.UNAVAILABLE, MODEL_CALL_TEXT.noRaw);
    // generateRaw takes no signal: an abandoned call's answer is dropped (createModelCalls).
    const out = raw.length >= 2
        ? await raw.call(ctx, text, '', false, false, String(system ?? ''), maxTokens)
        : await raw.call(ctx, { prompt: text, systemPrompt: String(system ?? ''), responseLength: maxTokens });
    return answerText(out);
}
