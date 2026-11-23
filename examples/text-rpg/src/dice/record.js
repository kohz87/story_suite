// Checks a reply's dice record and draws a fresh set from a seed and floor.
// Adapted from modules/rpg/checks/dice-parts/record.js and modules/rpg/checks/dice-parts/recorded.js (keep in step when that file changes).

import { DICE_COUNT, replyDice } from './roll.js';

const FLOOR_MAX = 5;
const BANDS = ['favoured', 'even', 'outmatched', 'hopeless'];
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isDie = value => Number.isInteger(value) && value >= 1 && value <= 20;

function floorOf(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.min(FLOOR_MAX, Math.max(0, Math.trunc(value)));
}

/** The matchup the reply was offered with, `{ band, why }`, or null when it is not one. */
function matchupOf(value) {
    return isObject(value) && BANDS.includes(value.band) && typeof value.why === 'string' ? { band: value.band, why: value.why.slice(0, 160) } : null;
}

/** A checked dice record: { list, floor, rules?, clock?, matchup? } (`matchup`: what the narrator was told of the fight, for the card; `rules` is read by the xp line, which checks it; `clock` is the story minute the step was made at, read by `~ train`), or null when the list or floor is invalid. */
export function diceOf(value) {
    if (!isObject(value) || !Array.isArray(value.list) || value.list.length !== DICE_COUNT) return null;
    if (!value.list.every(isDie)) return null;
    const floor = value.floor === undefined ? 0 : value.floor;
    if (!Number.isInteger(floor) || floor < 0 || floor > FLOOR_MAX) return null;
    const rules = isObject(value.rules) && Number.isInteger(value.rules.cap) && Number.isInteger(value.rules.rate) ? { cap: value.rules.cap, rate: value.rules.rate } : null;
    const clock = Number.isInteger(value.clock) && value.clock >= 0 ? value.clock : null;
    const matchup = matchupOf(value.matchup);
    return { list: [...value.list], floor, ...(rules ? { rules } : {}), ...(clock !== null ? { clock } : {}), ...(matchup ? { matchup } : {}) };
}

/** Draws a reply's dice from its seed and keeps the floor clamped to 0..5 (and the matchup, when it is one). */
export function drawDice(seed, floor, matchup = null) {
    const told = matchupOf(matchup);
    return { list: replyDice(seed), floor: floorOf(floor), ...(told ? { matchup: told } : {}) };
}
