// Story Director v2, part **chronicle** (F89): the `chronicle` domain (world events the story keeps
// moving, and the factions that shape them), the `world` and `faction` change lines, the
// reader's edits, the three open events the next reply is reminded of, and the Chronicle screen.
// The coordinator's src/v2/module.js merges this part with the others into module
// `story-director`.
//
// The day digest (feature `story-director.digest`, on by default; days.js, digest.js): when the story
// clock has passed into a new day, code writes what each finished day held from the receipts (no model
// call), keeps them by day in `chronicle.days`, shows them on the World screen's Journal, and tells the reply after
// a time skip or a While away recap the last day's one line.
//
// The tracker part owns the kind `event` (a dated happening, MODULES §C1), so a world event is a
// `world` line here: one owner per kind, and the tracker's `event` lines keep working as before.
//
// Interface for other parts and modules: the queries `chronicle.events`, `chronicle.event`,
// `chronicle.factions`, `chronicle.faction`, `chronicle.days`, `chronicle.day` (and
// `chronicle.board`, `chronicle.dayBoard`, the screens', and `chronicle.dayFacts`, the digest's) and
// `chronicle.passed` (whether a set time has gone by since an event began: for a pack event's `when`); the
// commands `chronicle.edit` and `chronicle.remove` (the reader's, cause `ui`), `chronicle.surface`
// and `chronicle.digest` (the hook's, cause `system`), and `chronicle.lasting` (a pack event's step: the
// world's lasting change, which the story's own `world` lines cannot move on, see capture.js).
// Public face: re-exports its parts.

export { beforeGenerate, tail } from './index-parts/hooks.js';
export { capabilities, features, part } from './index-parts/part.js';
