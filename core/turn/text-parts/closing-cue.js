// Closing cue: the fixed last line of a reply's prompt that reminds the model to write its Changes block.

import { contentText } from './content.js';

// The closing cue: one short fixed line sent as the very last text of a reply's prompt (after the preset's own depth-0 blocks), so a
// reply's <Changes> block is not forgotten when the preset's thinking guide stops naming it. Fixed text, so the cache keeps it.
export const CLOSING_CUE_TAIL = 'Changes worked out only in thinking are lost.';
export function closingCue(onePass) {
    return `After the story, write the <Changes> block${onePass ? ', then the hidden npc_state_delta block' : ''}. ${CLOSING_CUE_TAIL}`;
}
// Put `cue` last in a chat-completion message list: appended to the final message that is not an assistant prefill (one message, so a
// provider that wants the last turn from the user still gets it, and Semi-strict has nothing to merge); true when added (not twice).
export function appendClosingCue(chat, cue) {
    if (!Array.isArray(chat) || !cue || chat.some(message => contentText(message?.content).includes(CLOSING_CUE_TAIL))) return false;
    let index = chat.length - 1;
    while (index >= 0 && chat[index]?.role === 'assistant') index -= 1;
    const message = chat[index];
    if (typeof message?.content === 'string') message.content = `${message.content}

${cue}`;
    else if (Array.isArray(message?.content)) message.content = [...message.content, { type: 'text', text: cue }];
    else chat.splice(index + 1, 0, { role: 'system', content: cue });
    return true;
}
