// Splits the real Foes block into virtual bars, and records the exact bars a result carries to the next segment.

import { MEMBER_CAP, capOf, isPack } from './shared-caps.js';
import { memberSize } from './member-size.js';
import { packCounts, packSize } from './pack-bars.js';
import { packFullAttacks } from './pack-attacks.js';
import { held, num } from './shared-numbers.js';
import { groupOf, nOf, valueOf, virtualSlot } from './shared-slots.js';

const memberName = (name, n, count) => (num(count) === 1 ? name : `${name} ${n}`);
const packValue = (hurt, one, size) => held(Math.ceil(size * held(hurt, one) / Math.max(1, one)), size);
const packName = (name, n, count) => (count === 1 ? name : `${name} pack ${n}`);

const carriedValues = carried => (carried && typeof carried.values === 'object' ? carried.values : null);
const carriedCount = (carried, group) => {
    const count = num(carried?.counts?.[group]);
    return count > 0 ? count : null;
};
const carriedValue = (values, slot) => (values && Object.hasOwn(values, slot) && Number.isFinite(Number(values[slot]))
    ? Number(values[slot]) : undefined);

/** Split filled, standing real slots into virtual foes, sorted by group then number. A Down group has no bars. */
export function splitFoes(realFoes, { carried = null, maxOf, six = false } = {}) {
    const out = [], cap = capOf(six);
    for (const real of (Array.isArray(realFoes) ? realFoes : [])) {
        const group = num(real?.slot), blockCount = num(real?.count), hurt = num(real?.hurt);
        if (!real?.filled || blockCount <= 0) continue;
        const count = carriedCount(carried, group) ?? blockCount, values = carriedValues(carried);
        if (count === 1 && blockCount === 1) {
            // A real count-one foe always writes its own field. Its carried count only keeps a foe that went
            // Down during this open fight on the list; a group that was already Down was never in the fight.
            if (hurt <= 0 && carriedCount(carried, group) === null) continue;
            out.push(hurt <= 0 ? { ...real, hurt: 0 } : real);
            continue;
        }
        if (hurt <= 0) continue;
        const one = memberSize(real, maxOf);
        if (isPack(real, six)) {
            const counts = packCounts(count);
            counts.forEach((packCount, at) => {
                const n = at + 1, size = packSize(one, packCount);
                const exact = carriedValue(values, virtualSlot(group, n));
                const value = exact === undefined ? packValue(hurt, one, size) : held(exact, size);
                out.push({ ...real, slot: virtualSlot(group, n), group, n, name: packName(real.name, n, counts.length),
                    module: null, levelled: true, size, hurt: value, count: packCount, filled: true, pack: true, full: packFullAttacks(packCount, six) });
            });
            continue;
        }
        for (let n = 1; n <= Math.min(cap, count); n += 1) {
            const exact = carriedValue(values, virtualSlot(group, n));
            const value = exact === undefined ? held(hurt, one) : held(exact, one);
            out.push({ ...real, slot: virtualSlot(group, n), group, n, name: memberName(real.name, n, count), module: null,
                levelled: true, size: one, hurt: value, count: 1, filled: true, member: true });
        }
    }
    return out.sort((a, b) => groupOf(a) - groupOf(b) || nOf(a) - nOf(b));
}

/** The exact bars a committed result records as the next segment's carried state. */
export function carriedFrom(members) {
    const values = {}, counts = {};
    for (const member of (Array.isArray(members) ? members : [])) {
        const group = groupOf(member), slot = Number.isInteger(member?.slot) ? member.slot : virtualSlot(group, nOf(member) || 1);
        const value = Number(valueOf(member));
        if (!Number.isFinite(group) || !Number.isFinite(value)) continue;
        // Carried bars are for virtual foes only. A real count-one foe's next value comes from its live field.
        if (slot !== group) values[slot] = value;
        counts[group] = (counts[group] ?? 0) + (member?.pack ? Math.max(0, num(member.count)) : 1);
    }
    return Object.keys(counts).length ? { values, counts } : null;
}
