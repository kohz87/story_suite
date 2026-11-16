// The assist part of Story Block (MODULES §A, SPEC §0.5, §4.5): two optional helpers that each make
// one extra, cheap model call, both off by default (Story Block's features `story-block.preroll` and
// `story-block.extractor`, MODULES §F100; the profile is in the settings section "Assist").
//
// * Pre-roll classifier (classifier.js), in `beforeGenerate`: the reader's new message → at most one
//   check line → a seeded preview for the prompt; `assist.precheck` (claim, capture.check) is stored
//   on the generated reply before its story lines, so its roll and attempt retract with that reply.
// * After-reply extractor, the safety net (extractor.js, safety.js), in the `afterReply` hook the host
//   calls after each captured reply: the reply and its own lines → only the lines it missed, through the
//   value wall (never coin, new items, XP, loot or heals) → the host's capture, marked as Assist's.
//
// No domain of its own: a pre-roll is a claim in `meta.claims` plus the check's own changes; the run
// log behind `assist.status` lives in memory and is never state. Model calls go through the injected
// `callModel(prompt, { maxTokens, profile, helper }) → text` (st-adapter.js by default; the runtime gives
// sdk.callModel's rules and its queue per connection, model-call.js); tests and the host can replace
// every dependency.
// Public face: re-exports its parts.

export { DEFAULTS, FEATURE_TEXT, SCHEMA, SETTING, TIMEOUT_MS, createRunLog, estimateTokens, hashText, withTimeout } from './common.js';
export {
    ANSWER_TOKENS as CLASSIFIER_ANSWER_TOKENS, CHECK_KIND, CLASSIFIER_HEAD, MESSAGE_LIMIT, PRECHECK, PROMPT_BUDGET, ROLLED_LINE,
    checkLine, claimKey, classifierPrompt, createClassifier, normalizeDc, parseClassifierAnswer, precheck,
} from './classifier.js';
export { EXTRACTOR_FOOT, EXTRACTOR_HEAD, MAX_LINES, WORLD_FOOT, footFor, REPLY_HEAD, REPLY_LIMIT, WHERE_HEAD, WRITTEN_HEAD, allowedGrammar, createExtractor, extractorPrompt, grammarKind, notWritten, parseExtractorAnswer } from './extractor.js';
export { DEFAULT_KINDS, KIND_CHOICES, allowedKinds, refusedWhy, safeLines } from './safety.js';
export { MAX_NEAR, hasClockTime, knownPlace, mapPlaces, whereLines, whereNow, whereWhy } from './where.js';
export { renderAssistSection, runLine } from './section.js';
export { answerText, findProfile, stCallModel, stChat, stChatId } from './st-adapter.js';
export { HOST_MODULE_ID, STATUS_QUERY, sdkHasKind } from './index-parts/host.js';
export { createAssistPart, part } from './index-parts/create.js';
