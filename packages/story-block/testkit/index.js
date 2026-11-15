// Story Block v2 testkit (docs/v2/SPEC.md §10): a fake SillyTavern context and a whole host on
// it. Modules vendor this folder with src/v2/ into tests/vendor/story-block/.
//
// Public face: re-exports its parts.

export { EVENT_TYPES, EXTENSION_PROMPT_ROLES, EXTENSION_PROMPT_TYPES, MAIN_PROMPT } from './index-parts/constants.js';
export { createEventSource, createFakeContext } from './index-parts/context.js';
export { aiMessage, sharedPrefix, userMessage } from './index-parts/messages.js';
export { applyOps, createFakeBus, createFakeStore } from './index-parts/fakes.js';
export { createHost, hostAvailable, createFakeModel, stPurify } from './index-parts/host.js';
