// Writes a stat bonus as text: "+2 DEX", "+1 STR +1 DEX".

import { GEAR } from '../stats.js';

/** "+2 DEX", "+1 STR +1 DEX": what stats give, in the order of the seven stats; '' for none. */
export const bonusText = stats => GEAR.stats.filter(stat => Number.isSafeInteger(stats?.[stat]) && stats[stat] > 0).map(stat => `+${stats[stat]} ${stat}`).join(' ');
