// Builds the This reply card: what the reply changed, lines not applied first, five rows then Show all, with Why on held-back lines.
import { h } from '../../kit/dom.js';
import { glyph } from '../../kit/glyphs.js';
import { moreList } from '../../kit/more.js';

function isException(item) {
  return !item.applied || Boolean(item.heldBack);
}

function whyText(item) {
  if (item.heldBack) return `asked ${item.heldBack.asked} · held back: ${item.heldBack.why}`;
  return item.detail ?? 'not applied';
}

function changeRow(item) {
  const exception = isException(item);
  const why = h('div', { class: 'why-text', hidden: true }, whyText(item));
  const whyBtn = exception
    ? h('button', {
        type: 'button',
        class: 'why',
        'aria-expanded': 'false',
        onClick: () => {
          const open = why.hasAttribute('hidden');
          if (open) why.removeAttribute('hidden');
          else why.setAttribute('hidden', '');
          whyBtn.setAttribute('aria-expanded', String(open));
        },
      }, 'Why')
    : null;
  return h(
    'div',
    { class: ['cr', !item.applied ? 'w' : null, item.heldBack ? 'held' : null] },
    h('span', { class: 'ti' }, glyph(item.glyph)),
    h('span', { class: 'crm' },
      h('span', { class: 'crx' }, h('b', null, item.line), item.detail ? h('small', null, item.detail) : null),
      whyBtn,
      exception ? why : null),
  );
}

/** Sorts rows so lines not applied come first; held-back lines are ordinary rows in reply order (decision 38). */
function ordered(items) {
  const rank = it => (!it.applied ? 0 : 1);
  return items.map((it, i) => [it, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([it]) => it);
}

/** Builds the This reply card, or null when the reply changed nothing. */
export function thisTurnCard(thisTurn, ctx = {}) {
  const items = Array.isArray(thisTurn?.items) ? thisTurn.items : [];
  if (!items.length) return null;
  const count = Number.isFinite(thisTurn.count) ? thisTurn.count : items.length;
  const prefs = ctx.prefs;
  return h(
    'section',
    { class: 'card glass now-o3', dataset: { card: 'this-turn' } },
    h('div', { class: 'ch' }, h('h3', null, 'This reply'), h('span', { class: 'cnt' }, `${count} ${count === 1 ? 'change' : 'changes'}`)),
    moreList({
      items: ordered(items),
      render: changeRow,
      limit: 5,
      className: 'clist',
      expanded: Boolean(prefs?.getFold?.('now.turn.all', false)),
      onToggle: open => prefs?.setFold?.('now.turn.all', open),
    }),
  );
}
