// Reads the People tab's parts and the per-person dossier map from Story Block queries: the people come from the store (people.*). Still asked of
// NPC State for now (P7 moves them): npc.next (the ladder: its rungs are NPC State settings, not in the store), npc.cast (the notes' rules: the store's secrets lose `at`; the mood numbers),
// npc.meters ({ name }) (Recent changes: derived from the bonds' lastEvent, no store reader yet); and of the Director: the place and news of key people.

import { selectDossier } from './dossier.js';

const isRec = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function peopleParts(read) {
  return { list: read('people.list', {}), keyPeople: read('director.keyPeople.view', {}), party: read('party.actors', {}), ties: read('people.ties', {}), place: read('scene.place', {})?.name ?? null };
}

// Dossier pages keyed by person id (what a card and a tie carry), and by lowercase name for a caller that has only the name.
export function dossierMap(read) {
  const parts = peopleParts(read);
  const casts = read('npc.cast', {});
  const out = {};
  const byName = {};
  for (const row of Array.isArray(parts.list) ? parts.list : []) {
    const dossier = read('people.dossier', { id: row.id });
    const vm = selectDossier({
      dossier, meters: read('npc.meters', { name: row.name }), next: read('npc.next', { name: row.name }), cast: (Array.isArray(casts) ? casts : []).find(item => isRec(item) && item.key === row.id),
      portrait: dossier?.portrait, keyPeople: parts.keyPeople, party: parts.party, people: parts.list, place: parts.place,
    });
    if (!vm) continue;
    out[row.id] = vm;
    const name = row.name.trim().toLocaleLowerCase();
    if (name && !Object.hasOwn(byName, name)) byName[name] = vm;
  }
  return { ...byName, ...out };
}
