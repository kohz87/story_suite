// NPC meters for Story Suite v2 (Story Block 2, docs/v2/SPEC.md §2, §4, §5; coordinator decisions
// F81, F90 and TRS ideas 1-4): a small slice of each NPC in v2's per-reply state, so the meters swipe
// and delete back with the replies. Since people store P4 the slice is the store's `people` domain's
// `bonds` (src/npc-meters-parts/fold.js), beside the dossiers NPC State writes there; only numbers,
// stage names, milestone names and the ids of unlocked hidden notes live in it.
//
//   people.bonds = {
//     npcs: { [key]: { name, meters: { trust, affection, desire, tension, ...custom }, stages: { meter: name },
//                      unlocked: [noteId], held?: [noteId], disposition?, turn?: { reply, from: { meter: value } },
//                      milestones?: { [milestoneKey]: name }, rank?: rungKey, low?: n, day?: n } },
//     problems: [{ rev, text }],          // the last change lines code could not use in full (last 20)
//   }
//
// * Keys are the person's npc_ id, the key of their dossier in the same domain (`npc_mira`). A line
//   about someone Delta has no dossier for gets an id made as Delta makes dossier ids (`npc_` and the
//   name's slug), so the dossier made later has the same key; an entry is also found by its name.
//   npc.cast lists the store's people (not a confirmed death), each with its entry.
// * Meters: trust, affection, desire and tension (-100..100, starting from Delta's base values, or
//   from the dossier's own numbers for someone Delta already knows), plus up to six custom meters
//   from the reader's settings and the presets in use. Code clamps every value to its range, and the
//   change of one meter within one reply to the change cap (`turn.from` holds the values the reply
//   started from). A custom meter may carry a rule line for the story (`describe`), band words the
//   tail uses instead of its number (`bands`), and a drift toward a value per story day (`drift`).
// * Per-NPC limits (the dossier's `meterSetup`, or the preset the reader gave that NPC): growth from
//   the story or a scan stops at the meter's ceiling, a fall stops at its floor. A change away from a
//   limit always lands in full; a value the reader set beyond one is never pulled back to it.
// * Stages (F90): named thresholds per meter. A threshold at 0 or above is reached at or above it, a
//   negative one at or below it; the stage is the farthest one reached. Code moves the stage when a
//   meter crosses a threshold either way and says so in the receipt. The story cannot set a stage.
// * Stage ladder (feature npc-state-delta.stages): rungs in order, each needing several meters at once
//   and optionally a story milestone ("Confidant: trust 60, affection 40, milestone saved her
//   brother"). `rank` is the rung reached. Code promotes as soon as the next rung's needs are met,
//   never while a conflict is on (tension above `conflictAt`); it demotes one rung only after the
//   rung's needs have failed `demoteAfter` replies in a row (`low` counts them, on Delta's per-reply
//   tick). Milestones are keyed by their words: `+ milestone Mira — saved her brother` (once) or the
//   reader in the dossier editor. Setting one writes nothing to the prompt by itself.
// * Hidden notes ("secrets"): kept in Delta's dossier with an unlock rule { meter, at } and an
//   optional title. When the meter reaches `at` (same rule as a threshold), code adds the note's id to
//   `unlocked` (it stays unlocked on that line of history) and says so; the text itself never enters
//   this state and is given to the story only through the tail, only while the NPC is present and
//   unlocked. While locked, screens show only that a note is hidden and its rule ("Opens at Trust 60",
//   "Opens with the story"), never its title, text or event wording.
// * A note opens by a meter rule { meter, at }, by a story event (`when`, up to 120 characters; the scan
//   of a reply that shows it sends `npc.open`, recorded on that reply), or by the reader's hand (also
//   `npc.open`; a note the reader shut is kept in `held` so a meter does not open it again).
// * Every note of a present NPC reaches the story through the tail: an opened one as known to the
//   player, a locked one worded "hidden: never state or reveal" (the nearest to opening first when the
//   budget cannot hold them all). `redact` (below) is the screen view of the same text, with locked
//   notes shown as "1 hidden note".
//
// * The living cast (src/cast-dossier.js): `cast` = { [castKey ("pack:id")]: { name, rungs? } } records the people whose
//   dossier Delta made from the pack at the first meeting (Story Director's `director.cast`, read only). npc.tick writes it
//   at the reply the meeting is first seen (observeCast), so it follows swipes and deletes with the replies; the first meter
//   values the pack gave are the entry's first values. Read through the query `npc.castMade`.
//
// Pure: no DOM, no SillyTavern, no clock, no randomness. What Delta knows (dossier names, base
// values, note rules and texts, per-NPC setup, presets, who is present) comes in through the hooks
// given to createNpcPart.
//
// Public face: re-exports its parts.
export { NPC_DOMAIN, NPC_KIND, MILESTONE_KIND, BUILT_IN_METERS, BUILT_IN_RANGE, CUSTOM_RANGE, MAX_CUSTOM_METERS, MAX_NPCS, MAX_METERS_PER_NPC, MAX_STAGES_PER_METER, MAX_SECRETS, MAX_GENERATED_SECRETS, MAX_UNLOCKED, MAX_PROBLEMS, MAX_MILESTONES, MAX_RUNGS, MAX_TRACKS, MAX_BANDS, MAX_NEEDS, DEFAULT_CHANGE_CAP, MAX_CHANGE_CAP, DEFAULT_CONFLICT_AT, DEFAULT_DEMOTE_AFTER, DAY_MINUTES, RECENT_MESSAGES, SECRET_TEXT_MAX, SECRET_TITLE_MAX, SECRET_WHEN_MAX, NOTE_SOURCES, MILESTONE_MAX, DESCRIBE_MAX, TAIL_SECRETS_PER_NPC, CONTEXT_BUDGET, FEATURE_STAGES, FEATURE_DRIFT, FEATURE_PRESETS, FEATURE_SCAN_EVERY_REPLY, FEATURE_GATE, FEATURE_MOOD_PULL, FEATURE_NOTES, FEATURES, replyKey, slug, npcKey, KEY_PEOPLE_QUERY, wordKey, parseBands, bandWord, parseNeeds, normalizeMeterSettings, meterDefs, thresholdReached, stageAt, parseMeterValue } from './npc-meters-config.js';
export { normalizeSecrets, secretId, normalizeGeneratedSecrets, secretsToLines, secretsFromLines, limitsToLines, limitsFromLines } from './npc-meters-secrets.js';
export { initialNpcSlice, observeKeyAway, CAST_QUERY, CAST_MADE_MAX, observeCast, validateNpcSlice, findNpcKey, meterValue, rungMet } from './npc-meters-slice.js';
export { SETTINGS_DEFAULTS, SETTINGS_SCHEMA } from './npc-meters-schema.js';
export { FEATURE_SOCIAL, SOCIAL_QUERY } from './social-check.js';
export { createNpcPart } from './npc-meters-parts/part.js';
