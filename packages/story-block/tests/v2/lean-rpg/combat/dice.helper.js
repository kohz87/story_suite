// Test-only: a fight setup with a seed becomes one with the interaction port's dice source for that seed and segment offset (see src/v2/lean-rpg/combat/dice.js).

import { dice } from '../../../../../../core/interaction/dice.js';

/** `seeded({ seed, ...rest }, start)` is `{ ...rest, dice: dice(seed, start.offset) }`: the port source a host hands a first (offset 0) or a continued segment. */
export function seeded(setup, start = setup.start) {
    const { seed, ...rest } = setup;
    return { ...rest, dice: dice(seed, start?.offset ?? 0) };
}
