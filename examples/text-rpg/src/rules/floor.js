// The lowest difficulty a roll's own state allows: a crowd, a drained body and live conditions each hold it up.

function finite(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

const clampIndex = value => Math.min(5, Math.max(0, Math.trunc(value)));

/**
 * The lowest difficulty index (0 = no floor) from a crowd (more than 2), a drained body on a physical roll and each live condition: with any of them the
 * floor is ordinary, one step higher for each further one (capped at near impossible).
 */
export function floorIndex(input = {}) {
    const { count, drained, physical, conditions } = input && typeof input === 'object' ? input : {};
    let steps = Math.max(0, Math.floor(finite(conditions, 0)));
    const crowd = Math.max(0, Math.floor(finite(count, 0)));
    if (crowd > 2) steps += Math.ceil(Math.log2(crowd / 2));
    if (drained && physical) steps += 1;
    return steps > 0 ? Math.min(5, steps + 1) : 0;
}

/** Raise a difficulty index to a floor; says whether the floor changed it. */
export function raiseToFloor(index, floor) {
    const current = Number.isFinite(index) ? clampIndex(index) : 2;
    const minimum = Number.isFinite(floor) ? clampIndex(floor) : 0;
    const raised = minimum > current;
    return { index: raised ? minimum : current, raised };
}
