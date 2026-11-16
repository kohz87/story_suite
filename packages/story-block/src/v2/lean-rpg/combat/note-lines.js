// One row of a v1 fight record told for the narrator's settled note, in numbers: who acted on whom, how it landed, the HP before and after. No stage words, no bar
// lines for a miss. The stance a hero stood in is tracked by the caller (`stances`: label → stance type) so a soaked hit can name it.

import { clean } from '../board/note-parts/shared-clean.js';

/** A name as the note tells it: one flat line, cut to 40 code points. */
export const nameOf = value => Array.from(clean(value)).slice(0, 40).join('');
// (the cells of each row kind that hold a label)
const NAMES = { attack: [0, 2], 'foe-attack': [0, 1], heal: [0, 1], tempo: [0], flee: [0, 1] };
const cap = text => (text ? text[0].toUpperCase() + text.slice(1) : text);
const hpOf = (label, before, after) => `${label} HP ${before === after || before === undefined ? '' : `${before} → `}${after}${after === 0 && before > 0 ? ' (down)' : ''}`;
const landed = outcome => (outcome === 'decisive' ? 'hit, decisive' : outcome);

/** The settled-note text of one record row (no trailing full stop), or '' when the row is not told (initiative, order, exchange and foe-phase rows, a failed tempo). */
export function noteLine(line, before, stances = new Map()) {
    if (!Array.isArray(line)) return '';
    const [kind, ...raw] = line, row = raw.map((cell, at) => (NAMES[kind]?.includes(at) ? nameOf(cell) : cell));
    if (kind === 'attack') {
        // (the row says only how the blow was made: 'normal', 'skill' or 'area', not the skill's name, so only an area blow has a tag)
        const [who, how, target, , , , , outcome, , hpAfter] = row, skill = how === 'area' ? ' (area)' : '';
        if (outcome === 'miss-nat1') return `${who} attacks ${target}${skill}: miss (natural 1)`;
        if (outcome === 'miss') return `${who} attacks ${target}${skill}: miss`;
        return `${who} attacks ${target}${skill}: ${landed(outcome)}; ${hpOf(target, before, hpAfter)}`;
    }
    if (kind === 'foe-attack') {
        const [foe, hero, , , , , outcome, soak, , hpAfter] = row, stance = stances.get(hero);
        if (outcome === 'evaded') return `${foe} attacks ${hero}: ${hero} evades`;
        const absorbed = soak > 0 ? (stance === 'defence' ? `; ${hero}'s ${cap(stance)} stance absorbs ${soak}%` : `; ${soak}% absorbed`) : '';
        return `${foe} attacks ${hero}: ${landed(outcome)}${absorbed}; ${hpOf(hero, before, hpAfter)}`;
    }
    if (kind === 'heal') return `${row[0]} heals ${row[1]}: ${hpOf(row[1], before, row[3])}`;
    if (kind === 'tempo') return row[6] ? `${row[0]} acts again` : '';
    if (kind === 'flee') return row[6] ? `${row[0]} flees from ${row[1]} and gets away; the whole party escapes` : `${row[0]} tries to flee from ${row[1]} and fails`;
    return '';
}

/** The stance change a 'stance' row tells, once: a hero taking a stance, or dropping it ('' when nothing changed). Updates `stances` (label → active type or absent). */
export function stanceLine(line, stances) {
    const [, rawWho, active] = line, who = nameOf(rawWho), now = active?.[0] ?? null, was = stances.get(who) ?? null;
    if (now === was) return '';
    if (now) stances.set(who, now); else stances.delete(who);
    return now ? `${who} takes the ${cap(now)} stance` : `${who} drops the ${cap(was)} stance`;
}
