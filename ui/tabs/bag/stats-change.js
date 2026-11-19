// A held gear piece's Stats row and its Change: the picker on the piece's own points, sent as the engine's repoint edit (inventory.edit { stack, stats }).
import { h } from '../../kit/dom.js';
import { statsPicker, statsLine } from './gear-stats.js';

const note = () => h('p', { class: 'fine err gst-why', role: 'alert', hidden: true });
const say = (line, text) => {
  line.textContent = text;
  if (text) line.removeAttribute('hidden');
  else line.setAttribute('hidden', '');
};

/** The Stats words for a piece: its points as "+1 DEX · +1 AGI", else gear.view's bonus text, else "None". */
export const statsText = item => statsLine(item?.repoint?.stats) || item?.bonus || 'None';

/**
 * Change for a piece that has no points to move (a cast member's piece, Gear in fights off, a budget of 0): the edit is sent with no stats so the engine's
 * own refusal comes back (every such case is refused before anything is read or changed) and shows in `line`.
 */
async function askEngine(item, port, line) {
  const result = await port?.command('inventory.edit', { stack: item.stack, stats: {} });
  say(line, result && result.ok === false ? result.message || 'The engine could not do that.' : '');
  return result;
}

/**
 * The Stats row of an item sheet (Bag or the Party slot sheet): [dt, dd] with the words and Change, plus the note line the refusal shows in.
 * `open()` swaps the sheet's body for the picker (`changeView`); a piece with no `repoint` asks the engine and shows its reason instead.
 */
export function statsRow(item, { port, open, dt = 'dt', dd = 'dd' } = {}) {
  const line = note();
  const change = h('button', { type: 'button', class: 'btn2 gst-change', dataset: { change: 'stats' }, onClick: () => (item.repoint ? open?.() : askEngine(item, port, line)) }, 'Change');
  return { cells: [h(dt, null, 'Stats'), h(dd, null, h('span', { class: 'gst-line' }, statsText(item)), change)], line };
}

/** The Change view: the picker on the piece's budget, "n of N points", the note line, Save (only with every point placed) and Cancel. `onDone()` after the engine took it. */
export function changeView(item, { port, onDone, onCancel } = {}) {
  const budget = item.repoint?.budget ?? 0;
  const line = note();
  const save = h('button', { type: 'button', class: 'ps-b pri', dataset: { save: 'stats' }, onClick: () => send() }, 'Save');
  const picker = statsPicker({ budget, stats: item.repoint?.stats ?? {}, onChange: () => { save.disabled = !picker.full(); } });
  save.disabled = !picker.full();
  let busy = false;
  async function send() {
    if (busy) return;
    if (!picker.full()) { say(line, `Place all ${budget} point${budget === 1 ? '' : 's'}.`); return; }
    busy = true;
    try {
      const result = await port?.command('inventory.edit', { stack: item.stack, stats: picker.value() });
      if (result && result.ok === false) say(line, result.message || 'The engine could not do that.');
      else onDone?.(result);
    } finally {
      busy = false;
    }
  }
  return h('div', { class: 'gst-change-view', dataset: { form: 'item-stats' } },
    h('div', { class: 'secl' }, `${item.name} · Stats`),
    picker.el,
    h('p', { class: 'fine' }, 'Move the points between stats; the total stays.'),
    line,
    h('div', { class: 'ps-row' },
      h('button', { type: 'button', class: 'ps-b', dataset: { cancel: 'stats' }, onClick: () => onCancel?.() }, 'Cancel'),
      save));
}
