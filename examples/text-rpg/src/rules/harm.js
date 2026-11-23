// Health harm and pool sizes: the Mana and Stamina sizes (the RPG's formula), the bands that hurt, and moving health down by whole stages.

const STAGE_FLOOR = 4;
const POOL_STATS = Object.freeze({
    mp: ['int', 'wis'],
    sp: ['agi', 'dex'],
});

function finite(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function statValue(stats, key) {
    const raw = stats && typeof stats === 'object'
        ? stats[key] ?? stats[key.toUpperCase()]
        : undefined;
    return Math.min(30, Math.max(1, Math.trunc(finite(raw, 5))));
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

/** How many health stages each roll band costs when the roll is made in danger. */
export const HARM_STAGES = Object.freeze({ great: 0, success: 0, cost: 1, failure: 1, bad: 2 });

/**
 * The full size of Mana (`mp`) or Stamina (`sp`): 8 + level÷4 + (two stats)÷4, each term rounded down; anything else is 0.
 * Adapted from modules/rpg/combat/bars.js (Combat Rules v1): missing stats count as 5, each stat is kept within 1..30, the level within 1..99.
 */
export function poolMax(kind, stats, level = 1) {
    const pair = POOL_STATS[String(kind ?? '').trim().toLowerCase()];
    if (!pair) return 0;
    const lv = Math.min(99, Math.max(1, Math.trunc(finite(level, 1))));
    return 8 + Math.floor(lv / 4) + Math.floor((statValue(stats, pair[0]) + statValue(stats, pair[1])) / 4);
}

/** The stages a band drops: bad always, others only when in danger; an unknown band drops none. */
export function harmFor(band, inDanger) {
    const key = typeof band === 'string' ? band.trim().toLowerCase() : '';
    if (!Object.hasOwn(HARM_STAGES, key)) return 0;
    if (!inDanger) return key === 'bad' ? HARM_STAGES.bad : 0;
    return HARM_STAGES[key];
}

/** Move health down whole stages to the top of the reached stage, never below badly wounded in one call. */
export function dropStages(hp, max, stages) {
    const current = finite(hp, 0);
    const drop = finite(stages, 0);
    const wholeStages = Math.trunc(drop);
    if (wholeStages <= 0) return current;

    const pool = Math.trunc(finite(max, 0));
    if (pool <= 0) return 0;

    const health = Math.max(0, Math.trunc(current));
    if (health <= 0) return 0;

    const reach = Math.min(STAGE_FLOOR, stageAt(health, pool) + wholeStages);
    return Math.min(health, topOfStage(reach, pool));
}
