// Reads the People tab's parts and the per-person dossier map from Story Block queries: the people come from the store (people.*). Still asked of
// NPC State for now (P7 moves them): npc.next (the ladder: its rungs are NPC State settings, not in the store), npc.cast (the notes' rules: the store's secrets lose `at`; the mood numbers),
// npc.meters ({ name }) (Recent changes: derived from the bonds' lastEvent, no store reader yet); and of the Director: the place and news of people away (director.away.view).

import { selectDossier } from './dossier.js';

const isRec = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Story Block's `scene.present` as a list of names, or null while that query is not there (then the store's own flag and place decide). */
export function presentOf(read) {
  const answer = read('scene.present', {});
  return Array.isArray(answer) ? answer.filter(name => typeof name === 'string') : null;
}

export function peopleParts(read) {
  return { list: read('people.list', {}), away: read('director.away.view', {}), party: read('party.actors', {}), ties: read('people.ties', {}), place: read('scene.place', {})?.name ?? null, present: presentOf(read) };
}

// Dossier pages keyed by person id (what a card and a tie carry), and by lowercase name for a caller that has only the name.
export function dossierMap(read) {
  const parts = peopleParts(read);
  const casts = read('npc.cast', {});
  // (Add to party only for someone the story offered as a companion and nobody has answered yet: rpg.joinsOpen; the reader never recruits on their own)
  const offered = new Set((Array.isArray(read('rpg.joinsOpen', {})) ? read('rpg.joinsOpen', {}) : []).map(item => String(item?.name ?? '').trim().toLocaleLowerCase()).filter(Boolean));
  const out = {};
  const byName = {};
  for (const row of Array.isArray(parts.list) ? parts.list : []) {
    const dossier = read('people.dossier', { id: row.id });
    const vm = selectDossier({
      dossier, meters: read('npc.meters', { name: row.name }), next: read('npc.next', { name: row.name }), cast: (Array.isArray(casts) ? casts : []).find(item => isRec(item) && item.key === row.id),
      portrait: dossier?.portrait, away: parts.away, party: parts.party, join: offered.has(row.name.trim().toLocaleLowerCase()) ? read('rpg.partyAdd', { name: row.name }) : null, people: parts.list, place: parts.place, present: parts.present,
    });
    if (!vm) continue;
    out[row.id] = vm;
    const name = row.name.trim().toLocaleLowerCase();
    if (name && !Object.hasOwn(byName, name)) byName[name] = vm;
  }
  return { ...byName, ...out };
}
