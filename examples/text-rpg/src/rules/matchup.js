// Who should win a fight, from the foes standing and the party's shape: weights, a ratio and four words.

/** A foe's weight by threat index (far beneath … beyond). */
const FOE_WEIGHT = Object.freeze([0.1, 0.25, 1, 2, 3, 4]);
const HEALTH_FACTOR = Object.freeze([1, 0.9, 0.7, 0.5, 0.25]);
const STAMINA_FACTOR = Object.freeze([1, 1, 0.8, 0.6, 0.6]);

/** The weight of foes standing: each group's remaining × its threat's weight. `groups`: [{ left, threat }]. */
export function foesWeight(groups) {
    return (Array.isArray(groups) ? groups : []).reduce((sum, group) => sum + Math.max(0, group.left) * (FOE_WEIGHT[group.threat] ?? 1), 0);
}

/** One member's weight: 1 × the health factor (wound stage 0..4; Down and fallen count nothing) × the stamina factor (energy stage 0..4). */
export function memberWeight(woundStage, energyStage) {
    if (!(woundStage >= 0 && woundStage <= 4)) return 0;
    return HEALTH_FACTOR[woundStage] * STAMINA_FACTOR[Math.min(4, Math.max(0, energyStage))];
}

/** The band for foes against the party: favoured (ratio up to ½), even (up to 1½), outmatched (up to 4), hopeless (above). No party left is hopeless. */
export function matchupBand(foes, party) {
    if (!(party > 0)) return 'hopeless';
    const ratio = foes / party;
    if (ratio <= 0.5) return 'favoured';
    if (ratio <= 1.5) return 'even';
    return ratio <= 4 ? 'outmatched' : 'hopeless';
}
