// Builds the chat view-models (the people here for Now, a reply's change lines, the ✦ sheet) from recorded query answers; gaps come back as null or [].

import { withCoinUnit } from './coin-unit.js';

// answers: { [queryName]: answer } as the port read them. opts: { rpg, persona, portraits: { [name]: npc.portrait answer }, fightOpen, at }.

const isRec = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => (typeof value === 'string' ? value.trim() : '');
const list = value => (Array.isArray(value) ? value : []);
const METERS = ['trust', 'affection', 'desire', 'tension'];

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

// A place name over 40 (UTF-16 units, as the contract's maxLength counts) is cut with "…", so the line shows it was cut (SOAK2UI 11's "…House of the"),
// whole characters only (an emoji is never split).
function cutWhere(full) {
  if (full.length <= 40) return full;
  let out = '';
  for (const ch of full) { if (out.length + ch.length > 39) break; out += ch; }
  return `${out.trimEnd()}…`;
}

// The drawer's people: those `npc.present` names, with mood from `npc.cast` and the thought from `chatter.head` (SB/domains/core/module.js:84).
// The scene line (where ≤40, doing, wearing) is a gap (UI-PLAN §2.1): `where` is the scene's place name until it lands.
export function selectDrawer(answers = {}, opts = {}) {
  const portraits = isRec(opts.portraits) ? opts.portraits : {};
  const place = cutWhere(text(answers['scene.place']?.name));
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
      personId: text(entry?.id) || text(found?.key) || name,
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

// A reply's lines from `reply.changes` (SB core: { lines: [{ glyph, line, detail, applied }], refused: [{ line, reason }], stateThen }).
// null when the reply has no receipts (nothing to show).
export function replyLines(answers = {}) {
  const answer = isRec(answers['reply.changes']) ? answers['reply.changes'] : null;
  if (!answer) return null;
  const lines = list(answer.lines).filter(isRec).map(row => ({ glyph: text(row.glyph), line: text(row.glyph) === 'coin' ? withCoinUnit(text(row.line), answers['inventory.currency']) : text(row.line), detail: text(row.detail) || null, applied: row.applied !== false, assist: row.assist === true, held: row.held === true }));
  for (const miss of list(answer.refused)) lines.push({ glyph: 'warn', line: text(miss?.line), detail: text(miss?.reason) || null, applied: false, assist: false, held: false });
  return lines;
}

export function selectReplyMenu(answers = {}, opts = {}) {
  // A reply with a stored repair keeps its sheet even when no shown line came of it (a hook or a time line), so it can still be discarded; so does a reply with a record (the ✦ button stays on the latest reply after a delete).
  const lines = replyLines(answers) ?? (opts.repaired === true || opts.recorded === true ? [] : null);
  if (!lines) return null;
  const notApplied = lines.filter(line => !line.applied).length;
  // `stateThen` is the place and weather of the state the reply query was asked on (`{ asOf }` for an earlier reply).
  const then = isRec(answers['reply.changes']?.stateThen) ? answers['reply.changes'].stateThen : {};
  return {
    at: text(opts.at),
    lines,
    counts: { changes: lines.length - notApplied, heldBack: notApplied, notApplied },
    stateThen: { place: text(then.place), weather: text(then.weather) || null },
    // The reply holds a repair the reader can discard (selectors give it from the chat's text: ui/select/unrecorded.js repairedAt).
    repaired: opts.repaired === true,
  };
}
