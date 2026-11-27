// What the code makes of a foe kind: its threat against the party's level, what a fallen foe pays, and the most a battle pays.

const BASE_INDEX = Object.freeze({ vermin: 1, common: 2, trained: 3, elite: 4, monster: 5, legend: 6 });
const XP_BASE = Object.freeze({ vermin: 5, common: 10, trained: 20, elite: 40, monster: 80, legend: 160 });
const XP_FACTOR = Object.freeze([0, 0.5, 1, 2, 3, 4]);
const BATTLE_CAP = Object.freeze([0, 25, 50, 75, 100, 200]);

/** The threat index (0 far beneath … 5 beyond) of a kind against the party's level: the kind's base 1..6 less the level band (1–9: 0, 10–29: 1, 30–59: 2, 60+: 3), kept within 0..5. */
export function threatFor(kind, level) {
    const base = BASE_INDEX[kind] ?? BASE_INDEX.common;
    const offset = level >= 60 ? 3 : level >= 30 ? 2 : level >= 10 ? 1 : 0;
    return Math.min(5, Math.max(0, base - offset));
}

/** What `count` fallen foes of a kind (a group from an old chat has none: common) pay at a threat, rounded once after the count. */
export const foeXp = (kind, threat, count) => Math.round((XP_BASE[kind] ?? XP_BASE.common) * (XP_FACTOR[threat] ?? 1) * count);

/** The most one battle pays, by its strongest group's threat: far beneath 0, beneath 25, fair 50, above 75, far above 100, beyond 200. */
export const battleCap = threat => BATTLE_CAP[threat] ?? BATTLE_CAP[2];
