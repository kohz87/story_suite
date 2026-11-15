// The only part of assist that touches SillyTavern. Everything is read when called, never at import,
// so the rest of the part (and its tests) loads without SillyTavern.
//
// What it uses of `SillyTavern.getContext()`:
// * `generateRaw` for a model call on the current connection: the object form
//   `generateRaw({ prompt, responseLength })` (SillyTavern 1.13+), or the older positional form
//   `generateRaw(prompt, api, instructOverride, quietToLoud, systemPrompt, responseLength)`.
//   generateRaw sends the prompt as it is, with no chat, card or extension prompts, and does not run
//   the generation interceptors, so Story Block's own notes never reach it.
// * `ConnectionManagerRequestService.sendRequest(profileId, messages, maxTokens)` and
//   `extensionSettings.connectionManager.profiles` when a connection profile is named in the settings.
// * `chat` and `getCurrentChatId()` (which message the reader sent, in which chat).

// Public face: re-exports its parts.

export { stChat, stChatId } from './st-adapter-parts/chat.js';
export { answerText, findProfile, stCallModel } from './st-adapter-parts/call.js';
