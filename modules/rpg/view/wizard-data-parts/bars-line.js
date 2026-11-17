// The line under the stat steppers: how large HP, MP and SP are for the stats at the level the character starts at.

import { barsOf } from '../../combat/bars.js';
import { RPG_STRINGS, fill } from '../../strings.js';
import { draftLevel } from './creation.js';

/** "HP 8 · MP 10 · SP 10 at Lv 1" for `draft`'s stats (combat/bars.js: HP from VIT, MP from INT and WIS, SP from STR and AGI, and every one from the level). */
export function barsLine(draft) {
    const level = draftLevel(draft);
    return fill(RPG_STRINGS.wizard.barsLine, { ...barsOf(draft.stats, level), level });
}
