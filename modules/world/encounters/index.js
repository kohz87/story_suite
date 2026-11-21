// Story Director v2, part **encounters** (switch `story-director.encounters`, default off): who the party passes at a place.
//
// * Table (`encounterTable`): for the scene's place, "nothing worth noting" (weighted by the place's engine class: a busy place is quiet less
//   often), the pack's backdrop people who belong there (proposed `content.backdrops`: by place `at` or by place `kinds`; `when` a part of
//   the day; `weight` 1-10; `likelier_if` / `less_if` world conditions that hold here ×2 / ×0.5, read only with World events on), the
//   built-in setting-agnostic backdrops of the place group, and the met cast who are here and not in the scene. Unmet cast are never rows:
//   first meetings stay with the cast part.
// * Roll (`rollEncounter`): one seeded draw (World events' campaign seed, else a fixed one; the story day; the place and part of the day),
//   so swipes and Re-reads give the same encounter, and at most one encounter a place and part of a day ("told" skips the rest). None in
//   a fight, beside the pulse's person cue (a chance meeting or arrival) or the cast's meeting for the same reply, or with no clock or place.
// * Note: one line, "Encounter this reply: …" (PROPOSED WORDING, owner approval), on the reply's receipt as the pulse's line is (a prelude:
//   previewed for the prompt, stored with the reply), so replay applies the record and never rolls again.
// * Ledger (`director.encounters`): the last results, sightings of recurring backdrop people (a pack backdrop is one person; built-in
//   ones are anonymous) and the promotions.
// * Promotion (`promotionOf`): after the reply's lines, a recurring backdrop person in this reply's encounter whom the reply names and
//   NPC State has a dossier for (its role shares a word with who they are; exactly one fits) is bound to that dossier; later rolls use the person.
// Public face: re-exports its parts.

export { ENCOUNTERS_FEATURE, ENCOUNTER, PROMOTE, encountersOn } from './index-parts/ids.js';
export { normalizeBackdrops } from './index-parts/backdrops.js';
export { encounterTable, rowKey } from './index-parts/table.js';
export { rollEncounter, sceneKey } from './index-parts/roll.js';
export { encounterLine } from './index-parts/line.js';
export { ledgerOf, withResult, withBinding, ledgerErrors } from './index-parts/ledger.js';
export { promotionOf } from './index-parts/promote.js';
export { hereOf, overrideBackdrops } from './index-parts/reads.js';
export { encounterCommand, promoteCommand } from './index-parts/command.js';
export { encounterHook, promoteHook } from './index-parts/hooks.js';
export { part } from './index-parts/part.js';
