// The feature `story-director.world-events` (default off): the world conditions and what is built on them. Pure.

export const WORLD_EVENTS_FEATURE = 'story-director.world-events';

/** Whether the reader has it on: `source.feature(id)` (a ctx, a view, query tools or an api); a host that cannot be asked has it off. */
export function worldEventsOn(source) {
    if (typeof source?.feature !== 'function') return false;
    try {
        return source.feature(WORLD_EVENTS_FEATURE) === true;
    } catch {
        return false;
    }
}

/** The feature's definition for the chronicle's list. */
export const worldEventsFeature = Object.freeze({
    id: WORLD_EVENTS_FEATURE,
    label: 'World events',
    describe: 'The world keeps named conditions (grain-dear, roads-closed) that fade with time and that events read and write. The pack declares which ones exist.',
    default: false,
});
