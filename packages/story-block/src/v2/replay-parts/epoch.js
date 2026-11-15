// The epoch a state is in, and the genesis epoch of a never-restored timeline.

import { isObject } from './shared-object.js';

/** The epoch of a timeline that has never been restored (the savepoints domain starts in it). */
export const GENESIS_EPOCH = 'ep_00000000';
/**
 * The epoch `state` is in: the savepoints domain's, when that domain exists (it is made by the first save point), else the genesis epoch.
 * A pure function of the state, so of the prefix it was built from (ctx.epoch).
 */
export function epochOf(state) {
    const domain = state?.domains?.savepoints;
    return isObject(domain) && typeof domain.epoch === 'string' && domain.epoch ? domain.epoch : GENESIS_EPOCH;
}
