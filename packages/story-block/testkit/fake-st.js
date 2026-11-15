// A fake SillyTavern context for unit tests (docs/v2/SPEC.md §10): no network, no real
// SillyTavern. It keeps a chat array shaped like SillyTavern's (swipes, swipe_info[n].extra,
// extra), records saveChat and setExtensionPrompt, has an event source with SillyTavern's own
// event names, and simulates a generation the way SillyTavern runs one: the interceptor, the
// prompt built from the extension prompts (the in-prompt ones dropped when the preset has no
// Main Prompt), prompt-ready, then the reply added and MESSAGE_RECEIVED.
//
// Where SillyTavern's behaviour matters it is copied, not idealized: a new swipe keeps a copy
// of the message's extra (SillyTavern only drops `memory` and `display_text`), swiping to an
// existing swipe restores that swipe's extra, Regenerate deletes the old reply first.
//
// Public face: re-exports its parts.

export { EVENT_TYPES, EXTENSION_PROMPT_ROLES, EXTENSION_PROMPT_TYPES, MAIN_PROMPT } from './fake-st-parts/constants.js';
export { createEventSource } from './fake-st-parts/events.js';
export { aiMessage, sharedPrefix, userMessage } from './fake-st-parts/messages.js';
export { createFakeContext } from './fake-st-parts/context.js';
