// Field names and limits of the `names` content kind.

// A ladder of ranks, lowest first: `{ id: 'F', title?, levels?: [lo, hi], reward?: [lo, hi], xp?: [lo, hi] }`, the
// reward in whole units of the chat's one currency and `xp` the experience a job of the rank may give (whole XP, 0 to
// RANKS_LIMITS.xp). Without `xp`, an open quest template's XP is held to `reward` as before (2.5.0 added `xp`).
// The `names` content kind: ONE object (not a list), `{ banned?: [..], <culture id>: { regions, given, family? } }`. Story Director's names
// part reads it through `packs.content { kind: 'names' }` to suggest given names for new people in a scene whose `place.region` contains
// one of a culture's regions (first culture in key order wins). `banned` (overused names) is merged across packs.
export const NAMES_FIELDS = Object.freeze(['regions', 'given', 'family']);
export const NAMES_LIMITS = Object.freeze({ cultures: 20, regions: 8, region: 80, given: 60, family: 60, name: 40, banned: 200, bannedName: 80 });
