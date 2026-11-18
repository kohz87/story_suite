// Story Director v2, part **screens**: the view queries its screens bind to (SPEC §13.1 `data`).
//
// A template has no arithmetic, sorting or per-item queries (SPEC §13.2), so what a screen needs
// worked out ahead (which quest is the current goal, which thread comes due next, how far each
// active quest is and why Finish is off) is answered here, as plain data. Each query is built
// from the Director's own queries through `tools.query` (MODULES §F3: `director.threads`,
// `quest.progress`), so the tracker and quests parts stay the only readers of their rules, and
// it reads Story Block's `scene` (SPEC §7) from the same state. Every query runs on the state it
// is given: an inline card (mount `card`) gets that reply's state, never the head.
//
// Without `tools` (a host that cannot call queries from a query) the threads are read from the
// documented `director` layout (MODULES §C1) and progress is left out.
//
// The calendar (for "what comes due next") is the chat's: the tracker's `director.calendar` query (the
// reader's, else the enabled pack's, else Gregorian); without it the tracker part's calendar setting,
// read through an injected settings function (by default Story Block's `sdk.settings('story-director')`).
// Public face: re-exports its parts.

export { FINISHED_SHOWN, currentGoal, questBoard } from './queries-parts/goal.js';
export { calendarSetting } from './queries-parts/calendar.js';
export { nextDue } from './queries-parts/next-due.js';
export { agendaSteps, planView } from './queries-parts/plan.js';
export { isBehindProblem, problemsList, readerWords } from './queries-parts/problems.js';
export { behindView, hidingBehind } from './queries-parts/behind-view.js';
export { clockText, statusExtras } from './queries-parts/status.js';
export { screenQueries } from './queries-parts/screen-queries.js';
