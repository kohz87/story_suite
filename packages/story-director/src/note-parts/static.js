// Story Director: cache-friendly static note prefix and prompt message injection.

import { CHANGE_INSTRUCTION, NPC_PLANS_ONLY, PACING, PACING_NO_CHANGES } from '../note-text.js';

// (0.9.38) Cache-friendly: the parts that never change from reply to reply (the change
// instruction, the NPC plans line, Pacing) go early in the prompt, byte-identical every reply,
// so a provider's prompt cache keeps them; the rest of the note goes at the end, for this reply.
export const STATIC_LABELS = Object.freeze(['Change instruction', 'NPC plans only', 'Pacing']);

/**
 * The note's fixed part: the change instruction (when the model writes change lines), the NPC
 * plans line (while NPC State Delta keeps the NPCs), and Pacing, always (it used to come only
 * when something was scheduled; a part that comes and goes would break the cached prefix).
 */
export function staticNote({ instruction = CHANGE_INSTRUCTION, npcPlansOnly = false } = {}) {
    return [
        instruction,
        npcPlansOnly && instruction ? NPC_PLANS_ONLY : '',
        instruction ? PACING : PACING_NO_CHANGES,
    ].filter(Boolean).join('\n');
}

/**
 * (0.9.38) `messages` (a chat completion's) with `fixed` in them: as they are when some message
 * already holds it, else with it as a system message after the leading system messages, still
 * early and in the same place every reply. SillyTavern drops in-prompt extension prompts when the
 * preset's Main Prompt is missing from its prompt order; this keeps the instruction then. A new
 * array when it adds. (0.9.41) `story`: the chat has replies, so the story's own prompt carries
 * some; a call without any (another extension's scan or summary while the reply is generated, a
 * generateRaw) is left alone.
 */
export function withFixedNote(messages, fixed, { story = false } = {}) {
    const text = String(fixed ?? '').trim();
    if (!text || !Array.isArray(messages)) return messages;
    if (story && !messages.some(message => message?.role === 'assistant')) return messages;
    if (messages.some(message => typeof message?.content === 'string' && message.content.includes(text))) return messages;
    let at = 0;
    while (at < messages.length && messages[at]?.role === 'system') at += 1;
    return [...messages.slice(0, at), { role: 'system', content: text }, ...messages.slice(at)];
}
