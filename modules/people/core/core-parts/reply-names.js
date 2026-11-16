/* NPC State: does a reply name someone? The NSD16 test for the fallback scan (Q1 default): only a reply with no <Changes> block AND a name in it
   gets a scan. A listed person (the identity list's matcher, npcNamedInText) counts; so does a capitalised word that is not sentence-initial, not the
   player or the played character, and not a known place. One job: the test; the caller decides what a miss costs. */
import { npcNamedInText } from '../core-merge-names.js';

const CAPITAL = /(?<![\p{L}\p{N}'’])\p{Lu}[\p{L}'’-]{2,}/gu;   // at least three letters, so "I", "He" and "OK" never count
const SENTENCE_START = /(?:^|[.!?…:]["'”’)*_\s]*\s|\n|["“*_(]\s*)$/u;

export function replyNamesSomeone(text, { npcs = [], userName = '', charName = '', places = [] } = {}) {
    const prose = String(text ?? '').replace(/<Changes\b[\s\S]*?(?:<\/Changes>|$)/i, '');
    if (!prose.trim()) return false;
    if ((npcs || []).some(npc => npc && npcNamedInText(npc, prose, npcs))) return true;
    // Each word of a name counts (a place "Bluewatch Guild" skips "Bluewatch"; the match is one capitalised word at a time).
    const skip = new Set([userName, charName, ...places].flatMap(name => String(name || '').toLowerCase().split(/\s+/)).filter(Boolean));
    const known = new Set((npcs || []).flatMap(npc => [npc?.name, ...(npc?.aliases || [])]).flatMap(name => String(name || '').toLowerCase().split(/\s+/)));
    for (const match of prose.matchAll(CAPITAL)) {
        const word = match[0].toLowerCase();
        if (skip.has(word) || known.has(word)) continue;
        if (SENTENCE_START.test(prose.slice(0, match.index))) continue;
        return true;
    }
    return false;
}
