// Builds the Purse card (coins, this turn's changes, edit money) with the party load bar and its source chips.
import { h } from '../../kit/dom.js';
import { button } from '../../kit/controls.js';

const COIN_COLOUR = { gold: '#e3b341', silver: '#c3c9d6', copper: '#c8784a' };

function loadText(load) {
  const left = load.limit - load.value;
  if (load.level === 'over') return `Over the limit by ${-left}`;
  return `${load.level === 'heavy' ? 'Heavy · ' : ''}${left} left before you slow down`;
}

/** Builds the party load block (bar, 80% marker, heavy and over notes, sources); null when load is null (Story-only). */
export function loadBlock(load) {
  if (!load) return null;
  const pct = Math.min(100, Math.round((load.value / load.limit) * 100));
  const heavyAt = Math.ceil(load.limit * 0.8);
  return h(
    'div',
    { class: ['load', 'rpg', load.level === 'light' ? null : load.level], dataset: { level: load.level } },
    h('div', { class: 'secl' }, 'Party load'),
    h('div', { class: 'lr' }, h('span', { class: 'lt' }, loadText(load)), h('b', null, `${load.value} / ${load.limit}`)),
    h('div', { class: 'lbar' }, h('b', { style: { width: `${pct}%` } }), h('i', { class: 'mk', title: 'Heavy from 80%' })),
    load.level === 'heavy'
      ? h('div', { class: 'hvy' }, `Heavy: past 80% of the limit (${heavyAt}). Nothing slows yet; one more item may.`) : null,
    load.level === 'over'
      ? h('div', { class: 'ovr' }, `Over the limit by ${load.value - load.limit}. Everyone is slowed: −2 to AGI and DEX checks and travel pace −25%. Drop something to get back under.`) : null,
    h('div', { class: 'srcs' }, load.breakdown.map(b => h('span', { class: 'src' }, `${b.label} +${b.value}`))),
  );
}

/** Builds the money editing sheet body; Save sends wallet.set with the three coin counts. */
export function moneySheet(coins, ctx = {}) {
  const inputs = Object.keys(COIN_COLOUR).map(k => h('input', {
    type: 'number', min: '0', value: coins[k], class: 'srch on', 'aria-label': k, dataset: { coin: k },
  }));
  return h(
    'div',
    { class: 'bag-sheet', dataset: { sheet: 'money' } },
    h('div', { class: 'dn' }, 'Edit money'),
    h('div', { class: 'coins' }, inputs.map(i => h('label', { class: 'coin' }, i.dataset.coin, i))),
    h('div', { class: 'brow' }, button({
      label: 'Save', tone: 'primary',
      onClick: () => {
        const next = Object.fromEntries(inputs.map(i => [i.dataset.coin, Math.max(0, Math.floor(Number(i.value)) || 0)]));
        ctx.port?.command('wallet.set', next);
        ctx.close?.();
      },
    })),
  );
}

/** Builds the Purse card from the bag view-model; ctx = { port, openSheet(el, label) }. */
export function purseCard(bag, ctx = {}) {
  const { coins, thisTurn } = bag.purse;
  const edit = button({
    tone: 'icon', label: 'Edit money', className: 'sm', icon: null,
    onClick: () => ctx.openSheet?.(moneySheet(coins, ctx), 'Edit money'),
  });
  edit.textContent = '✎';
  return h(
    'section',
    { class: 'card glass bag-purse', dataset: { card: 'purse' } },
    h('div', { class: 'ch' }, h('h3', null, 'Purse'), edit),
    h('div', { class: 'coins' }, Object.keys(COIN_COLOUR).map(k => h(
      'span', { class: 'coin', dataset: { coin: k } }, h('i', { style: { background: COIN_COLOUR[k] } }), String(coins[k]), h('small', null, k)))),
    thisTurn.length ? h('div', { class: 'last' }, 'This turn: ', thisTurn.map((t, i) => [i ? ' · ' : null, h('b', { class: t.up ? 'up' : null }, t.delta), ` ${t.line}`])) : null,
    loadBlock(bag.load),
  );
}
