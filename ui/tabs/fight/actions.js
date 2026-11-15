// Builds the acting member's panel (resources, stance switch, action tiles by kind, Back, Auto, Discard) and the after-exchange panel.
import { h } from '../../kit/dom.js';
import { button, toggle } from '../../kit/controls.js';

const KINDS = ['Attack', 'Magic', 'Item', 'Flee'];
const oddsClass = word => (word === 'long shot' ? 'long' : word ?? '');

function resource(label, value, max, color) {
  const pct = max > 0 ? Math.round((Math.max(0, value) / max) * 100) : 0;
  return h('div', null, h('span', null, `${label} `, h('b', null, `${value}/${max}`)),
    h('i', null, h('b', { style: { width: `${pct}%`, background: `var(${color})` } })));
}

function stanceRow(stance, actorId, onStance) {
  if (!stance) return null;
  const note = stance.on
    ? `Defence stance: soak ${stance.soakOff}% + ${stance.soakOn - stance.soakOff}% · 1 Stamina each exchange, paid at its start${stance.paid ? ` (this one: ${stance.paid[0]} → ${stance.paid[1]})` : ''}; off when Stamina runs out`
    : `Off: soak ${stance.soakOff}%. This exchange is already paid; no cost from the next one.`;
  return h('div', { class: 'stance' },
    h('span', { class: 't' }, stance.name, stance.on ? h('span', { class: 'now' }, `now: soak ${stance.soakOn}%`) : null, h('small', null, note)),
    toggle({ checked: stance.on, label: stance.name, dataset: { stance: actorId }, onChange: on => onStance?.(on) }));
}

function tile(action, index, sel, onPick) {
  const info = action.damage ?? action.odds ?? '';
  return h(
    'button',
    {
      type: 'button',
      class: ['at', action.target === 'group' ? 'area' : null, action.enabled ? null : 'no', sel === action.id ? 'sel' : null],
      disabled: !action.enabled,
      'aria-keyshortcuts': String(index),
      dataset: { act: action.id, tk: action.target, key: index },
      onClick: () => onPick?.(action),
    },
    h('b', null, action.label),
    h('small', null, action.enabled ? action.cost : `${action.cost} · not enough`),
    h('span', { class: ['odds', action.damage ? null : oddsClass(action.odds)] }, info),
  );
}

function groupRows(groups, sel, onPick) {
  let n = 0;
  const block = kind => {
    const list = Array.isArray(groups?.[kind]) ? groups[kind] : [];
    if (!list.length) return null;
    return h('div', null, h('div', { class: 'agrp' }, kind), h('div', { class: 'atiles' }, list.map(a => { n += 1; return tile(a, n, sel, onPick); })));
  };
  const [first, second, ...rest] = KINDS.map(block);
  return [first, second, h('div', { class: 'agpair' }, rest)];
}

/** Presses the nth enabled tile (keys 1-9) inside the panel; returns true when one was pressed. */
function pressKey(root, key) {
  if (!/^[1-9]$/.test(key)) return false;
  const tileEl = root.querySelector(`[data-key="${key}"]`);
  if (!tileEl || tileEl.hasAttribute('disabled')) return false;
  tileEl.click();
  return true;
}

/**
 * Builds the actions card for `actor` (a fight view-model's actor) and its party entry `member`.
 * Options: `sel` (picked action id), `party`, `onPick(action)`, `onStance(on)`, `onBack()`, `onAuto()`, `onDiscard()`.
 */
export function actionsCard(actor, member, { sel = '', party = [], onPick, onStance, onBack, onAuto, onDiscard } = {}) {
  if (!actor || !member) return null;
  const others = party.filter(p => p.id !== actor.id && p.chosen).map(p => p.name);
  const root = h(
    'section',
    { class: 'card glass actp actions-card', dataset: { card: 'actions', actor: actor.id }, onKeydown: e => { if (pressKey(root, e.key)) e.preventDefault?.(); } },
    h('div', { class: 'ah' }, h('b', null, `${member.name}: choose an action`),
      h('small', null, `${party.findIndex(p => p.id === actor.id) + 1} of ${party.length}`)),
    others.length ? h('span', { class: 'chose' }, `${others.join(', ').replace(/, ([^,]*)$/, ' and $1')} ${others.length === 1 ? 'has' : 'have'} chosen.`) : null,
    h('div', { class: 'res2' }, resource('Mana', member.mp, member.mpMax, '--su-mp'), resource('Stamina', member.sp, member.spMax, '--su-sp')),
    stanceRow(actor.stance, actor.id, onStance),
    groupRows(actor.groups, sel, onPick),
    h('div', { class: 'fbtns' },
      button({ label: 'Back', dataset: { back: '1' }, onClick: onBack }),
      button({ label: 'Auto', dataset: { auto: '1' }, onClick: onAuto }),
      h('span', { style: 'flex:1' }),
      button({ label: 'Discard fight', tone: 'danger', dataset: { discard: '1' }, onClick: onDiscard })),
  );
  return root;
}

/** Builds the card shown once an exchange has resolved: what happened in one line and the next-exchange button. */
export function afterCard({ exchange = 1, note = '', onNext, onAuto } = {}) {
  return h(
    'section',
    { class: 'card glass actp after-card', dataset: { card: 'after' } },
    h('div', { class: 'ah' }, h('b', null, `Exchange ${exchange} resolved`)),
    note ? h('p', { class: 'anote' }, note) : null,
    h('div', { class: 'fbtns' },
      button({ label: `Choose exchange ${exchange + 1}`, tone: 'primary', dataset: { next: '1' }, onClick: onNext }),
      button({ label: 'Auto', dataset: { auto: '1' }, onClick: onAuto })),
  );
}
