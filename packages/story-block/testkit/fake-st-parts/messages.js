// Message and request helpers for tests: a reply or greeting, a user message, and the shared start of two requests.

import { clone } from './shared-clone.js';

/** A reply or greeting as SillyTavern keeps it. */
export function aiMessage(text, { name = 'Narrator', extra = {}, isSystem = false } = {}) {
    return {
        name, is_user: false, is_system: isSystem, mes: String(text), send_date: '',
        swipe_id: 0, swipes: [String(text)], swipe_info: [{ send_date: '', extra: clone(extra) }], extra: clone(extra),
    };
}

export function userMessage(text, { name = 'You' } = {}) {
    return { name, is_user: true, is_system: false, mes: String(text), send_date: '', extra: {} };
}

/** How much of two requests is an identical start: { chars, percent } (§5's cache check). */
export function sharedPrefix(a, b) {
    const text = request => (typeof request === 'string' ? request : JSON.stringify(request ?? ''));
    const left = text(a);
    const right = text(b);
    let chars = 0;
    while (chars < left.length && chars < right.length && left[chars] === right[chars]) chars += 1;
    const longest = Math.max(left.length, right.length) || 1;
    return { chars, percent: Math.round((chars / longest) * 1000) / 10 };
}
