// Supplies (food, medicine, light, fuel) in the tail: which items are supplies, and the line that asks to use them up when days pass.

import { defaultWeight } from '../gear.js';
import { promptNote } from './phrases.js';

// Whole words in a name or note, any case.
const WORDS = [
    'rations?', 'provisions', 'food', 'bread', 'biscuits?', 'jerky', 'meat', 'cheese', 'eel', 'fish', 'meals?', 'water', 'wine', 'ale', 'cider',
    'medicine', 'salves?', 'bandages?', 'herbs?', 'poultices?', 'potions?', 'draughts?', 'tonics?', 'elixirs?', 'antidotes?',
    'oil', 'torch(?:es)?', 'candles?', 'lamps?', 'firewood', 'fodder', 'feed',
];
const SUPPLY = new RegExp(`(?<![\\p{L}\\p{N}])(?:${WORDS.join('|')})(?![\\p{L}\\p{N}])`, 'iu');

// A paper about supplies is not one: a thing named as a paper, pass, ledger, ... weighs nothing as goods (gear's default weight).
const paper = item => ['goods', 'material', 'quest'].includes(item.kind) && defaultWeight({ name: item.name, kind: 'goods' }) === 0;

/** Whether a listed item is a supply: of kind supply; else (items from before the kind) a consumable (gear on), or a supply word in its name or note. */
export function isSupply(item, gear = false) {
    if (item.kind === 'supply') return true;
    if (paper(item)) return false;
    return (gear && item.kind === 'consumable') || SUPPLY.test(String(item.name ?? '')) || SUPPLY.test(promptNote(item.note));
}

const dayOf = state => {
    const minutes = state?.domains?.director?.time?.minutes;
    return Number.isSafeInteger(minutes) ? Math.floor(minutes / 1440) : null;
};

/**
 * Whole story days the latest reply moved the clock on: the day now against the day in the state before it (`view.beforeLatestReply()`,
 * read from what is stored, so a swipe, a Re-read and a reload read the same). 0 without a clock on either side, on the same day, or when the clock went back.
 */
export function storyDaysPassed(view) {
    const now = dayOf(view?.state);
    if (now === null) return 0;
    const then = dayOf(view.beforeLatestReply?.());
    return then === null ? 0 : Math.max(0, now - then);
}

/** The upkeep line for `days` story days gone by. */
export const upkeepCue = days => `${days === 1 ? '1 day has' : `${days} days have`} passed: the party ate and used supplies (the Supplies line). Write their change lines (- item Name | qty: n, or ~ item Name | note: what is left, e.g. "3 days of food left").`;
