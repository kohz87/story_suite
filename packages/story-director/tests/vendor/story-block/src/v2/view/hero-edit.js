// The Game view hero's one editor (view/widgets/hero.js): the fields it shows and the commands its Save runs, as plain data, so both are
// tested without a page. `heroEditFields(p)` are the fields of `ss.editable` kind `fields` (two groups, "Story" and "Character"); `heroEditPlan(p)`
// is its `plan(changed, all)`: which commands a Save sends, in which order, for the fields that changed only.
//
// Order: the story clock first (`director.clock`, Story Director; one command for the whole date and time), then `scene.place`, `scene.weather`,
// `scene.present`, `scene.you`. A refusal stops the rest (the widget shows its sentence under the fields and keeps the form open). The clock fields
// exist only where Story Director answers its time with `parts` and a calendar with months (`p.clock`, game-header.js); without them the Story group keeps
// place, weather and Here. The Character group exists only while `p.you` is given (`story-block.you` on).
// Public face: re-exports its parts.

export { CLOCK_KEYS } from './hero-edit-parts/shared-limits.js';
export { timeMinutes, timeText, hereNames, hereText } from './hero-edit-parts/time-here.js';
export { hasClock } from './hero-edit-parts/clock.js';
export { heroEditFields } from './hero-edit-parts/fields.js';
export { heroEditPlan } from './hero-edit-parts/plan.js';
