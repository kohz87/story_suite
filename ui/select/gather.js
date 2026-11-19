// Reads the scene answers from Story Block queries: one pass over the query names, plus the portrait and gear lookups the selectors need.

import { isHere } from './people.js';
import { ownerOf } from '../runtime/owner-id.js';
import { presentOf } from './people-parts.js';

const SCENE = ['director.time', 'director.status', 'scene.place', 'scene.weather', 'scene.you', 'party.actors', 'party.pc', 'party.levels',
  'party.terms', 'rpg.sheet', 'mounts.pace', 'director.goal', 'director.next', 'atlas.trip', 'inventory.wallet', 'inventory.currency',
  'inventory.encumbrance', 'npc.cast', 'chatter.head', 'time.overdue', 'reply.changes', 'rpg.joinsOpen'];

// Who is here, from the store: the people of `people.list` who are here (isHere: present, or at the scene's place) as [{ id, name, meters, followed, portrait, status, goal }] (the old `npc.present` answer's shape, still the
// key the selectors read); `status` is what they are doing (the same stored text the dossier's Right now shows) and `goal` what they want (people.dossier's), each null when none; null while the chat has no people slice.
const goalOf = dossier => (typeof dossier?.goal === 'string' && dossier.goal.trim()) || null;
const hereOf = (list, place, present, read) => (Array.isArray(list)
  ? list.filter(row => row && isHere(row, place, present)).map(row => ({
    id: row.id, name: row.name, meters: row.meters, followed: row.followed === true, portrait: row.portrait ?? null,
    status: row.status ?? null, goal: goalOf(read('people.dossier', { id: row.id })),
  }))
  : null);

// The names the scene has here that no stored person answers to (name or alias, any case); [] without a people list or a present list.
const unrecordedOf = (list, present) => {
  const known = new Set((Array.isArray(list) ? list : []).filter(row => row && typeof row === 'object').flatMap(row => [row.name, ...(Array.isArray(row.aliases) ? row.aliases : [])]).map(name => String(name ?? '').trim().toLowerCase()));
  const seen = new Set();
  return (Array.isArray(present) && Array.isArray(list) ? present : []).map(name => String(name ?? '').trim()).filter(name => name && !known.has(name.toLowerCase()) && !seen.has(name.toLowerCase()) && seen.add(name.toLowerCase()));
};

// Asks each query once; the people come from the store (`people.list`). A query that is not there is a gap (null), never an error.
export function gather(read, names = SCENE) {
  const list = read('people.list', {});
  const present = presentOf(read);
  const answers = { 'npc.present': hereOf(list, read('scene.place', {})?.name, present, read), 'scene.unrecorded': unrecordedOf(list, present) };
  // (Today names only what the reader may see: with the plan hidden, `director.next` leaves off-screen agendas, clocks and beats out)
  for (const name of names) answers[name] = read(name, name === 'director.next' ? { shown: true } : {});
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
    // (gear.view and inventory.gear both take the owner the inventory files the member under: `party` for the main character, else the member's id;
    // gear.view has no `id` argument, and without an owner it answers the main character's slots)
    const owner = ownerOf(actor.id, pc);
    const view = read('gear.view', { owner });
    // (the stats the worn pieces add: inventory.gear's statBonus)
    const bonus = view ? read('inventory.gear', { owner })?.statBonus : null;
    gear[actor.id] = bonus && typeof bonus === 'object' ? { ...view, statBonus: bonus } : view;
  }
  return gear;
}

// The Party paper-doll's portraits, from the same sources as the card and Here now: You = the people row of the party's own name, else the persona's avatar;
// a companion = their people row (NPC State, a pack's portrait) by name or alias. { [actor id]: url }; a member with none is left out (the initial shows).
export function partyPortraits(read, ctx, actors) {
  const rows = (read('people.list', {}) ?? []).filter(row => row && typeof row === 'object');
  const named = name => {
    const key = String(name ?? '').trim().toLowerCase();
    return key ? rows.find(row => [row.name, ...(Array.isArray(row.aliases) ? row.aliases : [])].some(n => String(n ?? '').trim().toLowerCase() === key)) : null;
  };
  const pcId = read('party.pc', {})?.id ?? null;
  const out = {};
  for (const actor of Array.isArray(actors) ? actors : []) {
    if (!actor?.id) continue;
    const src = (actor.id === pcId ? named(actor.name)?.portrait || personaPortrait(read, ctx) : named(actor.name)?.portrait) || null;
    if (typeof src === 'string' && src) out[actor.id] = src;
  }
  return out;
}
