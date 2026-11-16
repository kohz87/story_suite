// Builds the UI's virtual foe list, with values over the bars rebuilt from the real block.

import { memberSize } from './member-size.js';
import { packLeft } from './pack-bars.js';
import { packAttacks, packFullAttacks } from './pack-attacks.js';
import { attackList } from './attacks.js';
import { splitFoes } from './split-foes.js';
import { held, num, valuesAt } from './shared-numbers.js';
import { groupOf, nOf } from './shared-slots.js';

/** The UI's virtual foe list: values override the bars rebuilt from the real block. Under `hard` (with the standing `party` and the next exchange's `round`) a bar's `attacks` is what attackList gives it. */
export function boardFoes(realFoes, values, { maxOf, carried = null, six = false, hard = false, party = 0, round = 1 } = {}) {
    const list = splitFoes(realFoes, { maxOf, carried, six }).map(foe => {
        const size = Number.isFinite(Number(foe.size)) ? num(foe.size) : memberSize(foe, maxOf);
        const value = held(valuesAt(values, foe.slot) ?? foe.hurt, size), standing = value > 0;
        if (foe.pack) {
            return { slot: foe.slot, group: foe.group, n: foe.n, name: foe.name, value, size, pack: true, count: foe.count,
                left: packLeft(foe.count, value, size), attacks: packAttacks(foe.count, value, size, foe.full), standing };
        }
        return { slot: foe.slot, group: groupOf(foe), n: nOf(foe), name: foe.name, value, size, pack: false, count: 1,
            left: standing ? 1 : 0, attacks: standing ? 1 : 0, standing };
    });
    if (!hard) return list;
    const up = list.filter(foe => foe.standing).map(foe => ({ slot: foe.slot, group: foe.group, pack: foe.pack, count: foe.count, hurt: foe.value, size: foe.size, full: foe.pack ? packFullAttacks(foe.count, six) : undefined }));
    const made = attackList(up, party, { hard, round });
    return list.map(foe => ({ ...foe, attacks: made.filter(one => one.slot === foe.slot).length }));
}
