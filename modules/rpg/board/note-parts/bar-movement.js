// Words one bar movement ("Tired → Tired" is left out) for the narrator note and the log.

import { STAGES, stageWord } from '../../names.js';
import { MEMBER_CAP, packLeft } from '../members.js';
import { clean } from './shared-clean.js';

function packSuffix(damage, foe) {
    const count = Number(foe?.count ?? damage?.count ?? damage?.packCount);
    // (a split pack always holds more than five foes before the six-group rule and more than six after, so its flag alone says it is one)
    const flagged = foe?.pack === true || damage?.pack === true;
    if (!(flagged || count > MEMBER_CAP) || !Number.isInteger(count) || count <= (flagged ? 1 : MEMBER_CAP)) return '';
    const left = Number.isFinite(damage?.left) ? damage.left : packLeft(count, damage?.to, damage?.size);
    return ` (about ${left} of ${count} left)`;
}

// A bar that moved within one word ("Tired → Tired") is left out: the board and the narrator speak in words only.
export const barMovement = (damage, resource = false, foe = null) => {
    const kind = resource ? (/:(mana|stamina)$/u.exec(damage.id)?.[1] ?? 'stamina') : 'health';
    const from = stageWord(STAGES[kind], damage.from, damage.size), to = stageWord(STAGES[kind], damage.to, damage.size);
    const virtual = foe?.member === true || foe?.pack === true || (Number.isInteger(foe?.group) && foe?.pack === false);
    const name = clean(virtual ? foe.name : damage.name);
    return from === to ? '' : `${name} ${kind} ${from} → ${to}${resource ? '' : packSuffix(damage, foe)}`;
};
