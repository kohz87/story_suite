// Restore missing: puts back static and tail text that SillyTavern left out of a chat-completion prompt.

import { STATIC_MARKER } from '../../prompt.js';
import { contentText, firstLine, mapContent } from './content.js';

// `text` wherever it is in a prompt, however SillyTavern spaced it (it trims an extension prompt, and may collapse new lines).
export function textPattern(text) {
    const words = String(text ?? '').trim().split(/\s+/).filter(Boolean).map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return words.length ? new RegExp(`\\s*${words.join('\\s+')}`, 'g') : null;
}

/**
 * Chat completion, the story's own prompt: puts back what SillyTavern left out. When the static
 * text is missing (the preset has no Main Prompt) it goes at the start of this reply's part;
 * when that is missing too, both go in as one system message right before the reply (before a
 * trailing assistant message, a Continue's own text). Returns what it did: '' | 'static' | 'both'.
 */
export function restoreMissing(chat, staticText, tailText) {
    if (!Array.isArray(chat) || !staticText) return '';
    const has = text => {
        const marker = firstLine(text);
        return marker ? chat.findIndex(message => contentText(message?.content).includes(marker)) : -1;
    };
    if (has(STATIC_MARKER) >= 0 || has(staticText) >= 0) return '';
    const at = tailText ? has(tailText) : -1;
    if (at >= 0) {
        const message = chat[at];
        let done = false;
        message.content = mapContent(message.content, part => {
            if (done || !part.includes(firstLine(tailText))) return part;
            done = true;
            const index = part.indexOf(firstLine(tailText));
            return `${part.slice(0, index)}${staticText}\n\n${part.slice(index)}`;
        });
        return 'static';
    }
    const index = chat.length && chat.at(-1)?.role === 'assistant' ? chat.length - 1 : chat.length;
    chat.splice(index, 0, { role: 'system', content: [staticText, tailText].filter(Boolean).join('\n\n') });
    return 'both';
}
