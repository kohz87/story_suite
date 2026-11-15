// Reads the People tab's parts and the per-person dossier map from Story Block queries.

import { selectDossier } from './dossier.js';

const isRec = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function peopleParts(read) {
  const known = read('npc.known', {});
  const dossiers = {};
  for (const row of Array.isArray(known) ? known : []) {
    const name = typeof row === 'string' ? row : row?.name;
    if (name) dossiers[name] = read('npc.dossier', { name });
  }
  const party = read('party.actors', {});
  return { known, dossiers, present: read('npc.present', { meters: true }), cast: read('npc.cast', {}), keyPeople: read('director.keyPeople.view', {}), party };
}

export function dossierMap(read) {
  const parts = peopleParts(read);
  const out = {};
  for (const name of Object.keys(parts.dossiers)) {
    const dossier = parts.dossiers[name];
    const vm = selectDossier({
      dossier, meters: read('npc.meters', { name }), next: read('npc.next', { name }), cast: (parts.cast ?? []).find(r => r?.name === name),
      portrait: read('npc.portrait', { name }), keyPeople: parts.keyPeople, party: parts.party,
    });
    if (!vm) continue;
    out[name] = vm;
    out[name.trim().toLocaleLowerCase()] = vm;
    if (isRec(dossier) && dossier.key) out[dossier.key] = vm;
  }
  return out;
}
