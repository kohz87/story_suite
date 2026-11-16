// Collapses the virtual bars' final values back into count and hurt changes for the real Foes block.

import { isPack, capOf } from './shared-caps.js';
import { memberSize } from './member-size.js';
import { packCounts, packLeft, packSize } from './pack-bars.js';
import { held, num, valuesAt } from './shared-numbers.js';
import { virtualSlot } from './shared-slots.js';

function packBars(real, values, maxOf) {
    const one = memberSize(real, maxOf), group = num(real?.slot);
    return packCounts(real.count).map((count, at) => {
        const n = at + 1, size = packSize(one, count), raw = valuesAt(values, virtualSlot(group, n));
        return { count, n, one, size, value: raw === undefined ? 0 : held(raw, size) };
    });
}

/** Collapse virtual final values into ordinary count/hurt changes for the real Foes block. */
export function collapseFoes(realFoes, values, { maxOf, six = false } = {}) {
    const out = [], cap = capOf(six);
    for (const real of (Array.isArray(realFoes) ? realFoes : [])) {
        const group = num(real?.slot), count = num(real?.count), hurt = num(real?.hurt);
        if (!real?.filled || count <= 0 || hurt <= 0) continue;
        let toCount = count, toHurt = 0;
        if (isPack(real, six)) {
            const standing = packBars(real, values, maxOf).filter(bar => bar.value > 0);
            if (standing.length) {
                toCount = standing.reduce((sum, bar) => sum + packLeft(bar.count, bar.value, bar.size), 0);
                toHurt = Math.max(...standing.map(bar => Math.max(1, Math.ceil(bar.one * bar.value / bar.size))));
            }
        } else {
            const one = memberSize(real, maxOf);
            const standing = Array.from({ length: Math.min(cap, count) }, (_, at) => held(valuesAt(values, virtualSlot(group, at + 1)), one))
                .filter(value => value > 0);
            if (standing.length) { toCount = standing.length; toHurt = Math.max(...standing); }
        }
        out.push({ slot: group, module: real.module, count: { from: count, to: toCount }, hurt: { from: hurt, to: toHurt } });
    }
    return out;
}
