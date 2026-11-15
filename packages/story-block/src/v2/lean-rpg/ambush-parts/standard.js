// The ambush edge and how it lifts a Standard act's situation in round 1.
import { FORMULA } from '../names.js';

export const AMBUSH_EDGE = 2;

// Standard: the situation edge goes up and passes through LUK's window again (formula.js edgeWithLuck), from the window the side recorded.
const sideStd = pc => {
    const situation = Math.min(FORMULA.edgeMax, (pc.situation ?? 0) + AMBUSH_EDGE);
    const window = pc.window ?? { min: -3, max: 3 };
    return { ...pc, situation, edge: situation >= 3 ? window.max : Math.max(window.min, situation) };
};

/**
 * Standard: the act as it rolls in round 1 (or as its opening action) of an ambush that worked. A support action is not an attack and keeps its numbers;
 * `base` keeps the entry's place for its dice.
 */
export function ambushedStandard(entry, round, ambush) {
    if (!ambush?.success || round !== 1 || entry.kind !== 'act' || entry.support) return entry;
    return { ...entry, base: entry.base ?? entry, pc: sideStd(entry.pc), ...(entry.plain ? { plain: { ...entry.plain, pc: sideStd(entry.plain.pc) } } : {}) };
}
