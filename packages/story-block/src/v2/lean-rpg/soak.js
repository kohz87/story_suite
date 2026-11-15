// VIT soak (the fight mark `soak: 1`): on a party member's defence, a foe's hit lands only if the foe beats the defender by more than
// 2 + S, S = min(5, floor(effective VIT / 4)). Effective VIT is what the fight rolls with (base + worn gear, gear.js applyGear). A decisive
// hit (natural 20 or 1, or the decisive margin) always lands. Pure helpers: the roll (standard/roll.js) and the Party card both read them.
// Public face: re-exports its parts.
export { SOAK_BASE, SOAK_MAX, SOAK_STEP } from './soak-parts/constants.js';
export { soakOf, soaked, soakGrowth } from './soak-parts/math.js';
