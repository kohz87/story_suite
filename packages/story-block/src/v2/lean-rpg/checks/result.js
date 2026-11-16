// The result of one validated story check: d20 + stat÷2 + level÷4 (+ half mastery of a utility skill), against the difficulty number, with the margin recorded with the
// reply's dice (success or fail; decisive as in fights). `workChecks` runs a reply's lines in order; `bonusTable` is what the narrator is told
// beforehand (the same numbers, for every stat and skill). A skilled check gives its skill one practice use; checks never give XP. Pure: the rules come in.

import { RANKS } from '../combat/numbers.js';
import { PARTY_MAX, STATS } from '../names.js';
import { fold } from '../read.js';
import { parseCheckLine, validateCheck } from './line.js';
import { checkBonus, checkOutcome, checkStat } from './v1-roll.js';

const whole = value => (Number.isInteger(value) ? value : null);
const cut = value => [...String(value ?? '')].slice(0, 40).join('');

/** The bonus code adds to the die, for every stat and skill of each party member: [{ who, stats: [7 numbers in STATS order], skills: [[name, bonus]] }]. */
export function bonusTable(party) {
    return (Array.isArray(party) ? party : []).slice(0, PARTY_MAX).map(member => ({ who: cut(member.name), stats: STATS.map(stat => checkBonus(member, null, stat)),
        skills: (Array.isArray(member.skills) ? member.skills : []).slice(0, 11).map(skill => [cut(skill.name), checkBonus(member, skill, null)]) }));
}

// What the note's table showed for this check: { bonus } (the number it told), or { bonus: 0, unlisted: 'member' | 'skill' } when the table had no such member or skill.
function shownBonus(table, member, skill, stat) {
    const row = table.find(entry => fold(entry.who) === fold(cut(member.name)));
    if (!row) return { bonus: 0, unlisted: 'member' };
    const found = skill ? row.skills.find(entry => fold(entry[0]) === fold(cut(skill.name))) : [null, row.stats[STATS.indexOf(stat)]];
    return Number.isInteger(found?.[1]) ? { bonus: found[1] } : { bonus: 0, unlisted: 'skill' };
}

/**
 * A validated check (`validateCheck`) and its die (the same one). With the note's `table` (an array) the check is worked at the bonus the note showed.
 * → { who, member, skill, stat, what, difficulty, dc, die, rank, bonus, total, outcome, decisive, utility, practice }.
 */
export function resolveCheck(check, die, table = null) {
    const member = check.member;
    const skill = check.skill ?? null;
    const stat = checkStat(skill, check.stat);
    const rank = whole(skill?.rank) ?? 0;
    // A reply with the note's table is worked at the bonuses the note showed; someone or a skill it did not show rolls with no bonus.
    const shown = table ? shownBonus(table, member, skill, stat) : null;
    const bonus = shown ? shown.bonus : checkBonus(member, skill, check.stat);
    const total = die + bonus;
    return {
        who: member.name, member, skill, stat, what: skill?.name ?? stat.toUpperCase(), difficulty: check.difficulty, dc: check.dc,
        die, rank, rankName: RANKS[rank]?.name ?? `Rank ${rank}`, bonus, total, ...checkOutcome(die, bonus, check.dc),
        utility: String(skill?.type).toLowerCase() === 'utility', ...(shown?.unlisted ? { unlisted: shown.unlisted } : {}),
        practice: skill ? { who: member.name, skill: skill.name, n: 1 } : null,
    };
}

// A result as the record keeps it: plain numbers and words only (no member or skill objects).
function keptResult(result, perUse) {
    return { who: result.who, what: result.what, stat: result.stat, utility: result.utility === true, rank: result.rank, rankName: result.rankName, difficulty: result.difficulty, dc: result.dc,
        die: result.die, bonus: result.bonus, total: result.total, outcome: result.outcome, decisive: result.decisive === true,
        ...(result.unlisted ? { unlisted: result.unlisted } : {}),
        ...(result.practice ? { practice: { skill: result.practice.skill, n: 1 }, practiceGained: perUse } : {}) };
}

/**
 * A reply's check lines worked in order against `party`, with `dice` = { list, rules, dc, perUse } as recorded with the reply (null: none was offered)
 * and `table` the note's bonus table when the reply was worked by it (null: the sheet's bonuses, as older replies were).
 * `inOrder` (a reply marked `diceInOrder`): each check takes the next die in order; a line that wrote another die is worked with code's and says so.
 * → { results (kept records), notes (one reason for each refused line), uses (practice: [{ who, skill, n }]) }.
 */
export function workChecks(party, lines, dice, table = null, inOrder = false) {
    const results = [], notes = [], used = [], count = new Map();
    for (const raw of lines) {
        const check = dice ? validateCheck(parseCheckLine(raw, { dieOptional: inOrder }), { party, offeredDice: dice.list, usedDice: used, dc: dice.dc, inOrder }) : { ok: false, reason: 'no dice were offered this reply' };
        if (!check.ok) { notes.push(`"${raw}" was not used: ${check.reason}.`); continue; }
        used.push(check.die);
        if (check.wrote !== undefined) notes.push(`"${raw}" was worked with ${check.die}, the next die in order (the line wrote ${check.wrote}).`);
        const done = resolveCheck(check, check.die, table);
        if (done.unlisted) notes.push(`${done.who} rolled ${done.what} with no bonus: ${done.unlisted === 'member' ? 'they were' : 'it was'} not in the table the note showed.`);
        results.push(keptResult(done, dice.perUse));
        if (!done.practice) continue;
        const key = `${fold(done.who)}\u0000${fold(done.practice.skill)}`;
        const found = count.get(key) ?? { who: done.who, skill: done.practice.skill, n: 0 };
        found.n += 1;
        count.set(key, found);
    }
    const uses = [...count.values()].sort((a, b) => fold(a.who).localeCompare(fold(b.who)) || fold(a.skill).localeCompare(fold(b.skill)));
    return { results, notes, uses };
}
