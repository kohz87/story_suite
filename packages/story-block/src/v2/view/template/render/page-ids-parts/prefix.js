// Story Suite v2: the id prefix for the screen a template scope belongs to.

import { templateIdPrefix } from '../../../css.js';

/** The id prefix for the screen a scope belongs to (`ss-t-` alone when no screen is named). */
export const idPrefixOf = screenId => (typeof screenId === 'string' && screenId ? templateIdPrefix(screenId) : 'ss-t-');
