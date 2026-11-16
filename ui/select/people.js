// Turns the store's people rows, the key-people and party answers and the social graph into the People view-model (PEOPLE_SHAPE), leaving gaps null or empty.

import { tieKind } from './tie-kinds.js';

const WHERE_MAX = 40;
const FILTERS = ['all', 'party', 'followed', 'deceased', 'dormant'];
const AXES = ['trust', 'affection', 'desire', 'tension'];

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keyOf = name => String(name ?? '').trim().toLocaleLowerCase();
const cut = (value, max) => (value && value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value);

const metersOf = found => Object.fromEntries(AXES.map(axis => [axis, Number.isFinite(Number(found?.[axis])) ? Number(found[axis]) : 0]));

function cardOf(row, partyKeys) {
  return {
    personId: row.id, name: row.name, portrait: row.portrait ?? null, role: row.role ?? null,
    followed: row.followed === true, inParty: partyKeys.has(keyOf(row.name)),
    mood: row.mood ?? null, meters: metersOf(row.meters), where: cut(row.location ?? null, WHERE_MAX),
  };
}

// Ties for the map: each stored edge whose text reads as one of the four kinds, as { a, b, kind } between person ids.
function tiesOf(edges) {
  return (Array.isArray(edges) ? edges : []).filter(isRecord).map(edge => ({ a: edge.aId, b: edge.bId, kind: tieKind(edge.aToB, edge.bToA) })).filter(tie => tie.kind);
}

/** Whether a living person is here (PEOPLE-PLAN P5): named in this reply (the record's `present` flag) or last placed at the scene's place (the same name, any case). */
export const isHere = (row, place) => row.lifeState !== 'deceased'
  && (row.present === true || (Boolean(keyOf(place)) && keyOf(row.location) === keyOf(place)));

/**
 * People view-model from { list: people.list (the store's rows), keyPeople?: director.keyPeople.view (place and news of those away), party?: party.actors,
 * ties?: people.ties, place?: the scene's place name, filter? }; an empty view while the chat has no people yet (list null). here = isHere; elsewhere = not present, not dormant;
 * dormant (36.12: 30 replies unseen; followed, present and party people never) leaves All and is its own list; the dead are listed with their card.
 * Gaps: `said`, and the death's when and where (the store holds neither).
 */
export function selectPeople({ list, keyPeople, party, ties, place, filter } = {}) {
  const away = new Map((isRecord(keyPeople) && Array.isArray(keyPeople.people) ? keyPeople.people : []).filter(isRecord).map(row => [keyOf(row.name), row]));
  const partyKeys = new Set((Array.isArray(party) ? party : []).filter(isRecord).map(row => keyOf(row.name)));
  const here = [];
  const elsewhere = [];
  const dormant = [];
  const deceased = [];
  for (const row of (Array.isArray(list) ? list : []).filter(isRecord)) {
    const card = cardOf(row, partyKeys);
    if (row.lifeState === 'deceased') {
      deceased.push({ ...card, death: { how: row.lifeStateReason ?? '', when: '', where: null, presumed: row.lifeStateCertainty === 'inferred' } });
      continue;
    }
    if (isHere(row, place)) { here.push(card); continue; }
    const kp = away.get(keyOf(row.name));
    const gone = { ...card, lastPlace: cut(kp?.place ?? row.location ?? null, 80), lastSeen: kp?.newsAgo ?? null, said: null };
    (row.dormant === true && !card.inParty ? dormant : elsewhere).push(gone);
  }
  const active = [...here, ...elsewhere];
  const edges = tiesOf(ties);
  return {
    filter: FILTERS.includes(filter) ? filter : 'all',
    counts: { all: active.length, party: active.filter(c => c.inParty).length, followed: active.filter(c => c.followed).length, deceased: deceased.length, notSeenLately: dormant.length },
    here, elsewhere, notSeenLately: dormant.length, dormant, deceased,
    ...(edges.length ? { ties: edges } : {}),
  };
}
