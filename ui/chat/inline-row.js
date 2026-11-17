// Builds the quiet inline row under the latest reply: time, place, weather, money, Needs you, Fight, Choices and the Suite link.
import { h } from '../kit/dom.js';

function item(icon, text, extra = {}) {
  return h('span', { class: 'it3', ...extra }, h('i', { 'aria-hidden': 'true' }, icon), text);
}

function suiteButton(row, on) {
  const n = Number(row.changes) || 0;
  const held = Number(row.notApplied) || 0;
  const label = `Story Suite, ${n} change${n === 1 ? '' : 's'} this turn${held ? `, ${held} not applied` : ''}`;
  return h(
    'button',
    { type: 'button', class: 'ssbtn', 'aria-label': label, title: label, onClick: () => on.onOpenSuite?.('now') },
    h('span', { class: 'lb' }, 'Suite'),
    n > 0 ? h('span', { class: 'n' }, String(n)) : null,
    held > 0 ? h('span', { class: 'wd', role: 'img', 'aria-label': 'not applied' }) : null,
  );
}

function needsChip(needs, on) {
  if (!needs || !(needs.n > 0)) return null;
  const title = needs.title || 'Needs your action';
  return h(
    'button',
    { type: 'button', class: 'ssbtn need', title, 'aria-label': title, onClick: () => on.onNeedsYou?.() },
    h('span', { class: 'bang', 'aria-hidden': 'true' }, '!'),
    h('span', { class: 'lb' }, 'Needs you '),
    h('span', { class: 'n' }, String(needs.n)),
  );
}

// The "no changes recorded" badge: the reply came with no change block and nothing was stored for it; the badge is the Re-read button when the page can.
function unrecordedChip(row, on) {
  if (row.unrecorded !== true) return null;
  const title = 'The reply came with no change block, so nothing in it was kept. Add its lines to the reply, then Re-read.';
  const inside = [h('span', { class: 'bang', 'aria-hidden': 'true' }, '!'), h('span', 'No changes recorded' + (on.onReread ? ' — Re-read' : ''))];
  return on.onReread
    ? h('button', { type: 'button', class: 'ssbtn need', title, dataset: { unrecorded: '1' }, onClick: () => on.onReread() }, inside)
    : h('span', { class: 'ssbtn need', role: 'note', title, dataset: { unrecorded: '1' } }, inside);
}

function choicesPart(choices, on) {
  if (!Array.isArray(choices) || !choices.length) return { chip: null, list: null };
  const list = h(
    'ul',
    { class: 'chlist', hidden: true },
    choices.map(text => h('li', { tabindex: '0', role: 'button', onClick: () => on.onChoice?.(String(text)) }, String(text))),
  );
  const chip = h(
    'button',
    {
      type: 'button',
      class: 'ssbtn',
      dataset: { ch: '1' },
      'aria-expanded': 'false',
      'aria-label': `Choices, ${choices.length}`,
      onClick: () => {
        const open = list.hasAttribute('hidden');
        if (open) list.removeAttribute('hidden');
        else list.setAttribute('hidden', '');
        chip.setAttribute('aria-expanded', String(open));
      },
    },
    h('span', { class: 'lb' }, 'Choices '),
    h('span', { class: 'n' }, String(choices.length)),
  );
  return { chip, list };
}

/** Builds the inline row element from the inlineRow view-model; handlers: onOpenSuite(tab), onNeedsYou, onFight, onChoice(text). */
export function inlineRow(row, handlers = {}) {
  const vm = row || {};
  const on = handlers || {};
  const money = vm.money || null;
  const { chip, list } = choicesPart(vm.choices, on);
  const line1 = h(
    'div',
    { class: 'ssl1' },
    item('🕐', [vm.date ? h('span', { class: 'dt' }, `${vm.date} · `) : null, vm.time || '']),
    vm.place ? item('📍', vm.place) : null,
    vm.weather ? item('☁', vm.weather) : null,
  );
  const line2 = h(
    'div',
    { class: 'ssl2' },
    money && money.short
      ? h(
        'span',
        { class: 'it3', title: 'Money', 'aria-label': `Money: ${money.words || money.full || money.short}` },
        h('i', { 'aria-hidden': 'true' }, '◉'),
        h('span', { class: 'mw' }, money.words || money.full || money.short),
        h('span', { class: 'ms', 'aria-hidden': 'true' }, money.short),
      )
      : null,
    h('span', { class: 'gap' }),
    vm.fightOpen
      ? h('button', { type: 'button', class: 'ssbtn fight', 'aria-label': 'Fight open, open the Fight tab', onClick: () => on.onFight?.() }, '⚔ Fight open ›')
      : null,
    needsChip(vm.needsYou, on),
    chip,
    suiteButton(vm, on),
  );
  // (the badge has a line of its own: its words are long, and the phone row hides its chips' labels)
  const unrecorded = unrecordedChip(vm, on);
  return h('div', { class: ['ssrow', vm.fightOpen ? 'fo' : null], dataset: { ssRow: '1' } }, line1, line2, unrecorded ? h('div', { class: 'ssl3' }, unrecorded) : null, list);
}
