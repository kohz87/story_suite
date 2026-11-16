// Story Director v2, part **cast**: the three steps that write the `cast` domain. All are cause `system` (Story Director's own hook
// asks for them before a reply): the story's change lines never write the cast, and the reader has no button for it.
//
// - `cast.sync { add?, update?, drop?, updated?, init? }`: the packs' cast joined, changed or left (apply.js).
// - `cast.advance { from, to, moves?, died? }`: the planner's batch after a day change or a time skip (a move: `{ key, where, doing, from? }`).
// - `cast.meet { at, who: [{ key, why, reason }] }`: the party meets someone for the first time (no dice).
// - `cast.rumor { at, who: [{ key, where, text }] }`: the reader sought a kind of person who is elsewhere: the narrator is told of them without the name.
// - `cast.journey { start?, stop?, land? }`: a goal pulls someone who is too far: they set out, or the link went (stop), or the trip is over (land).
// - `cast.withdraw { at, keys }`: the reply did not show a person it was told to bring in, so their meeting is taken back (after the reply).
//
// Replay: a person is added whole under its key; a change inside a person is marked `ctx.ifThere` (passed over when the reply that
// made the person was deleted); a note is a new key each time, never changed after, the oldest replies' dropped. A step's summary
// and data never name or count an unmet person beyond what the reader's card says.
// Public face: re-exports its parts.

export { sync, advance, journey } from './capture-parts/world-steps.js';
export { meet, rumor, withdraw } from './capture-parts/scene-steps.js';
