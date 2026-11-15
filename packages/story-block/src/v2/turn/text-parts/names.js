// Names: fills {{user}} / {{char}} in with flat one-line names and defuses other macros.

import { cutAt } from '../../../text.js';

// A name filled in for {{user}} / {{char}} is one line of at most this many characters.
export const MAX_NAME = 80;

/**
 * SillyTavern runs its macros over extension prompts, which would rewrite a `{{user}}` or
 * `<USER>` inside a name the story introduced. A zero-width space keeps them as written.
 */
export function defuseMacros(text) {
    return String(text ?? '')
        .replace(/\{(?=\{)/g, '{​')
        .replace(/<(USER|BOT|CHAR|CHARIFNOTGROUP|GROUP)>/gi, '<​$1>');
}

// A persona or character name as it goes into a prompt: one line (no line breaks or other control
// characters, so it cannot start a [Happened] or <Changes> line of its own), at most MAX_NAME long.
export function flatName(value) {
    const flat = String(value ?? '').replace(/[\p{Cc}\p{Zl}\p{Zp}]+/gu, ' ').replace(/ {2,}/g, ' ').trim();
    return flat.length > MAX_NAME ? `${cutAt(flat, MAX_NAME - 1).trimEnd()}…` : flat;
}

/**
 * `{{user}}` and `{{char}}` in the static and tail text become the persona's and the character's
 * names (SillyTavern's substituteParams when the context has it, else name1 / name2), flattened to
 * one short line (flatName); any other macro is left for defuseMacros. Both names are fixed for a
 * chat, so the static text stays byte-identical reply after reply.
 */
export function substituteNames(text, ctx) {
    const cache = new Map();
    const name = macro => {
        const key = macro.toLowerCase();
        if (!cache.has(key)) {
            let value = null;
            try { value = typeof ctx?.substituteParams === 'function' ? ctx.substituteParams(`{{${key}}}`) : null; } catch { value = null; }
            if (typeof value !== 'string' || value === `{{${key}}}`) value = key === 'user' ? ctx?.name1 : ctx?.name2;
            const flat = typeof value === 'string' ? flatName(value) : '';
            cache.set(key, flat || null);
        }
        return cache.get(key);
    };
    return String(text ?? '').replace(/\{\{\s*(user|char)\s*\}\}/gi, (whole, macro) => name(macro) ?? whole);
}
