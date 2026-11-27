// Adapted from modules/rpg/charfile-parts (parse.js, read-entries.js, limits.js; keep in step when those change). Reads a saved character file's text into a clean file or a plain-words refusal. It takes the RPG's character
// file (what the Party tab's Export saves) and Text RPG's own (the same shape with a `textRpg` key of its own: each skill's exact type and cost). Never throws; nothing is kept that was not asked for.
//   { "storySuiteCharacter": 1, "level": 5, "points": 3, "stats": { "str": 14, … }, "skills": [{ "name", "about", "stat"?, "uses", "rank", "type"? }], "items"?: [...], "money"?: n, "textRpg"?: {...} }
import { STAT_KEYS } from '../words/stats.js';
import { RULES } from './rules.js';
import { W, fill } from './words.js';

export const CHAR_FILE = 'storySuiteCharacter';
export const CHAR_VERSION = 1;
/** What a file may hold: its size, level, unspent points, a stat, a skill's rank, and how many things and skills (8 and the RPG's 3 utility ones). */
export const FILE_LIMITS = Object.freeze({ bytes: 65536, level: [1, 99], points: 60, stat: [1, 30], rank: 6, skills: 11, items: 60, itemName: 60, itemNote: 300, qty: 999, carry: 500, money: 1_000_000_000 });

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const whole = (value, low, high) => Number.isSafeInteger(value) && value >= low && value <= high;
const line = (value, max) => [...(typeof value === 'string' ? value.replace(/\p{Cf}+/gu, '').normalize('NFC').replace(/\s+/g, ' ').trim() : '')].slice(0, max).join('').trim();
const bad = message => ({ ok: false, message });
const key = name => line(name, 60).toLowerCase();
// The RPG's skill types in Text RPG's: speed is movement, focus and heal are magic, area is an attack; a type not named is utility, none is an attack.
const TYPE_OF = Object.freeze({ attack: 'attack', area: 'attack', defence: 'defence', speed: 'movement', focus: 'magic', heal: 'magic', utility: 'utility' });
const OWN_TYPES = Object.freeze(['attack', 'defence', 'movement', 'magic', 'social', 'craft', 'utility']);

// One skill: the RPG's fields, then Text RPG's exact type and cost for it when its own file has them (`textRpg.skills`).
function readSkill(entry, own) {
  if (!record(entry)) return null;
  const name = line(entry.name, 60);
  const stat = entry.stat === 'luk' ? 'wis' : entry.stat;
  const hasStat = entry.stat !== undefined && entry.stat !== null;
  if (!name || (hasStat && !STAT_KEYS.includes(stat)) || !whole(entry.rank, 0, FILE_LIMITS.rank)) return null;
  const extra = own.get(key(name));
  const type = OWN_TYPES.includes(extra?.type) ? extra.type : entry.type === undefined ? 'attack' : TYPE_OF[entry.type] ?? 'utility';
  const cost = extra && (extra.cost?.pool === 'mp' || extra.cost?.pool === 'sp') && whole(extra.cost.n, 1, RULES.costMax) ? { pool: extra.cost.pool, n: extra.cost.n } : null;
  return { name, about: line(entry.about, 160), ...(hasStat ? { stat } : {}), type, rank: entry.rank, ...(cost ? { cost } : {}) };
}

function readItem(entry) {
  if (!record(entry)) return null;
  const name = line(entry.name, FILE_LIMITS.itemName);
  if (!name || !whole(entry.qty, 1, FILE_LIMITS.qty)) return null;
  const note = line(entry.note, FILE_LIMITS.itemNote), kind = line(entry.kind, 20), rarity = line(entry.rarity, 20), slot = line(entry.slot, 20);
  const given = record(entry.stats) ? Object.entries(entry.stats) : [];
  const stats = given.length && given.length <= 4 && given.every(([stat, value]) => /^[a-z]{2,10}$/.test(stat) && whole(value, 1, 6)) ? Object.fromEntries(given) : null;
  return { name, qty: entry.qty, ...(note ? { note } : {}), ...(kind ? { kind } : {}), ...(rarity ? { rarity } : {}), ...(slot ? { slot } : {}), ...(stats ? { stats } : {}), ...(whole(entry.carry, 1, FILE_LIMITS.carry) ? { carry: entry.carry } : {}) };
}

