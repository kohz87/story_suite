// The stat part of a Standard roll: the pair rule and the choice of main and second stat.
import { STAT_KEYS, TYPE_STATS } from './constants.js';
import { num, statOf } from './shared-num.js';

/** (main + second/2)/2, rounded down once. */
export const pair = (main, second) => Math.floor((2 * num(main) + num(second)) / 4);

/**
 * The stat part of a Standard roll.
 * - `skillStat`: a skill's own stat takes the main slot (the second stays the type's).
 * - defence: the higher of AGI and VIT leads (a tie leads with AGI), the other is the second; `style` is 'dodge' (AGI) or
 *   'block' (VIT). Against magic (`againstMagic`) it is the higher of INT and VIT ('ward' or 'block').
 * - check: `fittingStat` (STR climb/force, AGI sneak, DEX locks, INT lore/notice, VIT endure) is the main stat.
 * Returns { value, main, second, style } with stat keys; an unknown type reads as physical.
 */
export function statPart(type, stats, { skillStat = null, fittingStat = null, againstMagic = false } = {}) {
    const known = key => (STAT_KEYS.includes(key) ? key : null);
    if (type === 'defence') {
        const [a, b] = againstMagic ? ['int', 'vit'] : ['agi', 'vit'];
        const lead = known(skillStat) ?? (statOf(stats, a) >= statOf(stats, b) ? a : b);
        const other = lead === a ? b : lead === b ? a : (statOf(stats, a) >= statOf(stats, b) ? a : b);
        const style = lead === 'agi' ? 'dodge' : lead === 'int' ? 'ward' : 'block';
        return { value: pair(statOf(stats, lead), statOf(stats, other)), main: lead, second: other, style };
    }
    const base = TYPE_STATS[type] ?? TYPE_STATS.physical;
    const main = known(skillStat) ?? (type === 'check' ? known(fittingStat) : null) ?? base.main;
    return { value: pair(statOf(stats, main), statOf(stats, base.second)), main, second: base.second, style: null };
}
