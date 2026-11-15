// NPC State Delta, the participant's NPC identity (contract §8, P24): one `np_` surrogate per dossier, so other modules can name a person
// without a name that can change. The pair nativeKey <-> np_ lives in the native state itself (timeline.js: state.timeline), so it is part of every
// checkpoint, moves with a chat rename, is inherited by a branch and travels in an export, and:
//   * is assigned to every admitted dossier before the new native head is published (hydration, import, creation, scan, manual edit all
//     go through `hydrateIdentity`);
//   * survives a rename (the nativeKey is the dossier's own id, `npc_<slug>`, which a rename does not change) and an alias change;
//   * is archived, never reused, when the dossier is gone; an id once issued stays reserved even after a restore took its dossier back
//     (audit-reserved: inactive, resolves through no query);
//   * resolves by id to the active dossier's { id, nativeKey, name }, and by name, alias or native key only when exactly one dossier
//     answers; unknown, ambiguous or malformed is null and nothing is created by asking.
// Pure.
// Public face: re-exports its parts.

export { NP_ID, emptyIdentity, nameKey } from './identity-parts/shared-basics.js';
export { cleanIdentity } from './identity-parts/clean-identity.js';
export { newNpId, hydrateIdentity } from './identity-parts/assign-identity.js';
export { resolveIdentity } from './identity-parts/resolve-identity.js';