/**
 * Reads a file's text. → `{ ok: true, file }`, `file` = { level, points, stats (each held to 5..15), held (the stats that were), skills: [{ name, about, stat?, type, rank, cost? }], items?, money?, xp? (the file's own Text RPG xp), extras (true when the file has Text RPG's own `textRpg` part) }, or `{ ok: false, message }`.
 */
export function parseCharacterFile(text) {
  try {
    if (typeof text !== 'string' || !text.trim()) return bad(W.file.empty);
    if (new TextEncoder().encode(text).length > FILE_LIMITS.bytes) return bad(W.file.tooBig);
    let data;
    try { data = JSON.parse(text); } catch { return bad(W.file.notJson); }
    if (!record(data) || !Object.hasOwn(data, CHAR_FILE)) return bad(W.file.notCharacter);
    if (data[CHAR_FILE] !== CHAR_VERSION) return bad(W.file.version);
    // (a file made before levels has only the Soul Class, which stands for the level 10n - 5)
    const level = data.level !== undefined ? data.level : whole(data.soul, 1, 9) ? Math.max(1, 10 * data.soul - 5) : null;
    if (!whole(level, ...FILE_LIMITS.level)) return bad(W.file.level);
    if (!whole(data.points, 0, FILE_LIMITS.points)) return bad(fill(W.file.points, { max: FILE_LIMITS.points }));
    if (!record(data.stats)) return bad(W.file.stats);
    const stats = {}, held = [];
    for (const stat of STAT_KEYS) {
      const value = whole(data.stats[stat], ...FILE_LIMITS.stat) || stat !== 'wis' || Object.hasOwn(data.stats, 'wis') ? data.stats[stat] : data.stats.luk;
      if (!whole(value, ...FILE_LIMITS.stat)) return bad(fill(W.file.stat, { stat: stat.toUpperCase() }));
      stats[stat] = Math.min(RULES.importMax, Math.max(RULES.min, value));
      if (stats[stat] !== value) held.push(stat);
    }
    const rawSkills = data.skills ?? [];
    if (!Array.isArray(rawSkills) || rawSkills.length > FILE_LIMITS.skills) return bad(fill(W.file.skills, { max: FILE_LIMITS.skills }));
    const own = new Map((record(data.textRpg) && Array.isArray(data.textRpg.skills) ? data.textRpg.skills : []).filter(record).map(entry => [key(entry.name), entry]));
    const skills = [];
    for (const [at, entry] of rawSkills.entries()) {
      const skill = readSkill(entry, own);
      if (!skill) return bad(fill(W.file.skill, { n: at + 1 }));
      skills.push(skill);
    }
    const file = { level, points: data.points, stats, held, skills, extras: record(data.textRpg), ...(record(data.textRpg) && whole(data.textRpg.xp, 0, 9999) ? { xp: data.textRpg.xp } : {}) };
    if (data.items !== undefined) {
      if (!Array.isArray(data.items) || data.items.length > FILE_LIMITS.items) return bad(fill(W.file.items, { max: FILE_LIMITS.items }));
      file.items = [];
      for (const [at, entry] of data.items.entries()) {
        const item = readItem(entry);
        if (!item) return bad(fill(W.file.item, { n: at + 1, max: FILE_LIMITS.qty }));
        file.items.push(item);
      }
    }
    if (data.money !== undefined) {
      if (!whole(data.money, 0, FILE_LIMITS.money)) return bad(W.file.money);
      file.money = data.money;
    }
    return { ok: true, file };
  } catch {
    return bad(W.file.notJson);
  }
}
