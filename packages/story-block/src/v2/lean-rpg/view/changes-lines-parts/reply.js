// The RPG's lines for one reply: the rolls, the receipts' lines, and the automatic level, class and rank rises.

import { FORMULA } from '../../index.js';
import { RPG_STRINGS, fill } from '../../strings.js';
import { rpgBlocks, readParty, skillsOf } from '../party-data.js';
import { words, line } from './shared-line.js';
import { exchangesOf, rulesOfReply } from './rolls.js';
import { partyLines, fightLines, practiceLines } from './receipts.js';

const C = RPG_STRINGS.changes;

/**
 * The RPG's lines for one reply. `state` is the reply's state, `before` the one before it (null for the first reply: no
 * rises are told then), `record` the reply's record, `problems` the replay problems of that reply. `rules`: the numbers in force
 * now, used only for a reply that has no roll of its own (its roll's recorded numbers win).
 */
export function rpgReplyLines({ state, before = null, record = null, problems = [], roleOf, rules = null } = {}) {
    const out = [];
    rules = rulesOfReply(record, problems) ?? rules;
    const rolled = exchangesOf(record, problems);
    if (rolled) {
        const note = [rolled.pairs.slice(0, 2).join(' · '), C.rolledNote].filter(Boolean).join(' · ');
        out.push(line({ icon: 'fa-dice-d20', tone: 'info', text: fill(rolled.exchanges === 1 ? C.rolledOne : C.rolled, { n: rolled.exchanges }),
            summary: fill(rolled.exchanges === 1 ? C.rolledSummaryOne : C.rolledSummary, { n: rolled.exchanges }), note }));
    }
    out.push(...partyLines(record, problems));
    out.push(...fightLines(record, problems));
    out.push(...practiceLines(record, problems));
    if (!before) return out;
    const then = new Map(readParty(before, { roleOf }).map(character => [`${character.module}|${character.subject}`, character]));
    for (const character of readParty(state, { roleOf })) {
        const old = then.get(`${character.module}|${character.subject}`);
        if (!old) continue;
        const levelled = character.levelled === true && old.levelled === true;
        if (levelled) {
            if (!(character.level > old.level)) continue;
            // A point to spend comes with every third level (the Character template's level-up rule): said when the points went up.
            const gained = character.points - old.points;
            const plural = gained > 1 ? 'Many' : '';
            out.push(line({ icon: 'fa-arrow-up', tone: 'good', text: fill(gained > 0 ? C[`levelUpPoints${plural}`] : C.levelUp, { who: character.name, to: character.level, n: gained }),
                summary: fill(gained > 0 ? C[`levelSummaryPoints${plural}`] : C.levelSummary, { who: character.name, to: character.level, n: gained }),
                // (told only when the XP rule made the rise: the XP fell with it; a level typed by hand leaves the XP as it was)
                note: character.xp < old.xp ? fill(C.levelNote, { xp: character.xp }) : '' }));
            continue;
        }
        // A block of the earlier rules: its Soul Class rose; what that adds to every roll is classWeight x the rise.
        if (!(character.soul > old.soul)) continue;
        const bonus = (rules?.classWeight ?? FORMULA.classWeight) * (character.soul - old.soul);
        // A character made from 2.9.1 on gets 3 points to spend with each rise (the template's class-up rule): said when the points went up.
        const gained = character.points - old.points;
        const base = character.xp === 0 ? fill(bonus > 0 ? C.classNote : C.levelNote, { xp: character.xp, bonus }) : (bonus > 0 ? fill(C.classNoteShort, { bonus }) : '');
        out.push(line({ icon: 'fa-arrow-up', tone: 'good', text: fill(C.classUp, { who: character.name, label: character.soulLabel, from: old.soulName, to: character.soulName }),
            summary: fill(gained > 1 ? C.classSummaryPoints : gained > 0 ? C.classSummaryPointOne : C.classSummary, { label: character.soulLabel, to: character.soulName, n: gained }),
            note: gained > 0 ? [base, fill(gained > 1 ? C.classPoints : C.classPointOne, { n: gained })].filter(Boolean).join(' · ') : base }));
    }
    const skillsThen = new Map(rpgBlocks(before, { roleOf }).filter(block => block.role === 'skills').map(block => [`${block.module}|${block.subject}`, block]));
    const skillBlocks = rpgBlocks(state, { roleOf }).filter(block => block.role === 'skills');
    for (const block of skillBlocks) {
        const old = skillsThen.get(`${block.module}|${block.subject}`);
        if (!old) continue;
        const was = new Map(skillsOf(old).map(skill => [skill.slot, skill]));
        const who = words(block.fields.who);
        for (const skill of skillsOf(block)) {
            const earlier = was.get(skill.slot);
            if (!earlier || earlier.name !== skill.name || !(skill.rank > earlier.rank)) continue;
            out.push(line({ icon: 'fa-arrow-up', tone: 'good', text: fill(C.rankUp, { skill: skill.name, from: earlier.rankName, to: skill.rankName }),
                summary: fill(C.rankSummary, { skill: skill.name, to: skill.rankName }),
                note: who && skillBlocks.length > 1 ? fill(C.rankNoteWho, { who }) : C.rankNote }));
        }
    }
    return out;
}
