// A horde fight's reserve rules, pure: the recorded reserve checked (`hordeOf`), its moving state at the start (`hordeStart`), the refill that puts the next
// reserve groups into emptied slots at the end of an exchange (`refill`), and whether the named leader has fallen (`leaderDown`).
// A refill draws no dice: the arrivals act from the next exchange on, after every foe already in the order, so a fight replays the same from its steps.
// Ids: a front foe is `<slot>.<n>` (combat/input.js); an arrival is `<slot>.<wave>.<n>` (wave 1, 2 …), so its slot is still the id's first part. Its group key is the id less its last part.
import { foeMembers } from './foes.js';
import { TIERS, V1 } from './numbers.js';

const H = V1.horde;
const plain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const whole = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const name = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 40;
const keyOf = foe => String(foe.id).split('.').slice(0, -1).join('.');
const slotOf = foe => Number.parseInt(String(foe.id).split('.')[0], 10);
const waveOf = foe => { const parts = String(foe.id).split('.'); return parts.length > 2 ? Number(parts[1]) : 0; };
const down = foe => !(Number(foe?.hp) > 0);
const escaped = text => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

/**
 * The setup's `horde` checked: `{ v: 1, reserve: [{ name, count, level, tier, leader? }], hold?, leaderSlot? }` (a copy), or null when it is not one.
 * At most one leader (a front slot or one reserve group); the reserve within `V1.horde` (groups, foes); `hold` 4..20; a horde with no reserve needs a hold or a leader.
 */
export function hordeOf(raw) {
    if (!plain(raw) || raw.v !== 1 || !Array.isArray(raw.reserve) || raw.reserve.length > H.groups) return null;
    const reserve = raw.reserve.map(group => (plain(group) && name(group.name) && whole(group.count, 1, V1.foe.groupMax) && whole(group.level, V1.level.min, V1.level.max)
        && Object.hasOwn(TIERS, group.tier) && (group.leader === undefined || group.leader === true)
        ? { name: group.name, count: group.count, level: group.level, tier: group.tier, ...(group.leader ? { leader: true } : {}) } : null));
    if (reserve.some(group => !group) || reserve.reduce((sum, group) => sum + group.count, 0) > H.reserveFoes) return null;
    if (raw.hold !== undefined && !whole(raw.hold, H.hold.min, H.hold.max)) return null;
    if (raw.leaderSlot !== undefined && !whole(raw.leaderSlot, 1, 6)) return null;
    if (reserve.filter(group => group.leader).length + (raw.leaderSlot === undefined ? 0 : 1) > 1) return null;
    const out = { v: 1, reserve, ...(raw.hold === undefined ? {} : { hold: raw.hold }), ...(raw.leaderSlot === undefined ? {} : { leaderSlot: raw.leaderSlot }) };
    return reserve.length || out.hold || out.leaderSlot ? out : null;
}

/** The moving state of a horde at its first exchange: `{ next: 0, wave: 0, leader }` (`leader` = the front leader's group key, else null until the reserve's leader arrives). */
export const hordeStart = horde => ({ next: 0, wave: 0, leader: horde.leaderSlot === undefined ? null : String(horde.leaderSlot) });

// The label of each new member: a lone foe whose name is not used yet keeps it bare; else "<name> <k>", k counting on from the highest number that name has in this fight.
function labelsOf(foes, group) {
    const pattern = new RegExp(`^${escaped(group.name)} (\\d+)$`, 'u');
    const used = foes.map(foe => (foe.label === group.name ? 1 : Number(pattern.exec(String(foe.label))?.[1] ?? 0)));
    const top = Math.max(0, ...used);
    if (group.count === 1 && top === 0) return [group.name];
    return Array.from({ length: group.count }, (_, at) => `${group.name} ${top + at + 1}`);
}

/**
 * End of an exchange that left the fight open: every slot whose current group (its latest wave) has fallen takes the next reserve group, slots in ascending order,
 * until the reserve or the empty slots run out. All of one exchange's arrivals are one wave. → `{ foes, order, state, lines }` (the same `foes`/`order`/`state` when none came).
 * `lines` holds one `['arrive', wave, slot, name, count, level, tier, left]` per group (`left`: foes still in the reserve).
 */
export function refill(foes, order, horde, state) {
    if (state.next >= horde.reserve.length) return { foes, order, state, lines: [] };
    const slots = [...new Set(foes.map(slotOf))].filter(Number.isInteger).sort((a, b) => a - b);
    const empty = slots.filter(slot => {
        const mine = foes.filter(foe => slotOf(foe) === slot), wave = Math.max(...mine.map(waveOf));
        return mine.filter(foe => waveOf(foe) === wave).every(down);
    });
    if (!empty.length) return { foes, order, state, lines: [] };
    const wave = state.wave + 1, added = [], lines = [];
    let next = state.next, leader = state.leader;
    for (const slot of empty) {
        if (next >= horde.reserve.length) break;
        const group = horde.reserve[next], labels = labelsOf([...foes, ...added], group);
        next += 1;
        foeMembers(group).forEach((member, at) => added.push({ ...member, id: `${slot}.${wave}.${at + 1}`, label: labels[at], slot }));
        if (group.leader) leader = `${slot}.${wave}`;
        lines.push(['arrive', wave, slot, group.name, group.count, group.level, group.tier, horde.reserve.slice(next).reduce((sum, left) => sum + left.count, 0)]);
    }
    return { foes: [...foes, ...added], order: { ...order, foes: [...order.foes, ...added.map(foe => foe.id)] }, state: { next, wave, leader }, lines };
}

/** Whether the horde's leader stands in the fight and every member of its group has fallen. */
export function leaderDown(foes, state) {
    if (!state.leader) return false;
    const group = foes.filter(foe => keyOf(foe) === state.leader);
    return group.length > 0 && group.every(down);
}
