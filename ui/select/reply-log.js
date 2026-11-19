// Builds each story reply's card view-model from Story Block's state at that reply (sdk query `{ asOf }`): its time, place, weather, HP·MP·SP
// (with the value before it), condition, changes, who was here, chatter and choices. Replay == live: the state at a reply is the store's own.

import { selectCard } from './card.js';
import { replyLines } from './chat.js';
import { isHere } from './people.js';
import { isCarrier, readRecord } from '../../core/persist.js';
import { prefixKeys } from './reply-keys.js';

const STATE = ['director.time', 'director.status', 'scene.place', 'scene.weather', 'scene.you', 'party.pc', 'party.actors', 'party.terms', 'rpg.sheet', 'inventory.currency', 'people.list', 'scene.present'];
const METERS = ['trust', 'affection', 'desire', 'tension'];
const text = value => (typeof value === 'string' ? value.trim() : '');
const list = value => (Array.isArray(value) ? value : []);

// A reader whose every question is asked of the state after reply `index`.
const readerAt = (read, index) => (name, args) => read(name, { ...(args ?? {}), asOf: index });

function answersAt(read, index) {
  const ask = readerAt(read, index);
  const out = {};
  for (const name of STATE) out[name] = ask(name, {});
  out['reply.changes'] = ask('reply.changes', { index });
  return out;
}

// HP, MP and SP of the reader's character: party.pc's pools or sheet row while the roster answers (Gear in fights on), else the sheet row named as the
// reader (`persona`), else the sheet's first row (the party's lead in its order); [] without the RPG.
function poolsOf(answers, persona = '') {
  const rpg = list(answers['party.actors']).length > 0;
  const rows = list(answers['rpg.sheet']);
  const own = rows.find(row => persona && text(row?.name).toLowerCase() === persona.toLowerCase()) ?? rows[0];
  const bars = (rpg ? selectCard(answers, { rpg }).bars : null) ?? own?.bars;
  return list(bars).filter(bar => ['hp', 'mp', 'sp'].includes(bar?.kind) && Number.isFinite(bar.value) && Number.isFinite(bar.max) && bar.max > 0);
}

// Who was here at that reply: the store's people who are here (present, or at the scene's place), as slim cards.
function hereOf(answers) {
  const place = answers['scene.place']?.name ?? null;
  const present = Array.isArray(answers['scene.present']) ? answers['scene.present'].filter(name => typeof name === 'string') : null;
  return list(answers['people.list']).filter(row => row && typeof row === 'object' && text(row.name) && isHere(row, place, present)).map(row => ({
    personId: text(row.id) || text(row.name),
    name: text(row.name),
    portrait: text(row.portrait) || null,
    meters: Object.fromEntries(METERS.map(key => [key, Number.isFinite(row.meters?.[key]) ? row.meters[key] : 0])),
  }));
}

/** One reply's card: `index` its place in the chat, `answers` the state at it, `before` the pools before it ([] for none), chatter and choices its own. */
function cardOf(index, answers, before, chatter, choices, persona) {
  const { scene } = selectCard(answers, {});
  const pools = poolsOf(answers, persona).map(bar => {
    const was = before.find(row => row.kind === bar.kind);
    return { kind: bar.kind, value: bar.value, max: bar.max, before: was && was.value !== bar.value ? was.value : null };
  });
  return {
    index,
    top: { date: scene.date, time: scene.time, place: scene.place, weather: scene.weather, pools, condition: text(answers['scene.you']?.condition) || null },
    changes: replyLines(answers) ?? [],
    chatter,
    here: hereOf(answers),
    choices,
  };
}

/**
 * The indexes of `chat` that get a card: story replies (not the reader's, not system ones); the greeting (before the reader's first message) only with
 * a record, or while it is the newest story message (its card carries the Open Suite corner and the action line).
 */
export function replyIndexes(chat) {
  const all = Array.isArray(chat) ? chat : [];
  const firstUser = all.findIndex(message => message?.is_user);
  const story = (message) => isCarrier(message) && !message.is_system;
  const newest = all.findLastIndex(story);
  const out = [];
  all.forEach((message, index) => {
    if (!story(message)) return;
    if ((firstUser < 0 || index < firstUser) && !readRecord(message) && index !== newest) return;
    out.push(index);
  });
  return out;
}

const CACHE_MAX = 400;

// One reply's state-read part of its card (top, changes, here) and its pools, from `cache` by its prefix key when nothing at or before it changed.
function stateCard(read, cache, key, index, persona) {
  const hit = cache?.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return hit; }
  const answers = answersAt(read, index);
  const made = { pools: poolsOf(answers, persona).map(bar => ({ kind: bar.kind, value: bar.value, max: bar.max })), base: cardOf(index, answers, [], [], [], persona) };
  if (cache) { cache.set(key, made); while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value); }
  return made;
}

/**
 * The cards of replies `indexes` (default: every reply of `chat` that gets one) → [{ index, top, changes, chatter, here, choices }] in chat order.
 * `read(name, args)` asks the sdk (a gap is null); `persona` is the reader's name (their own sheet row's pools); `cache` (a Map, kept by the caller)
 * keeps each card's state part by its prefix key and `env` (the switches and settings it was read with). A greeting card is kept only when it has
 * something (changes, chatter or choices). The value before a reply is the state at the story message before it (the reader's messages carry none).
 */
export function selectReplyLog(read, { chat = [], indexes = null, persona = '', cache = null, env = '' } = {}) {
  const list0 = Array.isArray(chat) ? chat : [];
  const wanted = new Set(Array.isArray(indexes) ? indexes.filter(Number.isInteger) : replyIndexes(list0));
  const own = replyIndexes(list0).filter(index => wanted.has(index));
  if (!own.length) return [];
  const chatter = new Map(list(read('chatter.replies', {})).filter(item => Number.isInteger(item?.index)).map(item => [item.index, list(item.lines).filter(row => text(row?.name) && text(row?.text)).map(row => ({ name: text(row.name), text: text(row.text) }))]));
  const choices = new Map(list(read('choices.replies', {})).filter(item => Number.isInteger(item?.index)).map(item => [item.index, list(item.choices).map(text).filter(Boolean)]));
  const firstUser = list0.findIndex(message => message?.is_user);
  const keys = prefixKeys(list0).map(key => `${env}|${persona}|${key}`);
  const out = [];
  for (const index of own) {
    const { base, pools } = stateCard(read, cache, keys[index], index, persona);
    const prev = list0.slice(0, index).findLastIndex(message => isCarrier(message));
    const before = prev >= 0 ? stateCard(read, cache, keys[prev], prev, persona).pools : [];
    const card = { ...base, top: { ...base.top, pools: pools.map(bar => { const was = before.find(row => row.kind === bar.kind); return { ...bar, before: was && was.value !== bar.value ? was.value : null }; }) }, chatter: chatter.get(index) ?? [], choices: choices.get(index) ?? [] };
    const greeting = (firstUser < 0 || index < firstUser) && index !== own.at(-1);
    if (greeting && !card.changes.length && !card.chatter.length && !card.choices.length) continue;
    out.push(card);
  }
  return out;
}
