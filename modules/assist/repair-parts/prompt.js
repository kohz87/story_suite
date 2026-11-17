// The repair prompt for one reply: the head, the grammar, the foot, the story's state lines, then the reply.

import { clip } from '../common.js';
import { whereLines } from '../where.js';
import { repairGrammar } from './grammar.js';
import { REPAIR_FOOT, REPAIR_HEAD, REPAIR_REPLY_HEAD, STATE_HEAD } from './heads.js';

/** The story time as one state line with the clock first, no year ('June 3, 1200, 08:00 am' → 'Story time now: 08:00 am, day June 3'); none when unset. */
function storyTime(text) {
    const said = String(text ?? '').trim();
    if (!said) return [];
    const match = /^(.*?)[,\s]*(\d{1,2}[:.]\d\d(?:\s?[ap]\.?m\.?)?)$/i.exec(said);
    if (!match) return [`Story time now: ${said}`];
    const day = match[1].split(',').map(part => part.trim()).filter(part => part && !/^\d{3,4}$/.test(part)).join(', ');
    return [`Story time now: ${match[2]}${day ? `, day ${day}` : ''}`];
}

export const REPAIR_REPLY_LIMIT = 6000;
export const STATE_LIMIT = 2500;

/**
 * The repair prompt for `reply` (the story text, block removed), the kinds' grammar lines, the state lines before the reply (`state`: Place,
 * Present, Wallet, Carried … as the narrator was given them) and where and when the scene is (`around`, where.js whereNow). The head, grammar and foot come first
 * `persona` replaces {{user}} in the grammar lines. (fixed while the same kinds are on, for a provider's prompt cache), the reply last.
 */
export function repairPrompt(reply, grammar, state = [], around = null, persona = '') {
    const name = String(persona ?? '').trim() || 'the player';
    const kinds = repairGrammar(grammar).map(line => `- ${String(line).trim().replace(/\{\{user\}\}/gi, name)}`).join('\n');
    const lines = [...(Array.isArray(state) ? state : []).map(line => String(line ?? '').trim()), ...storyTime(around?.time), ...whereLines(around ? { ...around, time: '' } : around)].filter(Boolean);
    return `${REPAIR_HEAD}\n${kinds}\n${REPAIR_FOOT}\n\n${STATE_HEAD}\n${lines.length ? clip(lines.join('\n'), STATE_LIMIT) : 'none'}\n\n${REPAIR_REPLY_HEAD}\n"""\n${clip(reply, REPAIR_REPLY_LIMIT)}\n"""`;
}
