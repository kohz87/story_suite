// The living cast (1 Nov, the user's decision): a pack lists a hand-written cast, Story Director owns who has been met and
// where everyone is, and Delta READS `director.cast` (and Story Block's `packs.portrait`) and never writes to either.
// At the first meeting Delta makes the person's dossier at once from the pack entry: no scan, no model call. This file
// holds every rule (pure: no DOM, no host, no clock); index.js and src/storysuite-v2.js call it, src/npc-meters.js
// records the meeting in the saved `npc` slice.
//
// The query: `director.cast` → [{ key ("pack:id"), pack, id, name, aliases, met: { on, where } | null, where?, doing?,
// lastHeard? (words, or { text, on }), alive, entry? }]. `entry` (the full pack entry) comes ONLY for met people: an unmet
// person is never more than a count to anyone but Story Director. `met.on`, `lastHeard.on` are story minutes (null when
// unknown); `dateText` (minutes → "Gw 12") writes them on Story Director's calendar, words are kept as given.
//
// The pack entry: { id, name, aliases?, about, look, wears?, voice?, personality?, history?, portrait? (file name),
// behaviour?[] ("Lever: level - effect"), mannerisms?[], withYou?, start: { place, goal, routine? }, drawnTo?[], meters?: { preset?, <meter>: n }, stages?[] ({ id, name, needs: [{ meter, at }], milestone }), fields?{}, secrets?[]
// ({ title, text, meter + at | when }), canDieUnmet? }.
//
//   about → role, look → overallAppearance (the body: what lasts), wears → appearance (what they usually wear and carry: the current
//   look; an older pack without `wears` mixed body and outfit in `look`: it still goes to overallAppearance, whole, and the current
//   appearance stays empty for the scanner to fill from the story, so a later scan never merges its own physical text into outfit
//   words or the other way round), voice → speech, personality, history → background, behaviour → behaviorProfile (levers in Delta's
//   own form, up to 6; a lever Delta's rules would drop or merge is skipped), mannerisms → mannerisms (up to 4), withYou → the
//   relationship summary (read up to 400, then compacted to 320 and calibrated like any summary: the pack's words are not kept whole), start.place → home base,
//   start.goal → goal, the place they were met → location, fields → custom fields, meters (built-in four → the dossier's
//   relationship numbers; any meter's value is also the first value in the saved slice, see src/npc-meters.js
//   observeCast), meters.preset → the dossier's meter track, stages → the person's own stage ladder (castFrom.stages),
//   secrets → the hidden notes (castSecrets, the one place that shapes them), portrait → the dossier's portrait.
//
// A dossier made while the pack's picture was missing (a pack imported without its pictures) is given the picture later, once Story
// Block answers `packs.portrait` for the entry's `portrait` (index.js castSync): only a cast dossier whose portrait is empty and was
// not removed on purpose (`castFrom.portraitRemoved`), never a picture the reader set or generated. castPortraitWanted says which.
//
// A dossier made here carries `castFrom` (where it came from: the key, the pack and its name and version, when and where
// they were met, the starting goal and routine as the pack gave them). Delta's later scans treat the dossier as any other:
// they add and change as they do for anyone, and every change is marked in the dossier as today.
//
// Public face: re-exports its parts.
export { CAST_KEY, CAST_MAX, KEY_MAX, NAME_MAX } from './cast-dossier-parts/limits-cast.js';
export { ALIASES_MAX, DATE_MAX, TEXT_MAX, WITH_YOU_MAX } from './cast-dossier-parts/limits-text.js';
export { FIELDS_MAX, FIELD_NAME_MAX, FIELD_VALUE_MAX, STAGES_MAX } from './cast-dossier-parts/limits-fields.js';
export { BEHAVIOUR_MAX, MANNERISMS_MAX, SECRETS_MAX } from './cast-dossier-parts/limits-lists.js';
export { labelKey } from './cast-dossier-parts/shared-text.js';
export { castBehaviour, castMannerisms, castSecrets, castTastes } from './cast-dossier-parts/entry-lists.js';
export { normalizeEntry } from './cast-dossier-parts/entry-normalize.js';
export { findCastPerson, metWithEntry, normalizeCast } from './cast-dossier-parts/cast-answer.js';
export { dossierFor, shortPackName } from './cast-dossier-parts/dossier-lookup.js';
export { parsePeople } from './cast-dossier-parts/people-field.js';
export { applyCastEntry } from './cast-dossier-parts/apply-entry.js';
export { applyCastPortrait, castPortraitWanted, markCastPortraitRemoved } from './cast-dossier-parts/portrait.js';
export { castBadge, castView } from './cast-dossier-parts/view.js';
