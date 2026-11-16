// A foe's numbers by class: its Health blocks and what it adds to its roll.
import { STANDARD_NUMBERS } from './constants.js';
import { num } from './shared-num.js';

/** A foe's Health blocks: 4 + class/3 (Classes I–II 4, III–V 5, VI–VIII 6, IX 7). */
export const foeHealthBlocks = foeClass => 4 + Math.floor(Math.max(1, num(foeClass)) / 3);

/** What a foe adds to its roll: foeBase + foeClassWeight × class. */
export const foeBonus = (foeClass, numbers = STANDARD_NUMBERS) => num(numbers.foeBase) + num(numbers.foeClassWeight) * Math.max(1, num(foeClass));
