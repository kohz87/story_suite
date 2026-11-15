// Makes one model call on the current connection or a named connection profile, and reads the answer's text.

import { context } from './shared-context.js';

/** The connection profile called `name` (case and outer spaces ignored), or null. */
export function findProfile(ctx, name) {
    const list = ctx?.extensionSettings?.connectionManager?.profiles;
    if (!Array.isArray(list)) return null;
    const key = String(name ?? '').trim().toLowerCase();
    return list.find(profile => String(profile?.name ?? '').trim().toLowerCase() === key) ?? null;
}

// What a request service or generateRaw answers: a string, { content }, or a chat completion body.
export function answerText(out) {
    if (typeof out === 'string') return out;
    if (typeof out?.content === 'string') return out.content;
    if (typeof out?.text === 'string') return out.text;
    const choice = out?.choices?.[0];
    if (typeof choice?.message?.content === 'string') return choice.message.content;
    if (typeof choice?.text === 'string') return choice.text;
    return '';
}

/**
 * One model call: `prompt` → the model's text. `options`: { maxTokens = 200, profile = '' }. With a
 * profile name the call goes through that Connection Manager profile; a missing profile is an error
 * (the reader picked a cheaper model on purpose, so the current one is not used in its place).
 * Throws with a plain sentence when the call cannot be made.
 */
export async function stCallModel(prompt, { maxTokens = 200, profile = '' } = {}) {
    const ctx = context();
    if (!ctx) throw new Error('SillyTavern is not available.');
    const name = String(profile ?? '').trim();
    if (name) {
        const service = ctx.ConnectionManagerRequestService;
        if (typeof service?.sendRequest !== 'function') throw new Error(`This SillyTavern has no Connection Manager, so the profile "${name}" cannot be used.`);
        const found = findProfile(ctx, name);
        if (!found?.id) throw new Error(`There is no connection profile called "${name}".`);
        return answerText(await service.sendRequest(found.id, [{ role: 'user', content: String(prompt) }], maxTokens));
    }
    const raw = ctx.generateRaw;
    if (typeof raw !== 'function') throw new Error('This SillyTavern cannot make a separate model call (no generateRaw).');
    const out = raw.length >= 2
        ? await raw.call(ctx, String(prompt), '', false, false, '', maxTokens)
        : await raw.call(ctx, { prompt: String(prompt), responseLength: maxTokens });
    return answerText(out);
}
