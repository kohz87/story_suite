// Choices and Inner chatter: the chatter of the answered and newest replies, under the people present, and its tail line.

import { foldKey } from '../../text.js';

/**
 * The reply whose chatter goes back to the story when the reader asks for it (chatterTail): the last
 * reply before the reader's latest message, the one that message answered. A swipe, a regenerate and a
 * Continue of the newest reply therefore use the reply before it, never the one being written again.
 * → its index in `chat`, or -1.
 */
export function answeredReply(chat) {
    const list = Array.isArray(chat) ? chat : [];
    const user = list.findLastIndex(message => message?.is_user);
    if (user < 0) return -1;
    for (let i = user - 1; i >= 0; i -= 1) {
        const message = list[i];
        if (message && !message.is_user && !message.is_system) return i;
    }
    return -1;
}

/**
 * The newest reply's Inner chatter (query `chatter.head`, MODULES §F115): what its strip shows, read
 * the same way (`display(mes, message)`, displayLines; the message gives its caretWords mark), as [{ name, text }] in reply order. The newest reply is
 * the last message that is neither the reader's nor a system one, after the reader's first message
 * (the greeting has no strip). [] when there is none or it has no chatter. Story Director's World
 * screen puts each thought under the person who had it.
 */
export function headChatter(chat, display) {
    const list = Array.isArray(chat) ? chat : [];
    const firstUser = list.findIndex(message => message?.is_user);
    if (firstUser < 0 || typeof display !== 'function') return [];
    for (let i = list.length - 1; i > firstUser; i -= 1) {
        const message = list[i];
        if (!message || message.is_user || message.is_system) continue;
        let read = {};
        try { read = display(String(message.mes ?? ''), message) ?? {}; } catch { read = {}; }
        return (Array.isArray(read.chatter) ? read.chatter : []).map(item => ({ name: item.name, text: item.text }));
    }
    return [];
}

/**
 * The newest reply's chatter under the people present (query `scene.chatter`, for Story Block's Scene
 * screen while Story Director's World is not there to show it): [{ name, text }] in `present`'s order,
 * `name` as the scene lists the person, one thought each (their last line). A thinker is matched to a
 * present name ignoring case (foldKey); a thought of someone not present is left out.
 */
export function sceneChatter(present, chatter) {
    const thoughts = new Map();
    for (const item of Array.isArray(chatter) ? chatter : []) {
        const key = typeof item?.name === 'string' ? foldKey(item.name) : '';
        if (key && typeof item.text === 'string' && item.text) thoughts.set(key, item.text);
    }
    const out = [];
    const seen = new Set();
    for (const name of Array.isArray(present) ? present : []) {
        const key = typeof name === 'string' ? foldKey(name) : '';
        if (!key || seen.has(key) || !thoughts.has(key)) continue;
        seen.add(key);
        out.push({ name, text: thoughts.get(key) });
    }
    return out;
}

/** The one optional tail line for the reader's "send it back" setting, or '' when there is nothing. */
export function chatterTail(chatter) {
    const list = (Array.isArray(chatter) ? chatter : []).filter(item => item?.name && item?.text);
    if (!list.length) return '';
    return `[Inner chatter last reply, unspoken: only the thinker knows] ${list.map(item => `${item.name}: ${item.text}`).join(' / ')}`;
}
