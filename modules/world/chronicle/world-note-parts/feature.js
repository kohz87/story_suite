// The feature's id, its token budget and whether the reader has it on.

export const WORLD_EVENTS_FEATURE = 'story-director.world-events';
/** About 160 tokens (characters / 4, as Story Block counts). */
export const WORLD_NOTE_BUDGET = 160;

/** Whether the reader has the feature on: off unless the host says so (a host without features gets nothing). */
export function worldEventsOn(source) {
    if (typeof source?.feature !== 'function') return false;
    try {
        return source.feature(WORLD_EVENTS_FEATURE) === true;
    } catch {
        return false;
    }
}
