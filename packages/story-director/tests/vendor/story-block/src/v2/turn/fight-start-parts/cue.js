// The next-reply cue for a fight narrated with no foes line.

import { extractBlock, parseChanges, stripBlock } from '../../capture.js';

// The next-reply cue for a fight narrated with no Foes line (it would never be fought on the board): the reply before reads as a fight (at least
// FIGHT_WORDS_MIN different fight words in its story, and a `? roll` line) and wrote no foes line, and no foe is set now. Gated by the caller on the
// RPG being on; a tail line only, the static prompt is unchanged. Re-derived from the stored reply each time, so replay == live.
export const FIGHT_CUE = 'A fight seems under way in the last reply but no foes line was written: write + dm foes so it is fought on the board.';
export const FIGHT_WORDS_MIN = 3;
// Action words only (something done to someone): a noun or scene word (blood, dead, sword, bolt, axe) never counts, so a dead tree or a sword on the wall is no fight.
const FIGHT_WORD = /(?<![\p{L}\p{N}])(kill(?:ed|s)?|slain|slay(?:s)?|slew|stab(?:bed|s)?|slash(?:ed|es)?|wound(?:ed|s)?|bleed(?:ing|s)?|struck\s+down|strikes?\s+down|swung\s+at|swings?\s+at|cleaves?|cleft|parried|lunged|fell\s+dead)(?![\p{L}\p{N}])/giu;
export function fightCue(reply, { foesNow = false, heads = null } = {}) {
    const mes = String(reply?.mes ?? '');
    if (foesNow || !mes) return null;
    const lines = parseChanges(extractBlock(mes, 'Changes', null, { heads }) ?? '').lines;
    if (!lines.some(line => line.kind === 'roll') || lines.some(line => line.kind === 'dm' && line.op === '+' && (/^foes?(?![\p{L}])/iu.test(line.name) || /^set-slot/u.test(String(line.labels?.kind ?? ''))))) return null;
    const words = new Set([...stripBlock(mes, 'Changes', { heads }).matchAll(FIGHT_WORD)].map(found => found[1].toLowerCase().replace(/\s+/gu, ' ')));
    return words.size >= FIGHT_WORDS_MIN ? FIGHT_CUE : null;
}
