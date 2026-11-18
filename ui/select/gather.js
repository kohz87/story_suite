// Reads the scene answers from Story Block queries: one pass over the query names, plus the portrait and gear lookups the selectors need.

import { isHere } from './people.js';
import { ownerOf } from '../runtime/owner-id.js';
import { presentOf } from './people-parts.js';

const SCENE = ['director.time', 'director.status', 'scene.place', 'scene.weather', 'scene.you', 'party.actors', 'party.pc', 'party.levels',
  'party.terms', 'rpg.sheet', 'mounts.pace', 'director.goal', 'director.next', 'atlas.trip', 'inventory.wallet', 'inventory.currency',
  'inventory.encumbrance', 'npc.cast', 'chatter.head', 'time.overdue', 'reply.changes'];

// Who is here, from the store: the people of `people.list` who are here (isHere: present, or at the scene's place) as [{ id, name, meters, followed, portrait, status, goal }] (the old `npc.present` answer's shape, still the
// key the selectors read); `status` is what they are doing (the same stored text the dossier's Right now shows) and `goal` what they want (people.dossier's), each null when none; null while the chat has no people slice.
const goalOf = dossier => (typeof dossier?.goal === 'string' && dossier.goal.trim()) || null;
const hereOf = (list, place, present, read) => (Array.isArray(list)
  ? list.filter(row => row && isHere(row, place, present)).map(row => ({
    id: row.id, name: row.name, meters: row.meters, followed: row.followed === true, portrait: row.portrait ?? null,
    status: row.status ?? null, goal: goalOf(read('people.dossier', { id: row.id })),
  }))
  : null);

// Asks each query once; the people come from the store (`people.list`). A query that is not there is a gap (null), never an error.
export function gather(read, names = SCENE) {
  const answers = { 'npc.present': hereOf(read('people.list', {}), read('scene.place', {})?.name, presentOf(read), read) };
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
  const pc = read('party.pc', {})?.id ?? null;
  for (const actor of Array.isArray(actors) ? actors : []) {
    if (!actor?.id) continue;
    const view = read('gear.view', { id: actor.id });
    // (the stats the worn pieces add: inventory.gear's statBonus, by the owner the inventory files the member under)
    const bonus = view ? read('inventory.gear', { owner: ownerOf(actor.id, pc) })?.statBonus : null;
    gear[actor.id] = bonus && typeof bonus === 'object' ? { ...view, statBonus: bonus } : view;
  }
  return gear;
}
