// Makes the narrator's settled account, one cue line per outcome and bar movement.

import { BATTLE_MARKER } from '../../names.js';
import { itemLineText } from '../../cue.js';
import { MEMBER_CAP, MEMBER_CAP_SIX } from '../members.js';
import { barMovement } from './bar-movement.js';
import { fightLength } from './fight-length.js';
import { clean } from './shared-clean.js';

function lineNote(line, members = null) {
    // (a bag item: told as the act it was; the unit is already gone, so the narrator is not to write an item line for it)
    if (line.item) return `${itemLineText({ who: clean(line.pc?.who), target: clean(line.target), item: clean(line.item), pool: line.pool, gained: line.gained })}; already used up, so no item line for it`;
    const who = clean(line.pc?.who), foe = clean(line.foe?.name), skill = line.skill ? ` (${clean(line.skill)})` : '';
    const area = line.aoe ? (line.reduced ? ' (area, reduced)' : ' (area)') : '';
    const action = line.flee ? `${who} flees from ${foe}` : line.support ? `${who} heals ${clean(line.target)}${skill}` : line.kind === 'foe' ? `${foe} attacks ${who}` : `${who} attacks ${foe}${skill}${area}`;
    const result = line.outcome === 'cost' ? 'success at a cost' : line.outcome;
    // (a hit soaked by the defender's VIT, even at soak 0: told briefly, no number)
    const glance = line.kind === 'foe' && Number.isInteger(line.soaked) && line.soaked >= 0;
    const verdict = glance ? `blow glances off${skill}` : line.kind === 'foe' ? `${who}'s defence${skill}: ${result}` : result;
    const slot = line.foe?.slot ?? Number(/^f:(\d+)/u.exec(line.damage?.id ?? '')?.[1] ?? NaN);
    const target = line.kind === 'foe' ? null : { ...(members?.get(slot) ?? {}), ...(line.foe ?? {}) };
    const changes = [line.damage ? barMovement(line.damage, false, target) : '', line.cost ? barMovement(line.cost, true) : ''].filter(Boolean);
    return `${action}: ${line.aoeNoTarget ? 'main target already Down; ' : ''}${verdict}${line.decisive ? ', decisive' : ''}${changes.length ? `; ${changes.join('; ')}` : ''}`;
}

function newFoesNote(result, setup) {
    if (!Array.isArray(result.members) || !Array.isArray(setup?.opened) || !setup.opened.length) return '';
    const foes = setup.opened.filter(entry => entry && clean(entry.name) && Number.isInteger(entry.count) && entry.count > 0).map(entry => {
        const cap = setup?.foesSix === 1 ? MEMBER_CAP_SIX : MEMBER_CAP, list = entry.count >= 2 && entry.count <= cap ? ', each fought on its own' : entry.count > cap ? ', fought as a pack' : '';
        return `${clean(entry.name)} ×${entry.count}${Number.isInteger(entry.level) ? ` (Lv ${entry.level})` : ''}${list}`;
    });
    return foes.length ? `New foes: ${foes.join(', ')}.` : '';
}

/** A compact but complete list of settled outcomes and changes, followed by the fight's status. */
export function settledNote(result, setup = null) {
    const lines = [result.fromApproach ? 'Tell the approach, then the settled fight results in order; do not reroll them.' : 'Tell the settled fight results in order; do not reroll them.',
        `Write ${BATTLE_MARKER} on its own line where the fight is told.`,
        'Code has already moved the bars for these results; never set those yourself.'];
    // (only a fight opened under the fightLen mark, and one with exchanges: an opening-only or empty account has nothing to shorten)
    if (setup?.fightLen === 1 && (result.rounds ?? []).length) lines.push(fightLength(result));
    const members = new Map((Array.isArray(result.members) ? result.members : []).filter(entry => Number.isInteger(entry?.slot)).map(entry => [entry.slot, entry]));
    const newFoes = newFoesNote(result, setup);
    if (newFoes) lines.push(newFoes);
    for (const line of result.opening ?? []) lines.push(`Opening: ${lineNote(line, members)}.`);
    const wear = Array.isArray(result.wear) ? result.wear : [], included = new Set();
    const wearNote = event => `${clean(event.who)}'s ${clean(event.item)} condition: ${clean(event.from)} → ${clean(event.to)}`;
    for (const round of result.rounds ?? []) {
        const changes = wear.flatMap((event, index) => {
            if (event.n !== round.n) return [];
            included.add(index);
            return [wearNote(event)];
        });
        const unpaid = (round.idle ?? []).filter(item => item.why === 'no-resource').map(item => `${clean(item.who)} cannot heal: the skill's resource is Empty`);
        lines.push(`Exchange ${round.n}: ${[...round.lines.map(line => lineNote(line, members)), ...unpaid, ...changes].join(' | ') || 'No one acted'}.`);
    }
    wear.forEach((event, index) => { if (!included.has(index)) lines.push(`Exchange ${event.n}: ${wearNote(event)}.`); });
    const end = { won: 'The fight is won. Code gives the party its XP.', lost: 'The fight is lost.', fled: 'The party fled.', open: 'The fight is still open.' };
    lines.push(end[result.stop] ?? 'The fight is still open.');
    lines.push(result.stop === 'open' ? 'The fight is still in progress; do not tell a post-fight aftermath yet.'
        : result.stop === 'won' ? 'Then follow the reader’s requested aftermath as the outcome permits.'
            : 'Then follow the reader’s requested aftermath only as the outcome permits; do not assume the foes or their possessions are accessible or looting succeeds.');
    return lines.join(' | ');
}
