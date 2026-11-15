// Luck's window on the edge: the window by LUK, the LUK steps and the edge held inside it.
import { num } from './shared-num.js';

/**
 * Luck is a window on the edge, by LUK (stats start at 5): LUK 3–4 −3..+3, 5–6 −2..+3, 7–8 −1..+3, 9–10 −1..+3, 11–12 0..+3, 13–14 +1..+4,
 * 15–16 +2..+4, 17–18 +2..+5, 19–20 +3..+5 (below 3 is the same as 3). → { min, max }
 */
export function luckWindow(luk) {
    const step = Math.max(0, Math.min(8, Math.floor((Math.max(3, num(luk)) - 3) / 2)));
    return { min: [-3, -2, -1, -1, 0, 1, 2, 2, 3][step], max: [3, 3, 3, 3, 3, 4, 4, 5, 5][step] };
}

/** The LUK values at which the window changes (the next one is what the Party line and the steppers name). */
export const LUCK_STEPS = Object.freeze([5, 7, 11, 13, 15, 17, 19]);

/**
 * The situation's edge (−3 to +3) held inside LUK's window: never below its low end, and a best-case situation (+3) reaches its high end.
 * Anything between stays as the situation made it (raised to the low end when that is higher). The result is within the window.
 */
export function edgeWithLuck(edge, luk) {
    const { min, max } = luckWindow(luk), e = Math.max(-3, Math.min(3, num(edge)));
    return e >= 3 ? max : Math.max(min, e);
}
