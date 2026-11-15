// Tells the prompt note from a reply's dice record.

import { FORMULA, LIMITS, ROLL_KIND, STATS } from '../names.js';

const signed = value => (value >= 0 ? `+${value}` : `${value}`);
/**
 * The prompt note, told from the reply's dice record (`rpg.dice`: the dice, the rules and difficulty numbers it was rolled with, and each party member's exact
 * bonus for every stat and skill, level or class term included, so the narrator's outcome and code's agree).
 */
export function offerLine(record) {
    const dice = Array.isArray(record?.list) ? record.list : [];
    const dc = record?.dc ?? LIMITS.dc, margin = Number.isInteger(record?.rules?.costMargin) ? record.rules.costMargin : FORMULA.costMargin;
    const table = (Array.isArray(record?.table) ? record.table : []).map(row => `${row.who}: ${STATS.map((stat, at) => `${stat.toUpperCase()}${signed(row.stats[at])}`).join(' ')}${row.skills.length ? `; ${row.skills.map(([name, bonus]) => `${name}${signed(bonus)}`).join(', ')}` : ''}`).join('. ');
    const first = Array.isArray(record?.table) ? record.table[0] : null;
    const example = `? ${ROLL_KIND} ${first?.who ?? 'Astra'} | ${first?.skills?.[0]?.[0] ?? 'Obscure'} | normal | ${dice[0] ?? 14}`;
    return `Dice for this reply, in order: ${dice.join(', ')}. Use one for each attempt that can fail (yours or a party member's): total = die + bonus, against easy ${dc.easy} (routine for a trained person), normal ${dc.normal} (a real chance to fail), hard ${dc.hard} (a skilled person often fails), very hard ${dc['very hard']} (rarely done). Total at the number or over: success; up to ${margin} short: success at a cost; less: fail; a natural 20 always succeeds and a natural 1 always fails.${table ? ` Bonus by stat or skill (level included): ${table}.` : ''} The story must follow each result strictly. Tell only what happens: dice, bonuses, totals and difficulty numbers go only in the ? roll lines, never in the story text. Report each: ? ${ROLL_KIND} Who | skill or stat | difficulty | die, where Who is the person rolling (the reader's character or a party member, by name), never the action; for example ${example}.`;
}
