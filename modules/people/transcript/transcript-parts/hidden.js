// The Refresh window's chat: the story as it stands, plus the story messages SillyTavern hid (`is_system` set by /hide, e.g. by a memory extension), read as evidence.
// Still out: our own faded replies, SillyTavern's own system notes and anything not a message. A /hide only sets `is_system`. Most notes SillyTavern writes itself
// (narrator, comment, help and the rest) carry `extra.type`; the exceptions with no type are skipped by their own marks (a tool-call record, a system_avatar note,
// an image-generation message, a bias-only /sendas). Anything else hidden is a story reply or a user turn. Only a Refresh asks for this.
import { activeChat } from './gate.js';
import { readContext } from './source.js';

// A faded reply is a copy in the active chat (gate.js), so `active[at] !== message` tells it from one /hide hid.
const generatedImage = extra => Array.isArray(extra?.media) && extra.media.some(item => item?.source === 'generated');   // SillyTavern's Image Generation message (hidden by default)
const biasOnly = message => Boolean(message.extra?.bias) && !String(message.mes ?? '').replace(String(message.extra.bias), '').trim();   // /sendas with only a bias text
const hiddenStory = (message, faded) => Boolean(message?.is_system) && !faded && !(typeof message.extra?.type === 'string' && message.extra.type)
    && !message.extra?.tool_invocations && message.force_avatar !== 'img/five.png'   // a tool-call record carries no type but these two marks
    && !generatedImage(message.extra) && !biasOnly(message);

/** The chat with each hidden story message read as an ordinary one (same indices), or the chat the story stands on when `hidden` is off. */
export function windowChat(hidden = false) {
    const raw = readContext().chat || [];
    const active = activeChat(raw);
    if (!hidden) return active;
    return raw.map((message, at) => (hiddenStory(message, active[at] !== message) ? { ...message, is_system: false } : active[at]));
}
