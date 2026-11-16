// Combat Rules v1 damage: normal, skill, area and heal amounts, the decisive multiplier, VIT + stance + gear soak and
// the damage that gets through it (at least one). Gear contributes soak only; no other gear bonus belongs here.

import { V1 } from './numbers.js';

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, Math.floor(Number(value)) || lo));
const stat = (stats, key) => clamp(
    Number.isFinite(Number(stats?.[key])) && stats[key] !== null && stats[key] !== '' ? stats[key] : V1.stat.start,
    V1.stat.min, V1.stat.max,
);
const whole = value => Math.max(0, Math.floor(Number.isFinite(Number(value)) ? Number(value) : 0));
const skillAmount = (stats, mastery, key) => Math.floor(stat(stats, key) / V1.damage.statDiv) + whole(mastery);

/**
 * One damage amount before the decisive step. `kind` is 'physical' (normal STR attack), 'magic' (normal INT attack),
 * 'skill' or 'area' (the chosen stat ÷2 + full mastery), or 'heal' (WIS÷3 + full mastery). A skill's `stat` defaults to
 * STR; a normal physical attack is STR for everyone (no weapon types), so `statKey` is ignored for it. Area damage is 60% of the skill amount, at least 1.
 */
export function damageOf(kind, stats, mastery = 0, statKey = 'str') {
    if (kind && typeof kind === 'object') ({ kind, stats, mastery = 0, stat: statKey = 'str' } = kind);
    if (kind === 'physical') return Math.floor(stat(stats, 'str') / V1.damage.statDiv);
    if (kind === 'magic') return Math.floor(stat(stats, 'int') / V1.damage.statDiv);
    if (kind === 'skill') return skillAmount(stats, mastery, statKey);
    if (kind === 'area') return Math.max(V1.damage.min, Math.floor(skillAmount(stats, mastery, statKey) * V1.areaPercent / V1.percent));
    if (kind === 'heal') return healOf(stats, mastery);
    throw new TypeError(`Unknown damage kind: ${kind}`);
}

/** Soak percentage from VIT + Defence stance mastery × 5 + gear soak, capped at 50. Gear affects fights only through this. */
export function soakOf(vit, defenceMastery = 0, gear = 0) {
    return Math.min(V1.soakCap, Math.max(0, Math.floor(Number(vit) || 0)) + whole(defenceMastery) * V1.soak.stanceStep + whole(gear));
}

/** A hit after the decisive ×1.5 step and soak; a hit always gets at least one damage through. */
export function takeHit(damage, soak = 0, decisive = false) {
    const base = whole(damage), raw = decisive ? Math.floor(base * V1.decisiveTimes) : base;
    const reduced = Math.min(V1.soakCap, Math.max(0, Math.floor(Number(soak) || 0)));
    return Math.max(V1.damage.min, Math.floor(raw * (V1.percent - reduced) / V1.percent));
}

/** Healing: WIS÷3 + full mastery. */
export function healOf(stats, mastery = 0) {
    const wis = typeof stats === 'object' && stats !== null ? stats.wis : stats;
    return Math.floor(clamp(wis, V1.stat.min, V1.stat.max) / V1.damage.healDiv) + whole(mastery);
}
