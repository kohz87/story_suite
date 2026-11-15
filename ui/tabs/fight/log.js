// Builds the exchange log card: turn order, the latest exchange open with its rolls, earlier ones folded, and what the narrator will be told.
import { h } from '../../kit/dom.js';

const KIND = [[/^DECISIVE/, 'kD'], [/^NO EXTRA/, 'kF'], [/^EXTRA/, 'kT'], [/^UPKEEP/, 'kU'], [/^\d+ ATTACKS/, 'kC'], [/^HIT/, 'kS'], [/^MISS/, 'kX']];

function outcomeKind(outcome) {
  const text = String(outcome ?? '').toUpperCase();
  return KIND.find(([re]) => re.test(text))?.[1] ?? 'kF';
}

function rowEl(row) {
  const kind = outcomeKind(row.outcome);
  return h('div', { class: ['lr', kind === 'kU' ? 'up' : null, kind === 'kC' ? 'lone' : null] },
    h('span', { class: 'who' }, row.who), h('span', null, row.what),
    h('span', { class: ['oc', kind] }, row.outcome), h('span', { class: 'math' }, row.math));
}

/** Builds a fold button and its body; clicking flips `hidden`, `aria-expanded`, and reports the new state. */
function folder(label, small, open, body, onToggle) {
  const content = h('div', { class: 'fold-body', hidden: !open }, body);
  const btn = h('button', { type: 'button', class: 'fold', 'aria-expanded': String(open) }, h('i', null, '›'), label, small ? h('small', null, small) : null);
  btn.addEventListener('click', () => {
    const next = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(next));
    if (next) content.removeAttribute('hidden'); else content.setAttribute('hidden', '');
    onToggle?.(next);
  });
  return [btn, content];
}

function exchange(entry, open) {
  const [btn, body] = folder(`Exchange ${entry.n} `, open ? `${entry.rows.length} rows` : entry.summary, open, h('div', { class: 'lg' }, entry.rows.map(rowEl)));
  return h('div', { class: 'exb', dataset: { exchange: entry.n } }, btn, body);
}

/**
 * Builds the log card from a fight view-model (`log`, `order`, `narratorTold`, `state`). `ctx.prefs` keeps the narrator fold per
 * device. Returns null when there is nothing to show yet.
 */
export function logCard(vm, ctx = {}) {
  const log = Array.isArray(vm?.log) ? vm.log : [];
  if (!log.length) return null;
  const latest = log[log.length - 1];
  const settled = vm.state === 'after' || vm.state === 'end';
  const told = vm.narratorTold ? folder('What the narrator will be told', '', Boolean(ctx.prefs?.getFold?.('fight.told', false)),
    h('p', { class: 'ntold' }, vm.narratorTold), open => ctx.prefs?.setFold?.('fight.told', open)) : null;
  const rolls = vm.bonuses?.length ? folder('Rolls and bonuses', '', Boolean(ctx.prefs?.getFold?.('fight.bonus', false)),
    h('div', { class: 'bon' }, vm.bonuses.map(b => h('span', null, b.label ? h('b', null, b.label) : null, b.text))), open => ctx.prefs?.setFold?.('fight.bonus', open)) : null;
  return h(
    'section',
    { class: 'card glass log-card', 'aria-label': 'Exchange log', dataset: { card: 'log' } },
    vm.order?.length ? h('div', { class: 'order' }, 'Order: ', vm.order.map(name => h('span', null, name))) : null,
    rolls,
    log.slice().reverse().map(entry => exchange(entry, entry === latest && settled)),
    told,
  );
}
