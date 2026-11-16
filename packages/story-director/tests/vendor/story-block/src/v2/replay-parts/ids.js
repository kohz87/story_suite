// Works out canonical block ids and derived ids from stored keys.

import { sha256 } from './sha256.js';
import { hashJson } from './canonical.js';
import { idFromHash } from './id-forms.js';

/**
 * The id of a guarded block: the hash of the reply's canonical pair, the block's operation (`key`: the command and the line or payload it
 * was made with) and its `rank` among the blocks of that reply made with the same operation. Nothing else goes in: no counter, no
 * receipt, no id the chat or the process happened to hold, so the same block gets the same id whenever and wherever it is worked out
 * (live, planned again by a Re-read, after a reload).
 */
export const blockIdOf = ({ sid, swipeKey, key, rank }) => idFromHash('bl', hashJson({ sid, swipeKey, key, rank }));

/**
 * A canonical id worked out from `seed` (the same seed always gives the same id), skipping any in `taken`
 * (a Set of ids that other records hold): the first free salt wins and is then persisted by the caller.
 */
export function deriveId(prefix, seed, taken = null) {
    for (let salt = 0; salt < 1000; salt++) {
        const id = idFromHash(prefix, sha256(`${prefix}:${seed}:${salt}`));
        if (!taken?.has(id)) return id;
    }
    throw new Error(`No free ${prefix} id could be worked out for ${seed}.`);
}
