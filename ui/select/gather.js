// Reads the scene answers from Story Block queries: one pass over the query names, plus the portrait and gear lookups the selectors need.

import { isHere } from './people.js';

const SCENE = ['director.time', 'director.status', 'scene.place', 'scene.weather', 'scene.you', 'party.actors', 'party.pc', 'party.levels',
  'party.terms', 'rpg.sheet', 'mounts.pace', 'director.goal', 'director.next', 'director.keyPeople', 'atlas.trip', 'inventory.wallet', 'inventory.currency',
  'inventory.encumbrance', 'npc.cast', 'chatter.head', 'time.overdue', 'reply.digest', 'notes.refusedAt'];

// Who is here, from the store: the people of `people.list` who are here (isHere: present, or at the scene's place) as [{ id, name, meters, followed, portrait }] (the old `npc.present` answer's shape, still the
// key the selectors read); null while the chat has no people slice.
const hereOf = (list, place) => (Array.isArray(list)
  ? list.filter(row => row && isHere(row, place)).map(row => ({ id: row.id, name: row.name, meters: row.meters, followed: row.followed === true, portrait: row.portrait ?? null }))
  : null);

// Asks each query once; the people come from the store (`people.list`). A query that is not there is a gap (null), never an error.
export function gather(read, names = SCENE) {
  const answers = { 'npc.present': hereOf(read('people.list', {}), read('scene.place', {})?.name) };
  for (const name of names) answers[name] = read(name, {});
  return answers;
}

// What the selectors need beyond the answers: the RPG is on when the party answers; portraits come one name at a time.
// The reader's own picture when no party hero names one: the people row called by the persona's name, else the persona's avatar file.
function personaFile(c) {
  if (typeof c.user_avatar === 'string' && c.user_avatar.trim()) return c.user_avatar.trim();
  const map = c.powerUserSettings?.personas;
  if (!c.name1 || !map || typeof map !== 'object') return '';
  const named = Object.keys(map).filter(f => map[f] === c.name1);
  if (named.length === 1) return named[0];
  return [c.chatMetadata?.persona, c.powerUserSettings?.default_persona].find(f => named.includes(f)) ?? '';
}

function personaPortrait(read, ctx) {
  const c = ctx() ?? {};
  const row = c.name1 ? (read('people.list', {}) ?? []).find(r => r?.name === c.name1) : null;
  if (row?.portrait) return row.portrait;
  const file = personaFile(c);
  return file ? `/User%20Avatars/${encodeURIComponent(file)}` : null;
}

export function optsOf(read, answers, ctx) {
  const portraits = {};
  for (const row of answers['npc.present'] ?? []) if (row?.name) portraits[row.name] = row.portrait ?? null;
  const lead = answers['party.pc']?.name;
  const leadRow = lead ? (read('people.list', {}) ?? []).find(row => row?.name === lead) : null;
  return {
    rpg: Array.isArray(answers['party.actors']) && answers['party.actors'].length > 0,
    persona: ctx()?.name1 ?? '',
    portrait: lead ? leadRow?.portrait ?? null : personaPortrait(read, ctx),
    portraits,
    fightOpen: false,
  };
}

export function gearOf(read, actors) {
  const gear = {};
  for (const actor of Array.isArray(actors) ? actors : []) if (actor?.id) gear[actor.id] = read('gear.view', { id: actor.id });
  return gear;
}
