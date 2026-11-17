// The names the Chat extras page shares between its view-model and its commands: the module, its switches and its two settings.

import { CORE_FEATURE } from '../../core/features.js';

/** The Story Block module whose settings and switches the page reads and writes (the old view's Inner chatter group lives there). */
export const EXTRAS_MODULE = 'story-block';
/** The module's switches: the page's short key → the feature id the old view's Features page switches. */
export const EXTRAS_FEATURES = Object.freeze({ choices: CORE_FEATURE.choices, chatter: CORE_FEATURE.chatter, you: CORE_FEATURE.you });
/** The page's two rows: the row key → the Story Block setting the old view's Inner chatter group stores. */
export const EXTRAS_SETTINGS = Object.freeze({ 'extras.sendBack': 'chatterInPrompt', 'extras.chatterLines': 'chatterMax' });
