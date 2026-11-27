// Words for health and energy pools, plus how many uses a pool can pay for.

/** Health stages, from full health to Down. */
export const HEALTH_STAGES = Object.freeze(['Unhurt', 'Scratched', 'Hurt', 'Wounded', 'Badly wounded', 'Down']);

/** Energy stages, from full energy to Empty. */
export const ENERGY_STAGES = Object.freeze(['Fresh', 'Steady', 'Low', 'Drained', 'Empty']);

const healthStage = index => ({ index, word: HEALTH_STAGES[index] });
const energyStage = index => ({ index, word: ENERGY_STAGES[index] });
const finiteOrZero = value => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

/**
 * The stage for a pool value and maximum. `kind` is 'health' or 'energy'; any
 * other kind is treated as health. A missing or unusable maximum is empty.
 */
export function stageOf(value, max, kind) {
    const energy = kind === 'energy';
    const limit = finiteOrZero(max);
    const points = finiteOrZero(value);

    if (limit <= 0) return energy ? energyStage(4) : healthStage(5);
    if (points <= 0) return energy ? energyStage(4) : healthStage(5);
    if (!energy && points >= limit) return healthStage(0);

    const fraction = points / limit;
    if (energy) {
        if (fraction >= 0.8) return energyStage(0);
        if (fraction >= 0.55) return energyStage(1);
        if (fraction >= 0.3) return energyStage(2);
        return energyStage(3);
    }
    if (fraction >= 0.8) return healthStage(1);
    if (fraction >= 0.55) return healthStage(2);
    if (fraction >= 0.3) return healthStage(3);
    return healthStage(4);
}

/** How many uses a pool value pays for at a cost, rounded down; bad input or no cost gives 0. */
export function usesLeft(value, cost) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
    if (typeof cost !== 'number' || !Number.isFinite(cost) || cost <= 0) return 0;
    return Math.max(0, Math.floor(value / cost));
}
