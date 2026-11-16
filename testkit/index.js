// The testkit (docs/v2/SPEC.md §10): a fake SillyTavern context and a whole host on it. A folder with this one entry,
// imported by relative path from tests (never by a package name, never copied into another folder).

export { EVENT_TYPES, EXTENSION_PROMPT_ROLES, EXTENSION_PROMPT_TYPES, MAIN_PROMPT, aiMessage, createEventSource, createFakeContext, sharedPrefix, userMessage } from './fake-st.js';
export { applyOps, createFakeBus, createFakeStore } from './fakes.js';
export { createHost, hostAvailable } from './host.js';
export { createFakeModel } from './model.js';
export { stPurify } from './purify.js';
