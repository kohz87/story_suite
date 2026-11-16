// The feature's id, whether the reader has it on, and the tag its kinds carry.

export const THREADS_FEATURE = 'story-director.threads';

/**
 * Whether the reader has the feature on: `source.feature(id)` (a ctx, a view, query tools or an api) when the host has
 * it, else on. Anything that cannot be asked is on, so a host without features behaves as it always did.
 */
export function threadsOn(source) {
    if (typeof source?.feature !== 'function') return true;
    try {
        return source.feature(THREADS_FEATURE) !== false;
    } catch {
        return true;
    }
}

/** The `feature` tag the owned kinds carry: `{ feature }` on a kind's spec. */
export const THREADS_TAG = Object.freeze({ feature: THREADS_FEATURE });
