// World events, the daily step: the Director's stored verdict on one event's roll today (switch story-director.world-events; the world's ledger
// `marks`, world-judge/calls.js). A veto discards today's roll (the event stays eligible and rolls again the next day, as a cap-blocked one);
// a weight (0.5-2) multiplies today's odds. Never for a set-in-motion event (it is certain inside its window). Only what is stored is read, so
// a replay or a Re-read of the crossing reply rolls the same way. Pure.

/** `{ chance, veto }`: today's chance for `def` with the Director's mark for (`def.id`, `day`) applied; `veto` the reason when vetoed, else ''. */
export function markedChance(ws, def, day, chance) {
    const mark = def.certainty === 'set-in-motion' ? null : ws.directorMarks?.[`${def.id}|${day}`];
    if (!mark || chance.blocked) return { chance, veto: '' };
    if (typeof mark.veto === 'string') return { chance, veto: mark.veto || 'the Director vetoed it' };
    const weight = typeof mark.weight === 'number' && mark.weight >= 0.5 && mark.weight <= 2 ? mark.weight : 1;
    if (weight === 1 || chance.p <= 0 || chance.p >= 1) return { chance, veto: '' };
    const odds = (chance.p / (1 - chance.p)) * weight;
    return { chance: { ...chance, p: Math.min(1, odds / (1 + odds)) }, veto: '' };
}
