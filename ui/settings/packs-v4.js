// Renders the format 4 half of the Packs page: the World and Game pickers, the suggestion card, the pair's lines, the worlds and games, and the add-on packs.
import { h } from '../kit/dom.js';
import { lorebookRows } from './packs-lorebook.js';

const MARK = { error: ['pairerr', 'Problem', '✕'], warning: ['needbad', 'Warning', '!'], note: ['needok', 'Note', 'i'] };

const tagged = (name, tag) => h('b', name, h('span', { class: 'tg2' }, tag));

function picker(name, hint, pick, onPick) {
  const el = h('select', { class: 'sel2', id: `pk-${name.toLowerCase()}`, 'aria-label': name }, pick.options.map(o => h('option', { value: o.value, selected: o.value === pick.value }, o.label)));
  el.addEventListener('change', () => onPick(el.value));
  return h('div', { class: 'srow' }, h('span', { class: 'lb' }, h('b', name), h('small', hint)), h('span', { class: 'ctl' }, el));
}

/** The note lines under the problems: with no world, the "no world" line; after Keep mine, the suggestion; with nothing at all, that the pair fits. */
function noteLines(v4, kept) {
  if (!v4.world.value) return [{ level: 'note', text: 'No world: the story makes up places and people as it goes.' }];
  const out = v4.lines.slice();
  if (v4.suggest && kept) out.push({ level: 'note', text: `${v4.worldName} suggests ${v4.suggest.game}${v4.suggest.installed ? '' : ' (not installed)'}.` });
  return out.length ? out : [{ level: 'note', text: `${v4.worldName} and ${v4.gameName} fit: nothing is switched off.` }];
}

function linesRow(v4, kept) {
  const lines = noteLines(v4, kept);
  const small = lines.map(({ level, text }) => h('small', h('span', { class: MARK[level][0] }, h('span', { 'aria-label': MARK[level][1] }, MARK[level][2]), ` ${text}`)));
  const playOn = v4.world.value && v4.lines.length ? h('small', 'Play goes on: only these parts are switched off. Each is also listed in Problems.') : null;
  return h('div', { class: 'srow wide' }, h('span', { class: 'lb', role: 'status' }, small, playOn));
}

function suggestCard(v4, { use, keep }) {
  const { suggest } = v4;
  return h('div', { class: ['cfm', 'rec'] }, h('b', `This world suggests ${suggest.game}`),
    h('small', suggest.installed ? `Made for ${v4.worldName}: its calendar, money and rank. Any game works with any world.` : `It is not installed. Import it to use it; ${v4.worldName} plays with any game.`),
    h('span', { class: 'ctl' }, suggest.installed ? h('button', { type: 'button', class: ['btn2', 'pri'], onClick: use }, 'Use it') : null, h('button', { type: 'button', class: 'btn2', onClick: keep }, 'Keep mine')));
}

function removeRows(pack, state, line) {
  const { removing, setRemoving, act } = state;
  const name = pack.name.replace(/ · .*$/, '');
  const remove = h('button', { type: 'button', class: 'btn2 dng', onClick: () => setRemoving(removing === pack.id ? '' : pack.id) }, 'Remove');
  const confirm = removing === pack.id ? h('div', { class: 'cfm' }, h('b', `Remove ${name}?`), h('small', 'Its content leaves the game. Stories already told keep what they used from it.'),
    h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2 dng', onClick: () => { setRemoving(''); act('packs.remove', pack.id); } }, 'Remove'), h('button', { type: 'button', class: 'btn2', onClick: () => setRemoving('') }, 'Keep it'))) : null;
  return [line(pack, remove), confirm, pack.lorebook ? lorebookRows(pack.lorebook, state) : null];
}

/**
 * `v4` = the view-model's format 4 page; `state` = { change(settingKey, on), act(key, value), kept, setKept(bool), removing, setRemoving(id), and the lorebook rows' lorebook, setLorebook, makeLorebook (packs-lorebook.js) };
 * `parts` = { group(title, ...rows), importRow() } from the page. → the groups for the top of the Packs page.
 */
export function renderV4(v4, state, parts) {
  const { change, kept, setKept } = state;
  // A pick is a switch: the chosen pack on, or the one in use off for None and Built-in (the store clears the choice).
  const pick = (kind, id) => { const now = v4[kind].value; if (id) change(`packs.on.${id}`, true); else if (now) change(`packs.on.${now}`, false); };
  const line = (pack, ...ctl) => h('div', { class: 'srow' }, h('span', { class: 'lb' }, tagged(pack.name, pack.tag), h('small', pack.desc), pack.problem ? h('small', pack.problem) : null), h('span', { class: 'ctl' }, ctl));
  const card = v4.suggest && !kept ? suggestCard(v4, { use: () => change(`packs.on.${v4.suggest.id}`, true), keep: () => setKept(true) }) : null;
  const pairGroup = parts.group('World and game',
    picker('World', 'The places, people and events you play in; one at a time', v4.world, id => pick('world', id)),
    picker('Game', 'Calendar, money, weather, rank, your start, names and RPG options. Your own Settings come first', v4.game, id => pick('game', id)),
    card, linesRow(v4, kept));
  const installed = parts.group(`Worlds and games · ${v4.installed.length} installed`, v4.installed.map(pack => removeRows(pack, state, line)), parts.importRow());
  const addOns = v4.addOns.length ? parts.group('Add-on packs · always on', v4.addOns.map(pack => removeRows(pack, state, (p, remove) => line(p, h('span', { class: 'always' }, 'always on'), remove)))) : null;
  return [pairGroup, installed, addOns];
}
