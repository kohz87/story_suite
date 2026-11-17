// The repair prompt for one reply: the head, the grammar, the foot, the story's state lines, then the reply.

import { clip } from '../common.js';
import { whereLines } from '../where.js';
import { REPAIR_FOOT, REPAIR_HEAD, REPAIR_REPLY_HEAD, STATE_HEAD } from './heads.js';

export const REPAIR_REPLY_LIMIT = 6000;
export const STATE_LIMIT = 1500;

/**
 * The repair prompt for `reply` (the story text, block removed), the kinds' grammar lines, the state lines before the reply (`state`: Place,
 * Present, Wallet, Carried … as the narrator was given them) and where and when the scene is (`around`, where.js whereNow). The head, grammar and foot come first
 * (fixed while the same kinds are on, for a provider's prompt cache), the reply last.
 */
export function repairPrompt(reply, grammar, state = [], around = null) {
    const kinds = grammar.map(line => `- ${String(line).trim()}`).join('\n');
    const lines = [...(Array.isArray(state) ? state : []).map(line => String(line ?? '').trim()), ...whereLines(around)].filter(Boolean);
    return `${REPAIR_HEAD}\n${kinds}\n${REPAIR_FOOT}\n\n${STATE_HEAD}\n${lines.length ? clip(lines.join('\n'), STATE_LIMIT) : 'none'}\n\n${REPAIR_REPLY_HEAD}\n"""\n${clip(reply, REPAIR_REPLY_LIMIT)}\n"""`;
}
