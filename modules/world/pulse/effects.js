// Story Director v2, part **pulse** (feature `story-director.pulse`): the World pulse. Before each reply, code rolls a d20 from the
// step's seed (`director.pulse { at }`, a system step from beforeGenerate: the same bytes of state + seed give the same roll; a swipe
// is a new step with a new seed, so it rolls again), picks an entry from tables.js, applies its effect and records the result in the
// slot `director.pulse = [{ results: [last 5] }]`. The step is a host prelude: it is previewed for the prompt and stored on the generated reply
// itself (same seed), so a swipe, a regenerate or a delete of the reply takes its roll and effects back. Its receipt's summary is the one
// "World this reply: …" cue (none on CALM or a skip; at most 40 tokens), told in the leading note, not an optional tail line.
// A reply is skipped (and the skip recorded) in a fight, after a rest or a 6+ hour jump, in a quiet scene and while the clock is unset.
// Pulse step version 2 (payload `pulse: 2`, new replies; older steps replay as written): each result has an `intensity`; never two intrusive or the same kind running;
// a flavour kind with `invent: true` shows a short `text` and carries the narrator `brief` for the note (setting `invents`), else a fixed line (flavour-more.js).
// The builders below are pure (no state, no ctx, no model call); the part (the command, hook, settings) is at the end.
//
// Each builder takes the filtered candidates and the roll's draw units (tables.js drawsFrom): `actor` picks the candidate, `line` decides the
// rest. It returns `{ kind, type, payload, tail, receipt }` (the command the hook runs, the tail text without its label, what `director.pulse`
// stores), or `null` when the entry cannot happen with these candidates; the caller then steps down the table.
//
// * skipReason: why a reply writes no roll: 'fight', 'rest', 'jump' (JUMP_MINUTES+), 'quiet', 'clock'; '' when rolled.
// * Rumour (GOSSIP_SURGE, OVERHEARD_DETAIL): one known fact becomes a `looming` chronicle event. Known facts only: a candidate
//   whose name is in `behind` (the lineKeys of hidden names, world/known.js hiddenNames) is dropped before the pick.
// * Chance meeting (CHANCE_MEETING): one unmet, living cast person is met at `place` (`cast.meet`, why 'goal').
// * Arrival (ENTER_CHECK): one off-screen agenda's `arrive` moves 1 or 2 replies' worth of story minutes ahead (REPLY_MINUTES).
// * Shift (TASK_SHIFT): one off-screen agenda's `on` moves early or late by 1 to 4 hours. Agenda dates are calendar text, so
//   the caller parses them (`abs`: story minutes) and gives `format(minutes)` back; without `format` the entry cannot happen.
// * Names: a person or agenda is named only when `named` (known to {{user}}); else the line stays general.
// * Tail lines are plain text: plainSlot (no braces, angle brackets or line breaks), cut by code points.
// Public face: re-exports its parts.

export { FEATURE, PULSE, QUIET, MODES } from './effects-parts/ids.js';
export { JUMP_MINUTES, REPLY_MINUTES, STALE_REPLIES, RUMOUR_ROOM } from './effects-parts/limits.js';
export { TAIL_CHARS, BRIEF_CHARS, cutWord, worldLine } from './effects-parts/lines.js';
export { SKIP_REASONS, skipReason } from './effects-parts/skip.js';
export { rumourEntry, meetEntry, arrivalEntry, shiftEntry } from './effects-parts/entries.js';
export { effectFor } from './effects-parts/dispatch.js';
export { agendaProgress, placeNamed } from './effects-parts/agenda.js';
export { pulseOn, pulseActive, modeOf } from './effects-parts/settings.js';
export { RESULTS_MAX, resultsOf } from './effects-parts/results.js';
export { weatherFrom } from './effects-parts/roll.js';
export { pulseCommand, quietCommand } from './effects-parts/command.js';
export { PULSE_STATIC, pulseHook, part } from './effects-parts/part.js';
