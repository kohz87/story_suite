// Story Director v2, part **arc**: the reader's commands for arcs (SPEC §3; cause `ui`, from the arc
// panel). Planning itself (the model call) is never a command: commands are pure. The panel asks the
// planner, shows the plan, and only the reader's Accept sends it here, as text; code reads it again
// (plan.js readPlan), so what is kept is what code read and capped, edited or not (WAVE rule 1).
//
// * `director.arc.accept { plan, reason?, note? }`: the new arc, and a thread for every item the Director
//   does not track yet, made by the tracker's own rules (tracker/capture.js applyThreadLine, as a `+` line
//   tagged `arc: <id>`), so they are the Director's beats, agendas, hooks, clocks and secrets like any
//   other. → data `{ arc, added: [thread id], pending: [item line] }`: `pending` are the items that name a
//   thread already tracked, which the panel sends one by one as `director.arc.update`, so a later delete of
//   the reply that made such a thread takes only that change away, never the whole plan (SPEC §2.2 blocks).
// * `director.arc.update { arc, line }`: one plan item onto a tracked thread (`~`, or `+` to open a closed
//   one again), for the current arc only, once per arc and thread (claim).
// * `director.arc.end { reason? }`: the current arc is over (End arc, or every beat played out). Its beats
//   stay open threads; the next plan supersedes it.
// The plan's lines are their own reply for the tracker's per-reply rules (one plan adds at most 16
// threads) and do not count as a reply: the tracker's reply count is put back as it was.
//
// Public face: re-exports its parts.

export { ACCEPT, UPDATE, END, commands } from './commands-parts/registry.js';
export { acceptArc } from './commands-parts/accept.js';
export { updateArc, endArc } from './commands-parts/update-end.js';
