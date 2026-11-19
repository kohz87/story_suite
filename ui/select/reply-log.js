// Builds each story reply's card view-model from Story Block's state at that reply (sdk query `{ asOf }`): its time, place, weather, HP·MP·SP
// (with the value before it), condition, changes, who was here, chatter and choices. Replay == live: the state at a reply is the store's own.

import { selectCard } from './card.js';
import { replyLines } from './chat.js';
import { isHere } from './people.js';
import { isCarrier, readRecord } from '../../core/persist.js';

const STATE = ['director.time', 'director.status', 'scene.place', 'scene.weather', 'scene.you', 'party.pc', 'party.actors', 'party.terms', 'rpg.sheet', 'inventory.currency', 'people.list', 'scene.present'];
const METERS = ['trust', 'affection', 'desire', 'tension'];
const text = value => (typeof value === 'string' ? value.trim() : '');
const list = value => (Array.isArray(value) ? value : []);

// A reader whose every question is asked of the state after reply `index`.
const readerAt = (read, index) => (name, args) => read(name, { ...(args ?? {}), asOf: index });

const POOLS = ['party.pc', 'party.actors', 'rpg.sheet'];

function answersAt(read, index, names = STATE) {
  const ask = readerAt(read, index);
  const out = {};
  for (const name of names) out[name] = ask(name, {});
  if (names === STATE) out['reply.changes'] = ask('reply.changes', { index });
  return out;
}

// HP, MP and SP of the reader's character as the card reads them (party.pc pools, else the sheet's bars); [] without the RPG.
function poolsOf(answers) {
  const rpg = list(answers['party.actors']).length > 0;
  // (no party roster: the sheet's first row, the party's lead in the sheet's order)
  const bars = rpg ? selectCard(answers, { rpg }).bars : list(answers['rpg.sheet'])[0]?.bars;
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
function cardOf(index, answers, before, chatter, choices) {
  const { scene } = selectCard(answers, {});
  const pools = poolsOf(answers).map(bar => {
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

/** The indexes of `chat` that get a card: story replies (not the reader's, not system ones); the greeting (before the reader's first message) only with a record. */
export function replyIndexes(chat) {
  const all = Array.isArray(chat) ? chat : [];
  const firstUser = all.findIndex(message => message?.is_user);
  const out = [];
  all.forEach((message, index) => {
    if (!isCarrier(message) || message.is_system) return;
    if ((firstUser < 0 || index < firstUser) && !readRecord(message)) return;
    out.push(index);
  });
  return out;
}

/**
 * The cards of replies `indexes` (default: every reply of `chat` that gets one) → [{ index, top, changes, chatter, here, choices }] in chat order.
 * `read(name, args)` asks the sdk (a gap is null); a greeting card is kept only when it has something (changes, chatter or choices).
 */
export function selectReplyLog(read, { chat = [], indexes = null } = {}) {
  const wanted = new Set(Array.isArray(indexes) ? indexes.filter(Number.isInteger) : replyIndexes(chat));
  const own = replyIndexes(chat).filter(index => wanted.has(index));
  if (!own.length) return [];
  const chatter = new Map(list(read('chatter.replies', {})).filter(item => Number.isInteger(item?.index)).map(item => [item.index, list(item.lines).filter(row => text(row?.name) && text(row?.text)).map(row => ({ name: text(row.name), text: text(row.text) }))]));
  const choices = new Map(list(read('choices.replies', {})).filter(item => Number.isInteger(item?.index)).map(item => [item.index, list(item.choices).map(text).filter(Boolean)]));
  const firstUser = (Array.isArray(chat) ? chat : []).findIndex(message => message?.is_user);
  const out = [];
  for (const index of own) {
    const answers = answersAt(read, index);
    const before = index > 0 ? poolsOf(answersAt(read, index - 1, POOLS)) : [];
    const card = cardOf(index, answers, before, chatter.get(index) ?? [], choices.get(index) ?? []);
    const greeting = firstUser < 0 || index < firstUser;
    if (greeting && !card.changes.length && !card.chatter.length && !card.choices.length) continue;
    out.push(card);
  }
  return out;
}
