// Words one roll as one line.

import { OUTCOME_WORD } from './words.js';
import { itemLineText } from './items.js';
import { cut } from './shared-text.js';

// An ambush check's result (ambush.js).
const ambushNote = line => (line.ambush !== true ? '' : `; ambush ${line.outcome === 'success' ? (line.ambushDrop === true ? 'works: you have the drop' : 'works, the party strikes first') : line.outcome === 'cost' ? 'only half works: no surprise' : 'fails, no surprise'}`);
const numbers = line => `(${line.pc.total} vs ${line.kind === 'check' ? line.dc : line.foe.total})`;

/**
 * One roll as one line: "Wessel → Sluice Rat A (Iron Breath): SUCCESS (26 vs 16)". `compact`: a check without its skill and stat;
 * `names`: the longest a skill's name may be (0: as written); `shown`: how a character's or a foe's name is written (shortNames; as given);
 * `plain`: name a hidden stat all the same (only to measure the cue, fitCue).
 */
export function lineText(line, { compact = false, names = 0, shown = name => name, plain = false, legacy = false } = {}) {
    const word = OUTCOME_WORD[line.outcome];
    const who = shown(line.pc.who);
    if (line.item) return itemLineText({ who, target: shown(line.target), item: cut(line.item, names), pool: line.pool, gained: line.gained });
    if (line.type && line.kind !== 'check') return standardLine(line, { names, shown, word, who, legacy });
    if (line.type && line.support) return `${who} → ${shown(line.target)}${line.skill ? ` (${cut(line.skill, names)}, support)` : ' (support)'}: ${word} ${numbers(line)}${line.damage ? `, heals${line.decisive ? ' well' : ''}` : ''}`;
    if (line.kind === 'check') {
        if (compact) return `${who} — ${line.difficulty} check: ${word} ${numbers(line)}${ambushNote(line)}`;
        // a stat the pack hides is not named (review 163)
        if (line.pc.statHidden && !plain) return `${who} — ${line.skill ? cut(line.skill, names) : 'check'}, ${line.difficulty}: ${word} ${numbers(line)}${ambushNote(line)}`;
        return `${who} — ${cut(line.skill ?? line.pc.stat.toUpperCase(), names)} (${line.pc.stat.toUpperCase()}), ${line.difficulty}: ${word} ${numbers(line)}${ambushNote(line)}`;
    }
    if (line.kind === 'foe') return `${shown(line.foe.name)} attacks ${who}${line.skill ? ` (${cut(line.skill, names)})` : ''}: ${word} for ${who} ${numbers(line)}`;
    return `${who} → ${shown(line.foe.name)}${line.skill ? ` (${cut(line.skill, names)})` : ''}: ${word} ${numbers(line)}`;
}

// The Standard formula's act and foe attack: the verdict first, as in the log, then what the roll did to the bars.
function standardLine(line, { names, shown, word, who, legacy = false }) {
    // (`legacy`: a roll before `fix: 2` is told as 2.20.0 told it)
    const foe = line.kind === 'foe', d = line.decisive;
    const verdict = legacy || !d ? word : line.outcome === 'fail' ? `${word}, DECISIVE` : `DECISIVE ${word}`;
    const hit = line.damage ? (foe ? `, hits ${who}${d ? ' hard' : ''}` : legacy ? `, a ${d ? 'decisive ' : ''}hit` : ', a hit') : (legacy && d ? ', decisive' : '');
    // A spent skill: its `else:` skill is named, else a plain weapon attack (`otherUp`: the other pool is not empty).
    const gone = cut(line.without ?? '', names), resource = line.withoutUses ? `${gone}'s ${line.withoutUses === 'mana' ? 'Mana' : 'Stamina'} is spent${line.otherUp ? `, ${line.withoutUses === 'mana' ? 'Stamina' : 'Mana'} is not` : ''}` : `${gone} unavailable: resource spent`;
    const bare = !line.without ? '' : legacy ? ` (${resource})` : line.skill ? ` (${resource}; ${cut(line.skill, names)} instead)` : ` (no skill: ${resource}; a plain weapon attack \u2014 name no skill)`;
    const by = line.skill ? ` (${cut(line.skill, names)})` : '';
    if (foe) return `${shown(line.foe.name)} attacks ${who}${by}${bare}: ${verdict} for ${who} ${numbers(line)}${hit}`;
    return `${who} \u2192 ${shown(line.foe.name)}${by}${bare}${line.area ? (line.reduced ? ' (area, reduced)' : ' (area)') : ''}: ${verdict} ${numbers(line)}${hit}`;
}
