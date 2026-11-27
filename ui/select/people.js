// Turns the store's people rows, the people away (director.away.view), the party answers and the social graph into the People view-model (PEOPLE_SHAPE), leaving gaps null or empty.

import { tieKind } from './tie-kinds.js';
import { namesakes } from '../../modules/people/meters/npc-meters-parts/namesakes.js';

const WHERE_MAX = 40;
const FILTERS = ['all', 'party', 'followed', 'deceased', 'dormant'];
const AXES = ['trust', 'affection', 'desire', 'tension'];

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keyOf = name => String(name ?? '').trim().toLocaleLowerCase();
const cut = (value, max) => (value && value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value);

const labelsOf = row => [row.name, ...(Array.isArray(row.aliases) ? row.aliases : [])].map(keyOf).filter(Boolean);

const metersOf = found => Object.fromEntries(AXES.map(axis => [axis, Number.isFinite(Number(found?.[axis])) ? Number(found[axis]) : 0]));

function cardOf(row, partyKeys) {
  return {
    personId: row.id, name: row.name, portrait: row.portrait ?? null, role: row.role ?? null,
    aliases: (Array.isArray(row.aliases) ? row.aliases : []).filter(alias => typeof alias === 'string' && alias.trim()),
    followed: row.followed === true, inParty: partyKeys.has(keyOf(row.name)),
    mood: row.mood ?? null, meters: metersOf(row.meters), where: cut(row.location ?? null, WHERE_MAX),
  };
}

// Ties for the map: each stored edge whose text reads as one of the four kinds, as { a, b, kind } between person ids.
function tiesOf(edges) {
  return (Array.isArray(edges) ? edges : []).filter(isRecord).map(edge => ({ a: edge.aId, b: edge.bId, kind: tieKind(edge.aToB, edge.bToA) })).filter(tie => tie.kind);
}

/**
 * Whether a living person is here: the union of the store's own flag (`present`: the story put them in the scene, a `+ present` line or the scene's list stamped by NPC State) and Story Block's
 * `scene.present` (names; each matched against the person's name and aliases, folded). Where a person was last placed is NOT presence: someone who left a place is stored there ("away, at the Guild Office"),
 * and coming back to that place without them must not bring them back. A missing or empty list removes nobody the store has here, and a reply with no change block (so a frozen list) never hides an arrival.
 * `place` is kept in the signature for the callers that pass it.
 */
export const isHere = (row, _place, present = null) => row.lifeState !== 'deceased'
  && (row.present === true
    || (Array.isArray(present) && labelsOf(row).some(label => present.some(name => keyOf(typeof name === 'string' ? name : name?.name) === label))));

/**
 * People view-model from { list: people.list (the store's rows), away?: director.away.view (news, doing and return date of those away), party?: party.actors,
 * ties?: people.ties, place?: the scene's place name, filter? }; an empty view while the chat has no people yet (list null). here = isHere; elsewhere = not present, not dormant;
 * dormant (36.12: 30 replies unseen; followed, present and party people never) leaves All and is its own list; the dead are listed with their card.
 * Gaps: `said`, and the death's when and where (the store holds neither).
 */
export function selectPeople({ list, away: awayView, party, ties, place, present, filter } = {}) {
  const away = new Map((isRecord(awayView) && Array.isArray(awayView.people) ? awayView.people : []).filter(isRecord).map(row => [keyOf(row.name), row]));
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
    if (isHere(row, place, present)) { here.push(card); continue; }
    const kp = away.get(keyOf(row.name));
    const gone = { ...card, lastPlace: cut(row.location ?? null, 80), lastSeen: kp?.newsAgo || null, said: null, ...(kp?.away ? { doing: cut(kp.doing || null, 160), back: kp.back || null } : {}) };
    (row.dormant === true && !card.inParty ? dormant : elsewhere).push(gone);
  }
  const active = [...here, ...elsewhere];
  // Names the scene has here that no record answers to (a person the story named but NPC State has no dossier for): told, never dropped silently.
  const known = new Set((Array.isArray(list) ? list : []).filter(isRecord).flatMap(labelsOf));
  const shared = namesakes(Array.isArray(list) ? list : []);   // (a namesake's shown form Name "Nickname" is that person)
  const unrecorded = [...new Set((Array.isArray(present) ? present : []).map(name => String(typeof name === 'string' ? name : name?.name ?? '').trim()).filter(name => name && !known.has(keyOf(name)) && !shared.asForm(name)?.found.length))];
  const edges = tiesOf(ties);
  return {
    filter: FILTERS.includes(filter) ? filter : 'all',
    counts: { all: active.length, party: active.filter(c => c.inParty).length, followed: active.filter(c => c.followed).length, deceased: deceased.length, notSeenLately: dormant.length },
    here, elsewhere, notSeenLately: dormant.length, dormant, deceased,
    ...(unrecorded.length ? { unrecorded } : {}),
    ...(edges.length ? { ties: edges } : {}),
  };
}
