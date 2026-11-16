// Reads the standing members and words their health, target and pack lines.

import { STAGES, stageWord } from '../../names.js';
import { memberValue } from './shared-values.js';

/** The members still standing, in board order. */
export const standingMembers = members => (Array.isArray(members) ? members : [])
    .filter(member => member?.standing !== false && memberValue(member) > 0);

/** A member's or pack's health word over its own bar ("Unhurt", "Hurt", "Down"). */
export function memberHealthWord(member) {
    const size = Math.max(1, Math.trunc(Number(member?.size) || 1));
    return stageWord(STAGES.health, memberValue(member), size);
}

/** A numbered target line in the board's own wording: "1. Bristle-boar 1  Unhurt". */
export const memberTargetLine = (member, number) => `${number}. ${member?.name ?? ''}  ${memberHealthWord(member)}`;

/** A pack's thinning line: "About 8 left · 2 attacks each exchange". */
export function memberPackLine(member) {
    const left = Math.max(0, Math.trunc(Number(member?.left) || 0));
    const attacks = Math.max(0, Math.trunc(Number(member?.attacks) || 0));
    return `About ${left} left · ${attacks} ${attacks === 1 ? 'attack' : 'attacks'} each exchange`;
}
