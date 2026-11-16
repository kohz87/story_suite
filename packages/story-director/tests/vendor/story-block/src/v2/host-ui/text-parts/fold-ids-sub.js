// The Events fold id, the sub-fold key separator, the key of a module's Features sub-fold, and the shared strings table.

import { STRINGS } from '../../strings.js';
import { FEATURES_FOLD } from './fold-ids-main.js';

export const S = STRINGS;

// Story Block's Events (the events part's debug panel), a sub-fold of Diagnostics (its `place`).
export const EVENTS_FOLD = 'story-block/events';
// A sub-fold's key: its module's id, this, and the part ("example-module::features", "story-director::group:Calendar").
export const SUB_FOLD = '::';
// A module's sub-fold in the Features fold ("story-suite-features::example-module"); its fold's line opens it.
export const featuresFoldOf = moduleId => `${FEATURES_FOLD}${SUB_FOLD}${moduleId}`;
