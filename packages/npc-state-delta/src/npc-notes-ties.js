// NPC notes, ties (phase 2 item 6): tie tags (kin, partner, friend, ally, mentor, serves, rival, enemy, owes) between any two people, also used by the map's Focus lines. The slice
// record's `ties` leaf (one JSON text: { "<other key>": ["ally", "owes"] }, at most twelve people, canonical tag order), its reader
// (readTies), the story's `~ tie` change (applyTags: +tag adds, -tag drops, idempotent so a re-read or replay is a no-op), the
// canonical text for the host to store (tiesText), the read-time fallback from a bond's relation word (tagsFromRelation; stored tags
// always win and the fallback is never stored), the people who owe a given person (owedBy: "owes" is one way, the owing side stores
// it) and the dossier rows for the people in the bond list (tiesView). Pure; imports only the key, text and relation helpers.
// Public face: re-exports its parts.
export { TIE_FAMILIES, ONE_WAY_TAGS } from './npc-notes-ties-parts/tag-families.js';
export { TIE_TAGS, TIES_MAX_PEOPLE } from './npc-notes-ties-parts/shared-tags.js';
export { TIES_TEXT_MAX, readTies, tiesText } from './npc-notes-ties-parts/record.js';
export { applyTags } from './npc-notes-ties-parts/change.js';
export { tagsFromRelation } from './npc-notes-ties-parts/relation.js';
export { owedBy, tiesView } from './npc-notes-ties-parts/view.js';
