// sdk.callModel (MODULES §G, §F124): a module's own model call, on the chat's connection or on one of
// SillyTavern's Connection Manager profiles. It never posts to the chat and never touches its history,
// and it never switches the reader's connection: a profile's call goes straight to that profile's API
// with its settings (ConnectionManagerRequestService.sendRequest, SillyTavern 1.19), so there is nothing
// to switch back. The chat's connection is called with generateRaw, which sends the prompt as it is (no
// chat, card or extension prompts) and leaves the chat alone.
//
// The rules (createModelCalls): one call in flight per module (a second is refused with BUSY), a time
// limit and the caller's AbortSignal, FEATURE_OFF while the module's feature is off, and every failure as
// { ok: false, error, message }, never a throw. The log line holds the module, the profile's name, the
// time taken and the outcome code: never the prompt, the answer, an error's words or anything of the
// profile's (its address, key or model).
//
// The reader's reply always comes first on the chat's connection (generateRaw runs SillyTavern's
// prompt-ready events, which the turn reads): a call there waits while a reply is being built or awaited
// (the `gate`, turn.js whenIdle), and its prompt is marked as our own (createOwnCalls) so the turn never
// takes it for the reply's. A profile's call (sendRequest) runs none of that and goes at once.
//
// One queue per connection (createCallQueue, MODULES §G): Delta's scan, the arc planner and Assist can ask
// at the same moment, and a single-slot local server answers one at a time (or not at all). Calls on the
// same named profile run one at a time, in the order they came, each with its own time limit and signal
// (a call that runs out of time or is cancelled while it waits leaves the queue and never runs); calls on
// different profiles still run side by side. The chat's connection ('' / 'chat', generateRaw) has a lane
// of its own too, entered only after the turn's whenIdle wait, so a reply in progress never holds it.
// The host setting `callQueue` (default on) turns the queue off; Diagnostics shows its length and waits.
//
// Everything of SillyTavern is read when called, never at import.
// Public face: re-exports its parts.

export { MODEL_CALL_TIMEOUT_MS, MODEL_CALL_TIMEOUT_MIN, MODEL_CALL_TIMEOUT_MAX, MODEL_CALL_TOKENS } from './model-call-parts/limits.js';
export { MODEL_CALL_TOKENS_MAX, PROFILE_NAME_MAX, CHAT_PROFILE } from './model-call-parts/shared-consts.js';
export { MODEL_CALL_ERRORS, MODEL_CALL_TEXT } from './model-call-parts/messages.js';
export { profileName, listProfiles } from './model-call-parts/profiles.js';
export { safeReason } from './model-call-parts/errors.js';
export { stModelCall } from './model-call-parts/st-call.js';
export { promptKey, createOwnCalls } from './model-call-parts/own-calls.js';
export { createCallQueue } from './model-call-parts/queue.js';
export { createModelCalls } from './model-call-parts/calls.js';
