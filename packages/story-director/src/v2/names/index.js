// Story Director v2, part **names**: the names' core (pure: the name key and the titles a name is compared by, the banned and
// overused names, the collision check, the deterministic suggestion pick from a pack's `names` lists, the one-line profile of
// a minor person) and the part built on it (feature `story-director.names`, on by default like the pulse; domain `names`).
//
// * Kind `person`: `+ person Name | look: … | flaw: … | voice: … | temper: …`, written once when a named person first appears. The
//   name is checked against the names in use (`people`: declared before; `seen`: the scene, the whole cast incl. unmet people,
//   NPC State Delta's dossiers and the key people, stored by the step before each reply, so apply reads only its own domain)
//   and the banned lists (the setting's, the pack's, the built-in overused names). A refusal is a Problem on the reply card and a
//   cue pinned to the next reply to rename the person ("already used": never who by). A fine name is stored whole with its profile.
// * Tail (optional lines): the profile of up to 4 stored people who are in the scene or named in the last reply (≤160 characters
//   each), and 2-3 unused suggestions from the pack's names (query `packs.content { kind: 'names' }`; none without it).
// * Query `names.profile { name }` gives a stored profile (NPC State Delta seeds a dossier from it). Settings: banned names,
//   how many suggestions (3). Stored people: the newest 80. Nothing from prose; replay-safe (everything added whole under its key).
// tests/v2/integration/module.test.js and host.test.js hold the tests; tests/v2/break/fuzz-delete.test.js sends `person` lines.
// Public face: re-exports its parts.

export { DEFAULT_SUGGESTIONS, MAX_SUGGESTIONS, MAX_BANNED, MAX_NAME } from './index-parts/limits.js';
export { PROFILE_FIELDS, MAX_FIELD, MAX_PROFILE, MAX_MINOR } from './index-parts/profile-limits.js';
export { OVERUSED } from './index-parts/overused.js';
export { cutPoints, cleanName } from './index-parts/text.js';
export { nameKey, bareKey, givenKey, sameName } from './index-parts/keys.js';
export { clampCount, parseBanned } from './index-parts/clamp-banned.js';
export { checkName } from './index-parts/check.js';
export { pickSuggestions } from './index-parts/suggest.js';
export { parseProfile, profileText, capMinor } from './index-parts/profile.js';
export { FEATURE, namesOn, packNames } from './index-parts/feature.js';
export { initialNames, validateNames } from './index-parts/validate.js';
export { applyPerson } from './index-parts/apply.js';
export { beforeGenerate } from './index-parts/before-generate.js';
export { tail } from './index-parts/tail.js';
export { part } from './index-parts/part.js';
