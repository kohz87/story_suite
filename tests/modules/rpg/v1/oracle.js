// Test-only reference for Combat Rules v1 (rule set v8.1): the formulas of the owner-checked "Try a build"
// calculator in combat-v1.html, as pure functions, plus the roll resolution the simulator uses. Nothing in
// the product imports this; the C1-C4 engine tests compare the real engine against it. Stat keys are
// lower case (str vit agi dex int wis); every division floors.

const f = Math.floor;

/** tier -> [HP and damage multiplier, roll bonus]; one roll table for every foe roll. */
export const TIERS = {
    mob: [0.25, -2], minion: [0.5, -1], standard: [1, 0], elite: [1.5, 1], boss: [2, 2], apex: [3, 4],
};

/**
 * The simulator's ASSUMED mastery at each sim level, [min level, mastery] (sim.py RANKS: it assumes practice keeps pace
 * with level). This is NOT the game's rank rule; it only lets the oracle replay the traces. The real ladder is RANK_LADDER.
 */
export const SIM_MASTERY_BY_LEVEL = [[99, 7], [75, 6], [50, 5], [30, 4], [15, 3], [1, 1]];

/** The game's rank ladder (combat-v1.html section 05): [rank, mastery, practice to reach, minimum level]; both gates apply. */
export const RANK_LADDER = [
    ['Novice', 1, 0, 1], ['Apprentice', 2, 100, 1], ['Adept', 3, 200, 10], ['Expert', 4, 300, 25],
    ['Master', 5, 400, 45], ['Grandmaster', 6, 500, 65], ['Legend', 7, 600, 85],
];

export const simMasteryAt = lv => SIM_MASTERY_BY_LEVEL.find(([min]) => lv >= min)[1];
/** Half of a mastery rounded up: what mastery adds to a roll. */
export const rollMastery = m => Math.ceil(m / 2);

export const barsOf = (s, lv) => ({
    hp: 5 + f(lv / 3) + f(s.vit / 2),
    mp: 8 + f(lv / 4) + f((s.int + s.wis) / 4),
    sp: 8 + f(lv / 4) + f((s.str + s.agi) / 4),
});

/** The player's roll bonuses; `stance` is the one stance that is on ('evasion', 'movement', ...), if any. */
export function bonusesOf(s, lv, mastery, stance = null) {
    const l = f(lv / 4);
    const half = rollMastery(mastery);
    return {
        physical: f(s.dex / 2) + l,
        magic: f(s.wis / 2) + l,
        evasion: f(s.agi / 3) + l + (stance === 'evasion' ? half : 0),
        tempo: f(s.agi / 2) + l + (stance === 'movement' ? half : 0),
        order: f(s.agi / 2) + l,
        flee: f(s.agi / 2) + l,
        tempoCap: (s.agi < 15 ? 1 : s.agi < 25 ? 2 : 3) + (stance === 'movement' ? 1 : 0),
    };
}

export function foeOf(tier, lv) {
    const [mult, troll] = TIERS[tier];
    return {
        hp: f((8 + f(lv / 2)) * mult),
        dmg: f((3 + f(lv / 6)) * mult + 0.5),
        roll: 6 + f(lv / 3) + troll,
        order: f(lv / 3) + troll,
    };
}

export const soakOf = (vit, defenceMastery = 0) => Math.min(50, vit + defenceMastery * 5);
export const takeSoak = (dmg, soak) => Math.max(1, f(dmg * (100 - soak) / 100));
export const decisiveDmg = dmg => f(dmg * 3 / 2);

/** A player roll against a foe roll: a natural 1 always misses, ties go to the player, decisive = win by 8+ or natural 20. */
export function playerHit(nat, bonus, foeTotal) {
    if (nat === 1) return 'miss-nat1';
    const total = nat + bonus;
    if (total < foeTotal) return 'miss';
    return total - foeTotal >= 8 || nat === 20 ? 'decisive' : 'hit';
}

/** A foe roll against the hero's evasion total: a tie evades. */
export function foeHit(nat, foeRoll, evasionTotal) {
    const total = nat + foeRoll;
    if (total <= evasionTotal) return 'evaded';
    return total - evasionTotal >= 8 || nat === 20 ? 'decisive' : 'hit';
}

/** Damage numbers before the decisive and soak steps. */
export const damages = (s, mastery) => ({
    normalPhysical: f(s.str / 2),
    normalMagic: f(s.int / 2),
    skill: stat => f(s[stat] / 2) + mastery,
    area: stat => Math.max(1, f((f(s[stat] / 2) + mastery) * 6 / 10)),   // 60 % of single-target, at least 1 (as sim.py)
    heal: f(s.wis / 3) + mastery,
});

/** Tempo: win by 3+ against the foe's roll (tier roll once) for one more action. */
export const tempoWins = (nat, bonus, foeTotal) => nat + bonus - foeTotal >= 3;
/** Flee: a tie goes to the player. */
export const fleeWins = (nat, bonus, foeTotal) => nat + bonus >= foeTotal;
