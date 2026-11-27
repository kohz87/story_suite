// Rest over days, injury lengths, gear bonus caps and effective stats.

function finite(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stageAt(hp, max) {
    if (hp <= 0) return 5;
    if (hp >= max) return 0;
    if (hp * 5 >= 4 * max) return 1;
    if (hp * 20 >= 11 * max) return 2;
    if (hp * 10 >= 3 * max) return 3;
    return 4;
}

function topOfStage(stage, max) {
    const tops = [
        max,
        max - 1,
        Math.ceil((4 * max) / 5) - 1,
        Math.ceil((11 * max) / 20) - 1,
        Math.ceil((3 * max) / 10) - 1,
    ];
    return Math.min(max, Math.max(1, tops[stage]));
}

const RARITY_CAPS = Object.freeze({
    common: 1,
    uncommon: 2,
    rare: 3,
    epic: 4,
    legendary: 5,
});

/** The days a minor, serious or grave injury needs to heal. */
export const INJURY_DAYS = Object.freeze({ minor: 3, serious: 10, grave: 30 });

/** Health after whole days of rest: one stage per full day, at the top of the stage reached. */
export function healDays(hp, max, days) {
    const pool = Math.trunc(finite(max, 0));
    if (pool <= 0) return 0;

    if (typeof hp !== 'number' || !Number.isFinite(hp) || hp < 0) return 0;
    const current = hp;
    const fullDays = Math.floor(finite(days, 0));
    if (fullDays <= 0) return Math.min(pool, Math.max(0, current));

    const health = Math.max(0, Math.trunc(current));
    const reached = Math.max(0, stageAt(health, pool) - fullDays);
    return topOfStage(reached, pool);
}

/** Add positive gear bonuses per stat, capped by the best rarity among the pieces giving that stat. */
export function gearCap(pieces) {
    if (!Array.isArray(pieces)) return {};

    const totals = {};
    const caps = {};
    for (const piece of pieces) {
        if (!piece || typeof piece !== 'object' || !piece.bonus || typeof piece.bonus !== 'object') continue;
        const rarity = typeof piece.rarity === 'string' ? piece.rarity.trim().toLowerCase() : 'common';
        const cap = RARITY_CAPS[rarity] ?? RARITY_CAPS.common;

        for (const [name, value] of Object.entries(piece.bonus)) {
            const stat = name.trim().toUpperCase();
            if (!stat || ['__PROTO__', 'CONSTRUCTOR', 'PROTOTYPE'].includes(stat)) continue;
            if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) continue;
            if (!Object.hasOwn(totals, stat)) {
                totals[stat] = 0;
                caps[stat] = cap;
            } else if (cap > caps[stat]) {
                caps[stat] = cap;
            }
            totals[stat] += value;
        }
    }

    const capped = {};
    for (const [stat, total] of Object.entries(totals)) capped[stat] = Math.min(total, caps[stat]);
    return capped;
}

/** A base stat with a gear bonus, kept within the 1..30 range. */
export function effectiveStat(base, bonus) {
    const total = finite(base, 0) + finite(bonus, 0);
    return Math.min(30, Math.max(1, total));
}
