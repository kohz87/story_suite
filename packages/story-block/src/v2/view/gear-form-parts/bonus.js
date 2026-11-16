// Gear form: the two Bonus lines (stat and points boxes, live points line) and reading them back into a stats object.

import { STRINGS } from '../../strings.js';
import { GEAR } from '../../domains/gear.js';
import { SHOWN } from './shared-limits.js';
import { statOptions } from './shared-options.js';

const F = STRINGS.inventory.gear.form;
const E = STRINGS.editMessages;
const N = STRINGS.inventory;

// The Bonus lines (two), their stat and points boxes, and (when they can be changed) the live points line after them.
export function bonusFields(stats, locked) {
    const listed = Object.entries(stats && typeof stats === 'object' ? stats : {}).slice(0, GEAR.maxStats);
    const out = [];
    for (const at of [1, 2]) {
        const one = listed[at - 1];
        const extra = locked ? { disabled: true, title: F.laterTitle } : {};
        out.push({ key: `stat${at}`, label: at === 1 ? F.bonus : F.stat, ...(at === 1 ? {} : { hideLabel: true }), type: 'choice', options: statOptions(), value: one?.[0] ?? '', group: F.groupGear, row: `bonus${at}`, showWhen: SHOWN, ...extra });
        out.push({ key: `points${at}`, label: F.amount, hideLabel: true, type: 'number', min: 1, max: 6, soft: true, value: one?.[1] ?? '', group: F.groupGear, row: `bonus${at}`, showWhen: SHOWN, ...extra });
    }
    if (!locked) {
        out.push({ key: 'budget', type: 'points', group: F.groupGear, showWhen: SHOWN, rarity: 'rarity', lines: [['stat1', 'points1'], ['stat2', 'points2']],
            budget: { ...GEAR.budget }, words: { ...N.rarities }, text: F.points, none: F.pointsNone });
    }
    return out;
}

// The stats the two Bonus lines name, { STR: 1 }: a line with a stat needs its points (a whole number of at least 1); a line with points only is no line.
export function statsOf(all) {
    const stats = {};
    for (const [stat, points] of [['stat1', 'points1'], ['stat2', 'points2']]) {
        const name = String(all[stat] ?? '');
        if (!name) continue;
        const n = all[points];
        if (!Number.isSafeInteger(n) || n < 1) return { error: E.kitStats.replace('{max}', String(GEAR.maxStats)) };
        stats[name] = (stats[name] ?? 0) + n;
    }
    return { stats };
}
