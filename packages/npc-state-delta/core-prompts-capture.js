/* NPC State Delta one-pass capture rules and hidden-note prompt fragments. Split from core-prompts.js without change;
   core-prompts.js re-exports every name it exported before.
   Public face: re-exports its parts. */
export { NARRATION_CAPTURE_HEADER, NARRATION_CAPTURE_STORY, NARRATION_CAPTURE_REMINDER } from './core-prompts-capture-parts/capture-text.js';
export { compactCaptureRules } from './core-prompts-capture-parts/capture-rules.js';
export { secretEventsShown } from './core-prompts-capture-parts/secret-events.js';
export { hiddenNotePromptRules, hiddenNoteEventParagraph, appendHiddenNotePrompt } from './core-prompts-capture-parts/hidden-notes.js';
