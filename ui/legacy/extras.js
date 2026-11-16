// Choices and Inner chatter (MODULES §F115): two things a reply may carry for the reader alone, as
// change lines in its <Changes> block, that change no story state.
//
// * `? choice Climb the wall`: one of 2–4 short next moves for the reader's character. The latest
//   reply shows them as buttons; a click only puts the text into SillyTavern's message box (the
//   reader still sends it, edits it or ignores it). Code never acts on a choice (MODULES §F95, §F96).
// * `~ chatter Minke: …he'd better not die down there`: an NPC's unspoken thought (up to the reader's
//   "Most chatter lines per reply" setting, 3 unless set). Shown in a folded "Inner chatter" strip under the reply, never in the story text, and
//   never sent back to the model unless the reader's setting says so (then only the last reply's,
//   as one optional tail line).
//
// Both are **display kinds** (SPEC §4.4, §6): no command runs for them and nothing is stored. Their
// lines stay in the reply's hidden comment, and what is shown is read from there (the shown swipe's
// text) every time it is drawn, so the live reply, a Re-read, a swipe, a delete and a reload show the
// same thing. Each is a feature (Story Block's `story-block.choices` and `story-block.chatter`, off by
// default): off, its grammar line leaves the static prompt and a line of it gets a quiet Problem.
//
// The cap per reply and the cuts are code's: the first lines in reply order are kept, the rest get a
// Problem; a text is cut by code points (never inside a character), flattened to one line, and drawn
// as text only (ui-host's extras, textContent). Pure: no DOM, no SillyTavern.
// Public face: re-exports its parts.

export { CHOICES_FEATURE, CHATTER_FEATURE, chatterGrammar, EXTRA_KINDS } from './extras-parts/kinds.js';
export { CHOICE_MAX, CHOICE_CHARS, CHOICE_KEEP, CHATTER_MAX } from './extras-parts/limits.js';
export { CHATTER_LIMIT, chatterCap, CHATTER_CHARS, NAME_CHARS } from './extras-parts/chatter-limits.js';
export { flatten, cutPoints } from './extras-parts/text.js';
export { readChoice, readChatter } from './extras-parts/readers.js';
export { readDisplayLine, displayLines } from './extras-parts/display.js';
export { answeredReply, headChatter, sceneChatter, chatterTail } from './extras-parts/chatter.js';
