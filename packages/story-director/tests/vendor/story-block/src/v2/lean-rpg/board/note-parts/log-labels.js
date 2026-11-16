// Words the board's log lines and area groups for the view.

import { itemLineText } from '../../cue.js';
import { barMovement } from './bar-movement.js';

// The board's log lines (the view reads them; a followup of an area skill under `areaAll` is a group hit alike, not reduced).
const signed = n => n >= 0 ? `+${n}` : String(n);
export const labelLine = line => {
    if (line.item) return itemLineText({ who: line.pc?.who, target: line.target, item: line.item, pool: line.pool, gained: line.gained });
    const pc = line.pc ?? {}, foe = line.foe ?? {}, who = line.flee ? `${pc.who} flees` : line.support ? `${pc.who} heals ${line.target}` : line.reduced ? `… also hits ${foe.name} (reduced)` : line.kind === 'foe' ? `${foe.name} attacks ${pc.who}` : `${pc.who} → ${foe.name}`;
    const bonus = (pc.statBonus ?? 0) + (pc.classBonus ?? 0) + (pc.rank ?? 0) + (pc.edge ?? 0);
    const changes = [line.damage ? barMovement(line.damage) : '', line.cost ? barMovement(line.cost, true) : ''].filter(Boolean);
    const skill = line.skill ? ` (${line.skill})` : '';
    const verdict = `${line.kind === 'foe' ? `${pc.who}'s defence${skill}: ` : ''}${line.kind === 'foe' && Number.isInteger(line.soaked) && line.soaked >= 0 ? 'GLANCED OFF' : String(line.outcome).toUpperCase()}`;
    // (a foe's attack: the foe's own roll first, then the defender's: "raider attacks Astra: raider d20 10 +4 = 14 vs Astra's defence d20 3 +5 = 8 — Astra's defence: FAIL" is a hit)
    const rolls = line.kind === 'foe' && Number.isFinite(foe.total) && Number.isFinite(foe.die)
        ? `${foe.name} d20 ${foe.die} ${signed(foe.total - foe.die)} = ${foe.total} vs ${pc.who}'s defence d20 ${pc.die} ${signed(bonus)} = ${pc.total}`
        : `d20 ${pc.die} ${signed(bonus)} = ${pc.total} vs ${foe.total ?? line.dc}`;
    return `${who}${line.kind === 'foe' ? '' : skill}: ${rolls} — ${verdict}${line.decisive ? ', DECISIVE' : ''}${changes.length ? ` · ${changes.join(' · ')}` : ''}`;
};
export const labelAreaGroup = group => {
    const line = group[0], name = line.aoeName || line.foe?.name || '';
    const changes = group.flatMap(item => [item.damage ? barMovement(item.damage) : '', item.cost ? barMovement(item.cost, true) : '']).filter(Boolean);
    if (line.reduced || line.aoeFollowup) return `… also ${line.outcome === 'fail' ? 'targets' : 'hits'} ${name}${line.reduced ? ' (reduced)' : ''}${changes.length ? ` → ${changes.join(', ')}` : line.outcome === 'fail' ? ' — FAIL' : ''}`;
    const base = labelLine({ ...line, foe: { ...line.foe, name }, damage: undefined, cost: undefined });
    return `${base}${line.aoeNoTarget ? ' · main target Down' : ''}${changes.length ? ` → ${changes.join(', ')}` : ''}`;
};
