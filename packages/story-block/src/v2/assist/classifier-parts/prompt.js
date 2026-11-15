// The classifier's prompt: its static head and the reader's message cut into it.

import { clip } from '../common.js';

// The classifier's whole prompt stays within this many tokens (chars/4): the static head below plus
// the reader's message, cut to MESSAGE_LIMIT characters.
export const PROMPT_BUDGET = 400;
export const MESSAGE_LIMIT = 800;

// The same text for every message of every chat, first in the prompt, so a provider's prompt cache
// can keep it; only the reader's message (last) changes.
export const CLASSIFIER_HEAD = [
    'You sort one message a reader wrote in an interactive story.',
    'If it attempts an action whose outcome is uncertain (it could fail: sneaking, persuading, lying, climbing, forcing a lock, searching, recalling lore), answer with exactly one line:',
    '? check <skill> — <what is attempted> | dc: easy|normal|hard|<number 5-30>',
    '<skill> is one or two plain words, such as stealth, persuasion, athletics, perception, lore.',
    'For talk, questions, plans, safe or trivial actions, a fight, or an outcome the message already settles, answer: none',
    'Answer with that one line only.',
    '',
    'The message:',
].join('\n');

/** The classifier's prompt for the reader's `message`: the static head, then the message. */
export function classifierPrompt(message) {
    return `${CLASSIFIER_HEAD}\n"""\n${clip(message, MESSAGE_LIMIT)}\n"""`;
}
