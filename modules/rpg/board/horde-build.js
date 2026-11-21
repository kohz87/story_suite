// A horde's reserve, built by code from a few words (the pre-check's `horde` answer or the narrator's `kind: horde` line) and the front the fight opens with.
// The words are `{ waves, until, hold?, leader?, level? }`; `hordeFrom` turns them, with the front's groups, into the setup's `horde` (combat/horde.js hordeOf).
// The reserve is the front again, `waves - 1` times over, cut (never refused) at the reserve's limits; a named leader not on the front comes last, as one boss. Pure.
import { TIERS, V1 } from '../combat/numbers.js';
import { hordeOf } from '../combat/horde.js';
import { fold } from '../read.js';

const H = V1.horde, UNTIL = ['clear', 'hold', 'leader'];
const plain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const held = (value, min, max) => (Number.isFinite(Number(value)) && value !== '' && value !== null ? Math.min(max, Math.max(min, Math.round(Number(value)))) : null);

/** The horde words checked and held to their ranges (a count out of range is cut to it, never refused): `{ waves, until, hold?, leader?, level? }`, or null when they ask for no horde. */
export function wordsOf(raw) {
    if (!plain(raw)) return null;
    const waves = held(raw.waves, 1, H.waves.max) ?? 1, until = UNTIL.includes(String(raw.until ?? '').trim().toLowerCase()) ? String(raw.until).trim().toLowerCase() : 'clear';
    const leader = typeof raw.leader === 'string' && raw.leader.trim() ? raw.leader.trim().slice(0, 40) : null, level = held(raw.level, V1.level.min, V1.level.max);
    const hold = until === 'hold' ? held(raw.hold, H.hold.min, H.hold.max) ?? H.hold.default : null;
    if (waves < H.waves.min && hold === null && !leader) return null;
    return { waves, until, ...(hold === null ? {} : { hold }), ...(leader ? { leader } : {}), ...(leader && level !== null ? { level } : {}) };
}

/**
 * The setup's `horde` from checked words and the front (`[{ slot, name, count, level, tier }]`, the fight's filled slots), or null. A leader named like a front group
 * is that group (`leaderSlot`); another comes last in the reserve, a boss at the stated level, else two levels above the front's highest.
 */
export function hordeFrom(words, front) {
    if (!words || !Array.isArray(front) || !front.length) return null;
    const groups = [...front].sort((a, b) => a.slot - b.slot).map(group => ({ slot: group.slot, name: String(group.name).slice(0, 40), count: Math.min(V1.foe.groupMax, Math.max(1, Number(group.count) || 1)),
        level: Math.min(V1.level.max, Math.max(V1.level.min, Number(group.level) || 1)), tier: Object.hasOwn(TIERS, String(group.tier ?? '').toLowerCase()) ? String(group.tier).toLowerCase() : V1.foe.defaultTier }));
    const standing = groups.find(group => words.leader && fold(group.name) === fold(words.leader));
    const boss = words.leader && !standing ? { name: words.leader, count: 1, level: words.level ?? Math.min(V1.level.max, Math.max(...groups.map(group => group.level)) + H.leaderLevels), tier: 'boss', leader: true } : null;
    let foes = Math.min(H.reserveFoes, H.fightFoes - groups.reduce((sum, group) => sum + group.count, 0)) - (boss ? 1 : 0), room = H.groups - (boss ? 1 : 0);
    const reserve = [];
    copies: for (let wave = 1; wave < words.waves; wave += 1) {
        for (const { name, count, level, tier } of groups) {
            if (count > foes || room < 1) break copies;
            reserve.push({ name, count, level, tier });
            foes -= count; room -= 1;
        }
    }
    if (boss && foes >= 0) reserve.push(boss);
    return hordeOf({ v: 1, reserve, ...(words.hold ? { hold: words.hold } : {}), ...(standing ? { leaderSlot: standing.slot } : {}) });
}
