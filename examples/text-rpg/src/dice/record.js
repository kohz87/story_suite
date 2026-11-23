// Checks a reply's dice record and draws a fresh set from a seed and floor.
// Adapted from modules/rpg/checks/dice-parts/record.js and modules/rpg/checks/dice-parts/recorded.js (keep in step when that file changes).

import { DICE_COUNT, replyDice } from './roll.js';

const FLOOR_MAX = 4;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isDie = value => Number.isInteger(value) && value >= 1 && value <= 20;

function floorOf(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.min(FLOOR_MAX, Math.max(0, Math.trunc(value)));
}

/** A checked dice record: { list, floor }, or null when the list or floor is invalid. */
export function diceOf(value) {
    if (!isObject(value) || !Array.isArray(value.list) || value.list.length !== DICE_COUNT) return null;
    if (!value.list.every(isDie)) return null;
    const floor = value.floor === undefined ? 0 : value.floor;
    if (!Number.isInteger(floor) || floor < 0 || floor > FLOOR_MAX) return null;
    return { list: [...value.list], floor };
}

/** Draws a reply's dice from its seed and keeps the floor clamped to 0..4. */
export function drawDice(seed, floor) {
    return { list: replyDice(seed), floor: floorOf(floor) };
}
