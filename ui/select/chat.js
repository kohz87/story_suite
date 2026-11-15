// Builds the chat view-models (inline row, people drawer, reply menu lines) from recorded query answers; gaps come back as null or [].

import { selectCard } from './card.js';

// answers: { [queryName]: answer } as the port read them. opts: { rpg, persona, portraits: { [name]: npc.portrait answer }, fightOpen, at }.

const isRec = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => (typeof value === 'string' ? value.trim() : '');
const list = value => (Array.isArray(value) ? value : []);
const METERS = ['trust', 'affection', 'desire', 'tension'];

// The short purse ("2g 14s 6c", decision 39.9) is a UI formatter: `inventory.wallet` (SB/domains/inventory/answers.js:63) holds
// { coin: n } in the smallest unit; `inventory.currency` (answers.js:32) gives { name, plural, short, coins: [{ name, value, short? }] }.
function shortMoney(wallet, currency) {
  if (!isRec(wallet) || !Number.isFinite(wallet.coin)) return null;
  const total = Math.max(0, Math.round(wallet.coin));
  const coins = list(currency?.coins).filter(coin => isRec(coin) && coin.value > 0);
  if (!coins.length) return { short: `${total}${text(currency?.short) || text(currency?.name)?.[0] || 'g'}` };
  const sign = coin => text(coin.short) || text(coin.name)[0] || '';
  let rest = total;
  const parts = [];
  for (const coin of [...coins].sort((a, b) => b.value - a.value)) {
    const count = Math.floor(rest / coin.value);
    if (count > 0) parts.push(`${count}${sign(coin)}`);
    rest -= count * coin.value;
  }
  const base = [...coins].sort((a, b) => a.value - b.value)[0];
  return { short: parts.length ? parts.join(' ') : `0${sign(base)}` };
}

// `npc.cast` bars (NSD/npc-meters-queries.js:176): [{ id, value }]; `npc.present` with { meters: true } (NSD/adapter/queries.js:200): [{ name, meters }].
function metersOf(entry, cast) {
  const out = {};
  const bars = list(cast?.bars);
  for (const key of METERS) {
    const bar = bars.find(item => item?.id === key);
    const value = Number.isFinite(entry?.meters?.[key]) ? entry.meters[key] : bar?.value;
    out[key] = Number.isFinite(value) ? value : 0;
  }
  return out;
}

// The drawer's people: those `npc.present` names, with mood from `npc.cast` and the thought from `chatter.head` (SB/domains/core/module.js:84).
// The scene line (where ≤40, doing, wearing) is a gap (UI-PLAN §2.1): `where` is the scene's place name until it lands.
export function selectDrawer(answers = {}, opts = {}) {
  const portraits = isRec(opts.portraits) ? opts.portraits : {};
  const place = text(answers['scene.place']?.name).slice(0, 40);
  const cast = list(answers['npc.cast']);
  const chatter = list(answers['chatter.head']);
  const rows = [];
  for (const item of list(answers['npc.present'])) {
    const entry = typeof item === 'string' ? { name: item } : item;
    const name = text(entry?.name);
    if (!name) continue;
    const found = cast.find(row => row?.name === name);
    const said = chatter.find(row => row?.name === name);
    rows.push({
      personId: text(found?.key) || name,
      name,
      portrait: text(portraits[name]) || null,
      meters: metersOf(entry, found),
      mood: text(found?.mood?.word),
      where: place,
      thought: text(said?.text) || null,
    });
  }
  return rows;
}

// A reply's lines from `changesDigest` (SB/screens/changes-card.js:234; { gained, lost, coin, place, arrived, left }) and from
// `notes.refusedAt` (SB/reply-notes.js:51; [{ line, reason }]). null when neither is there: one `reply.changes(index)` is a gap (UI-PLAN §2.1).
export function replyLines(answers = {}) {
  const digest = isRec(answers['reply.digest']) ? answers['reply.digest'] : null;
  const refused = Array.isArray(answers['notes.refusedAt']) ? answers['notes.refusedAt'] : null;
  if (!digest && !refused) return null;
  const lines = [];
  const add = (glyph, line, detail = null) => lines.push({ glyph, line, detail, applied: true });
  for (const sign of [['gained', '+'], ['lost', '−']]) {
    for (const item of list(digest?.[sign[0]])) add('item', `${sign[1]}${item.qty} ${item.name}`);
  }
  if (Number.isFinite(digest?.coin) && digest.coin !== 0) add('coin', `${digest.coin > 0 ? '+' : '−'}${Math.abs(digest.coin)}`);
  if (text(digest?.place)) add('road', `To ${text(digest.place)}`);
  for (const name of list(digest?.arrived)) add('people', `${name} arrived`);
  for (const name of list(digest?.left)) add('people', `${name} left`);
  for (const miss of list(refused)) lines.push({ glyph: 'warn', line: text(miss?.line), detail: text(miss?.reason) || null, applied: false });
  return lines;
}

export function selectInlineRow(answers = {}, opts = {}) {
  const { scene } = selectCard(answers, opts);
  const lines = replyLines(answers) ?? [];
  const overdue = list(answers['time.overdue']?.overdue);
  const needsYou = overdue.length ? { n: overdue.length, title: `${overdue.length} overdue` } : null;
  return {
    date: scene.date,
    time: scene.time,
    place: scene.place,
    weather: scene.weather,
    money: shortMoney(answers['inventory.wallet'], answers['inventory.currency']),
    changes: lines.filter(line => line.applied).length,
    notApplied: lines.filter(line => !line.applied).length,
    needsYou,
    fightOpen: opts.fightOpen === true,
  };
}

export function selectReplyMenu(answers = {}, opts = {}) {
  const lines = replyLines(answers);
  if (!lines) return null;
  const notApplied = lines.filter(line => !line.applied).length;
  const place = isRec(answers['scene.place']) ? answers['scene.place'] : {};
  const weather = isRec(answers['scene.weather']) ? text(answers['scene.weather'].text) : '';
  // `stateThen` asks the same queries with { asOf } (SB/sdk.js:139); the port passes those answers in.
  return {
    at: text(opts.at),
    lines,
    counts: { changes: lines.length - notApplied, heldBack: notApplied, notApplied },
    stateThen: { place: text(place.name), weather: weather || null },
  };
}
