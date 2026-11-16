// Story Director v2, tracker part: the `director` domain's shape, validator and queries (pure).
//
// director = {
//   time:    { minutes: null | int },             // story clock on the reader's calendar (a counter: moves keep `was`)
//   threads: { [id]: thread },                    // MODULES §C1
//   keys:    { [lineKey(key) or alias]: id },
//   steps:   { ["<reply sid>.<n>"]: { thread, text, turn, place } }, // the steps threads have been through, newest 400 kept (capture-parts/step-trail.js)
//   problems:{ ["<rev>.<n>"]: { rev, turn, kind, text, … } }, // the newest 100 kept, 50 shown
//   (a quest thread may also carry `ready: { rev }`, F83, an older chat's offer `shown: { turn }`, F88, and a
//   legacy reward owed `owed: { text, rev, units?, credit?, total?, paid?: { [rev]: amount } }`, read-only history)
//   turn:    { n, now: null | [{ reply, index, from, quests, lone, added, vouched, words?, paid, pending?, refused?, intent?, met? }] },
//   checked: null | [{ minutes, rev, lapsed, overdue, pay, due }],   // the time part's last settle
//   recap:   null | [{ fromMinutes, toMinutes, lines, threads, rev, at }], // its While away recap
//   initiative: null | [{ at, round, key, name, recent: [{ key, round }] }], // NPC initiative's last pick (initiative.js)
//   pulse: null | [{ results: [{ at, clock, kind, d20?, table?, who?, place?, text, effect?, skipped? }] }], // the World pulse (pulse/effects.js)
//   pulseQuiet: null | [{ on: bool }],                // the reader's quiet-scene flag
// }
// `turn` is this part's own: v1's rules count replies (`n`; a record changed in the last three
// replies is relevant; a `- hook` beside the `+ quest` of the same reply is not an ending), and
// capture hands lines over one at a time, so what the reply being read has done so far is kept in
// `now`: the reply, the line last read, the clock when it began, its new quests, its one lone quest,
// how many threads it added, and the one quest it turned in on the story's word alone (`vouched`, a
// thread id, which the quests part marks; B-b3-r2-5) and what its quest turn-ins paid of rewards the
// story wrote (`paid`, the quests part's per-reply tally; RX-E-1), and the quests the story turned in
// that wait for where the reply ends up (`pending`, thread ids; quest-lines.js), only once there is one,
// and the ones refused by the place alone at the end of the reply, which a Continue of the same reply
// may still pay (`refused`: [{ id, problem: the refusal's problem key, ready: whether it set `ready` }]),
// the quests turned in on the story's word when the reader allows more than one a reply (`words`, ids),
// and the quests a line of the reply spoke of as turned in without closing them (`intent`, ids), which the
// afterCapture step may turn in from where things stand (quests/index.js quest.autoTurnIns), and the quests
// the story said were met in this reply (`met`, ids: a delivery goal met at the giver is handed in there).
// Later replies never write inside what an earlier reply wrote (B-b1r2-12): `turn.now` is a slot
// (../slot.js), written whole at a path that is always there; a problem is added under its own key (the
// receipt's rev and its number in that receipt) and never changed, and the oldest past PROBLEM_ROOM are
// removed (Story Block 2.0.0-alpha.2 passes over the removal of a key a deleted reply had made). Readers
// order problems by rev and number.
//
// Public face: re-exports its parts.

export { PROBLEM_LIMIT, PROBLEM_ROOM } from './domain-parts/shared-problem-keys.js';
export { initialDirector } from './domain-parts/initial.js';
export { replyDraft, replyTurn, startReply, turnNumber } from './domain-parts/turn.js';
export { addProblem, dropProblems, problemList } from './domain-parts/problems.js';
export { validateDirector } from './domain-parts/validate.js';
export { queries } from './domain-parts/queries.js';
