// The Refresh window's chat: the story as it stands, plus the story messages SillyTavern hid (`is_system` set by /hide, e.g. by a memory extension), read as evidence.
// Still out: our own faded replies, SillyTavern's own system notes and anything not a message. A /hide only sets `is_system`; every note SillyTavern writes itself
// (narrator, comment, help and the rest) is stored with `extra.type`, so a hidden message with no `extra.type` is a story reply or a user turn. Only a Refresh asks for this.
import { activeChat } from './gate.js';
import { readContext } from './source.js';

// A faded reply is a copy in the active chat (gate.js), so `active[at] !== message` tells it from one /hide hid.
const hiddenStory = (message, faded) => Boolean(message?.is_system) && !faded && !(typeof message.extra?.type === 'string' && message.extra.type)
    && !message.extra?.tool_invocations && message.force_avatar !== 'img/five.png';   // a tool-call record carries no type but these two marks

/** The chat with each hidden story message read as an ordinary one (same indices), or the chat the story stands on when `hidden` is off. */
export function windowChat(hidden = false) {
    const raw = readContext().chat || [];
    const active = activeChat(raw);
    if (!hidden) return active;
    return raw.map((message, at) => (hiddenStory(message, active[at] !== message) ? { ...message, is_system: false } : active[at]));
}
