// The pre-roll classifier (SPEC §4.5 "Optional classifier", MODULES §F16): when it is on and the
// reader's new message tries something whose outcome is uncertain, one cheap model call turns the
// message into a check line. The turn previews the roll for the prompt, then commits that seed
// on the generated reply before its story lines. No change is stored on the previous reply.
//
// The model only proposes `? check <skill> — <what> | dc: …` or `none`; code reads the line with
// Story Block's capture parser and commits one `system` command, `assist.precheck`, whose single
// transaction:
//   1. claims `assist:precheck:<key>` (the key is the reader's message: its index and a hash of its
//      text), so the same message is never checked twice on this line of history; swiping or
//      deleting the carrier the claim is on takes it back, like any other change;
//   2. runs `capture.check` with the line, exactly as if the reply had written it: the module that
//      keeps the `check` kind (Story Director, contract P09) makes the check with its one
//      `checks.roll`, one die, the policy's modifiers, the outcome from the die and never from the
//      line. There is no second step and no probe for an older `check.roll` command;
//   3. returns the roll's summary as this receipt's summary (narrate: true), so the next reply is
//      told the result under [Happened].
// Anything that fails rejects the whole transaction: no claim, no check, nothing saved. A `check`
// kind that is not there fails the capture call, so the claim is not kept either.
// Public face: re-exports its parts.

export { PRECHECK, CHECK_KIND, claimKey } from './classifier-parts/names.js';
export { PROMPT_BUDGET, MESSAGE_LIMIT, CLASSIFIER_HEAD, classifierPrompt } from './classifier-parts/prompt.js';
export { normalizeDc, checkLine } from './classifier-parts/check-line.js';
export { parseClassifierAnswer } from './classifier-parts/answer.js';
export { claimed, precheck } from './classifier-parts/precheck.js';
export { ANSWER_TOKENS, ROLLED_LINE, createClassifier } from './classifier-parts/create.js';
