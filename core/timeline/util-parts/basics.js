// The host's own module id, the plain-object test and the id maker the timeline shares.

import { newId } from '../../commands.js';

/** The host's own module id (its blocks are stamped with it). */
export const HOST = 'story-block';

export const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);

/** A fresh `<prefix>_<8 base36>` id from the host's crypto source. */
export const makeId = prefix => newId(prefix);
