// The mirror check: the deterministic test for a taste that echoes the user, and its Problem and cue wording.
import { clean } from '../../meters/npc-meters-config.js';
import { TASTE_LIMITS } from './shared-limits.js';
import { contentWords } from './words.js';
import { noun } from './shared-signs.js';
import { readTastes } from './record.js';

/**
 * The deterministic echo check. True when the taste's words (at least half of them) appear in the user's last message, the taste
 * has no why: or from:, and no earlier taste shares a word with it (so an area she already had is not "new"). Never blocks.
 */
export function mirrorCheck({ userText = '', item = '', from = '', why = '', existing = [] } = {}) {
    const words = [...new Set(contentWords(item))];
    const none = { mirrored: false, matched: 0, total: words.length };
    if (!words.length || clean(from, TASTE_LIMITS.from) || clean(why, TASTE_LIMITS.why)) return none;
    const heard = new Set(contentWords(userText));
    if (!heard.size) return none;
    const area = readTastes(existing).some(row => contentWords(row.item).some(word => words.includes(word)));
    if (area) return none;
    const matched = words.filter(word => heard.has(word)).length;
    return { mirrored: matched * 2 >= words.length, matched, total: words.length };
}

/** The Problem and the one-reply cue for a mirrored taste. Names and items are shown as text; {{user}} is the host's macro. */
export function mirrorWording(name, sign, item) {
    const who = clean(name, 60) || 'The NPC';
    const said = `${who}'s ${noun(sign)} for ${clean(item, TASTE_LIMITS.item)} echoes {{user}}'s words`;
    return {
        problem: `${said}; kept and marked.`,
        cue: `${said}; keep ${who}'s own taste unless the story gives a reason.`,
    };
}
