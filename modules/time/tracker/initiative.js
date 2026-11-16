// Story Director v2, tracker part: NPC initiative, a seeded pick by code (no model call).
//
// Feature `story-director.initiative` (on by default, MODULES §F100). Before each reply, code picks at
// most one NPC who takes the initiative in it (approaches, interrupts, asks), and the Director note says
// so in one line: "Initiative: Elula may approach {{user}} about Wolf Contract."
//
// * Who can: someone present (Story Block's `scene.present`, NPC State Delta's `npc.present`) or nearby
//   (an NPC NSD knows, `npc.known`, whose dossier `location` is the scene's place or region), with an
//   open thread that names them (its key, `giver:` or `people:`; a secret never counts).
// * Weight: the urgency of their most urgent thread (due now 4, ready to turn in or due within the
//   "Due soon" days 3, else 2), times their trust with {{user}} when NPC State Delta answers
//   (`npc.meters` trust, else the dossier's relationship trust: -100 → ×0.25 … 0 → ×1 … +100 → ×2), else
//   even (×1). Whole numbers, so the pick never depends on rounding.
// * Cooldown (setting `tracker.initiativeCooldown`, default 2, at least 2): someone picked at round r is
//   not picked again before round r + cooldown, so never two replies running.
// * Seed: the pick is a `system` step before the reply (`director.initiative { at }`, from beforeGenerate),
//   drawn with the receipt's seed (`ctx.rng()`), and recorded as a slot written whole (SPEC §2.2):
//   `director.initiative = [{ at, round, key, name, recent: [{ key, round }] }]`. A swipe, a regenerate, a
//   Continue or a Re-read of the same reply finds the pick made (`at`, the chat's length, as the chronicle's
//   world pick) and shows it again; replay applies the receipt's ops, so a rebuild gives the same pick.
//   Without the hook (a host that runs none), the tail picks the same way with a hash of the head's rev.
// * Known only: the line names the thread only when {{user}} knows of it (a quest taken on, a hook, an
//   event the story wrote: world/known.js rules); an agenda, beat or clock, or anything the arc planner
//   made, is never named ("Initiative: Geva may approach {{user}}.").
//
// Public face: re-exports its parts.

export { DEFAULT_COOLDOWN, FEATURE, INITIATIVE, MAX_COOLDOWN } from './initiative-parts/config.js';
export { INITIATIVE_STATIC, initiativeLine } from './initiative-parts/lines.js';
export { isPersona, personaName, setPersonaReader } from './initiative-parts/persona.js';
export { cooldownOf, initiativeOn } from './initiative-parts/settings.js';
export { cooling, pickFresh, pickOf } from './initiative-parts/pick.js';
export { hashUnit, nextPick, weightedPick } from './initiative-parts/draw.js';
export { initiativeCandidates } from './initiative-parts/candidates.js';
export { initiativeCommand, initiativeHook, initiativeTail } from './initiative-parts/entry.js';
export { initiativeErrors } from './initiative-parts/errors.js';
