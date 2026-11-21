// The encounters' feature id, command names and the switch reader.

export const ENCOUNTERS_FEATURE = 'story-director.encounters';
export const ENCOUNTER = 'director.encounter';
export const PROMOTE = 'director.encounter.promote';

/** Whether the reader has the switch on: only an explicit true (`source.feature(id)`: a ctx, a view or query tools); a host that cannot be asked has it off. */
export function encountersOn(source) {
    if (typeof source?.feature !== 'function') return false;
    try { return source.feature(ENCOUNTERS_FEATURE) === true; } catch { return false; }
}
