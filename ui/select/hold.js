// Turns the waiting fight (the pause before the reader's message goes out, ui/port/hold.js) into the Fight tab's offer view-model: the activity shape with `hold`.

import { FIGHT_KIND } from './interaction.js';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => String(value ?? '').replace(/\s+/gu, ' ').trim();
const whole = value => Math.max(0, Math.trunc(Number(value)) || 0);
// The offer shows a group's members up to this many (a bigger group fights as packs on the board).
const SHOWN = 8;

const barOf = (row, kind) => (Array.isArray(row.bars) ? row.bars : []).find(bar => bar?.kind === kind) ?? null;

function partyOf(sheet) {
  return (Array.isArray(sheet) ? sheet : []).filter(isRecord).map(row => {
    const hp = barOf(row, 'hp'), mp = barOf(row, 'mp'), sp = barOf(row, 'sp');
    return { id: text(row.id) || text(row.name), name: text(row.name), portrait: row.portrait ?? null, hp: whole(hp?.value), hpMax: whole(hp?.max), mp: whole(mp?.value), mpMax: whole(mp?.max), sp: whole(sp?.value), spMax: whole(sp?.max), chosen: null };
  });
}

function groupsOf(foes) {
  return (Array.isArray(foes) ? foes : []).filter(foe => isRecord(foe) && text(foe.name)).map((foe, at) => {
    const name = text(foe.name), count = Math.max(1, whole(foe.count)), hp = Math.max(1, whole(foe.hp));
    const members = Array.from({ length: Math.min(count, SHOWN) }, (_, i) => ({ id: `${at + 1}:${i + 1}`, arg: null, name: count > 1 ? `${name} ${i + 1}` : name, hp, max: hp }));
    return { id: String(at + 1), arg: null, name, tier: text(foe.tier) || null, lv: whole(foe.level) || 1, odds: { word: null }, members };
  });
}

/**
 * The offer view-model for a waiting fight from `info` (the hold's view: { id, kindId, mode, choice, title, sendLabel?, error, foes: [{ name, count, level, tier, hp }] }),
 * `sheet` (`rpg.sheet` rows, for the party) and `place` (the scene's place name). Null when nothing waits, the board was already chosen, or it is not a fight.
 */
export function selectHold(info, { sheet = null, place = null } = {}) {
  if (!isRecord(info) || info.kindId !== FIGHT_KIND || info.choice) return null;
  const working = info.mode === 'working';
  const foeGroups = working ? [] : groupsOf(info.foes);
  if (!working && !foeGroups.length) return null;
  return {
    id: text(info.id) || `hold:${FIGHT_KIND}`, kindId: FIGHT_KIND, title: 'Fight', state: 'open', steps: 0, canSend: false, canDiscard: false,
    hold: { working, count: working ? 0 : (info.foes ?? []).reduce((n, foe) => n + Math.max(1, whole(foe?.count)), 0), plain: !working && Boolean(text(info.sendLabel)), line: working ? text(info.title) : '', error: text(info.error) },
    view: { state: 'offer', title: text(place) ? `Fight · ${text(place)}` : 'Fight', subtitle: null, exchange: 1, foeGroups, party: partyOf(sheet), actors: [], log: [], order: [], end: null },
  };
}
