// Our own calls on the chat's connection, so the turn can tell their prompt from the reply's.

import { cutAt } from '../text.js';

// The part of a prompt that SillyTavern's macro pass (substituteParams) leaves as it is: its longest
// stretch between macros, trimmed ('' when there is none worth matching).
const MACRO = /\{\{[\s\S]*?\}\}|<(?:USER|BOT|CHAR|CHARIFNOTGROUP|GROUP)>/gi;

export function promptKey(prompt) {
    const pieces = String(prompt ?? '').split(MACRO).flatMap(piece => piece.split(/\r?\n/)).map(piece => piece.trim());
    const longest = pieces.reduce((best, piece) => (piece.length > best.length ? piece : best), '');
    return longest.length >= 8 ? cutAt(longest, 400) : '';
}

const contentOf = content => (typeof content === 'string' ? content
    : Array.isArray(content) ? content.map(part => (typeof part === 'string' ? part : typeof part?.text === 'string' ? part.text : '')).join('\n') : '');

/**
 * Our own calls on the chat's connection, so the turn can tell their prompt from the reply's:
 * { around(prompt, fn) → fn()'s result (the call is ours while fn runs), owns(eventData) → true for the
 * prompt-ready event (CHAT_COMPLETION_PROMPT_READY { chat } or GENERATE_AFTER_COMBINE_PROMPTS { prompt })
 * of one of them, size() }. Each call's prompt is matched once: a raw call's chat is at most three
 * messages (system, user, prefill) and holds the prompt's key (promptKey); a text prompt holds it. A prompt
 * too short for a key is taken by position, as the first such short chat after it started (never a text
 * prompt, which may be the reply's).
 */
export function createOwnCalls() {
    const live = new Map();
    let next = 0;
    return {
        async around(prompt, fn) {
            next += 1;
            const id = next;
            live.set(id, { key: promptKey(prompt), seen: false });
            try {
                return await fn();
            } finally {
                live.delete(id);
            }
        },
        owns(eventData) {
            if (!live.size || !eventData || eventData.dryRun === true) return false;
            const chat = Array.isArray(eventData.chat) ? eventData.chat : null;
            const text = chat ? (chat.length <= 3 ? chat.map(message => contentOf(message?.content)).join('\n') : null)
                : typeof eventData.prompt === 'string' ? eventData.prompt : null;
            if (text === null) return false;
            for (const call of live.values()) {
                if (call.seen) continue;
                if (call.key ? text.includes(call.key) : chat !== null) {
                    call.seen = true;
                    return true;
                }
            }
            return false;
        },
        size: () => live.size,
    };
}
