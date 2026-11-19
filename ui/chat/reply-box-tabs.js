// Builds a reply card's tab strip and its open panel: Changes N · Chatter N · Here N · Choices N, only the ones the reply has, in the reader's order.
import { h } from '../kit/dom.js';
import { glyph } from '../kit/glyphs.js';
import { TAB_TEXT } from '../select/reply-tabs.js';
import { hereCard } from './here-card.js';

/** The tabs reply `card` shows, in `order` ([{ id, on }]): [{ id, label, n }], a hidden one and one with nothing left out. */
export function tabsOf(card, order) {
  const counts = { changes: card?.changes?.length, chatter: card?.chatter?.length, here: card?.here?.length, choices: card?.choices?.length };
  return (Array.isArray(order) ? order : []).filter(row => row?.on !== false && Number(counts[row?.id]) > 0).map(row => ({ id: row.id, label: TAB_TEXT[row.id].label, n: counts[row.id] }));
}

// One change line as the ✦ sheet listed it; a held-back one says so, and its Why shows the reason.
function changeRow(row) {
  const held = row.applied === false;
  const why = held && row.detail ? h('span', { class: 'why-x', hidden: true }, row.detail) : null;
  return h(
    'div',
    { class: ['chg', held ? 'na' : null] },
    glyph(row.glyph) ? h('i', { 'aria-hidden': 'true', class: 'gl' }, glyph(row.glyph, { size: 14 })) : null,
    h('span', { class: 'k' }, String(row.line ?? '')),
    !held && row.detail ? h('span', { class: 'w' }, row.detail) : null,
    held ? h('span', { class: 'w' }, 'held back') : null,
    row.assist === true ? h('span', { class: 'w as', title: 'Written by Assist, not by the reply' }, 'Assist') : null,
    why ? h('button', { type: 'button', class: 'why', 'aria-expanded': 'false', onClick: event => {
      const open = why.hasAttribute('hidden');
      if (open) why.removeAttribute('hidden'); else why.setAttribute('hidden', '');
      event.currentTarget?.setAttribute?.('aria-expanded', String(open));
    } }, 'Why') : null,
    why,
  );
}

function panelOf(id, card, on) {
  if (id === 'changes') return card.changes.map(changeRow);
  if (id === 'chatter') {
    // (SillyTavern's Font Awesome quote glyphs, hidden from a screen reader: the <q> already says it is a quote)
    const mark = side => h('i', { class: `fa-solid fa-quote-${side} qm`, 'aria-hidden': 'true' });
    return card.chatter.map(row => h('p', { class: 'ch' }, h('b', `${row.name}:`), ' ', mark('left'), h('q', row.text), mark('right')));
  }
  if (id === 'here') return h('div', { class: 'here' }, card.here.map(person => hereCard(person, on.onOpenPerson)));
  return h('ol', { class: 'chs' }, card.choices.map(text => h('li', null, h('button', { type: 'button', class: 'cho', title: 'Put these words in the message box', onClick: () => on.onChoice?.(String(text)) }, String(text)))));
}

// The soft fade at the strip's right edge while more tabs lie past it.
function watchMore(wrap, strip) {
  const mark = () => { const more = strip.scrollWidth - strip.clientWidth - strip.scrollLeft > 2; wrap.classList?.toggle?.('more', more); };
  strip.addEventListener('scroll', mark);
  globalThis.requestAnimationFrame?.(mark);
}

/**
 * The tabs of reply `card` ({ changes, chatter, here, choices }) → the `.ssrc-tabs` element, or null when it has none. `order` the reader's tab order,
 * `open` the open tab's id (or null), `onTab(id|null)` hears a tap (the open tab's tap shuts it); `on`: onOpenPerson(id, name), onChoice(text).
 */
export function replyBoxTabs(card, { order = [], open = null, onTab = () => {}, on = {} } = {}) {
  const tabs = tabsOf(card, order);
  if (!tabs.length) return null;
  const shown = tabs.some(tab => tab.id === open) ? open : null;
  // (the strip scrolls; its row is a grid of equal columns as wide as the widest tab's words, and at least the strip's width)
  const strip = h('div', { class: 'ts' }, h('div', { class: 'tr', role: 'tablist' }, tabs.map(tab => h(
    'button',
    { type: 'button', role: 'tab', class: ['tb', tab.id === shown ? 'on' : null], 'aria-selected': String(tab.id === shown), dataset: { tab: tab.id }, onClick: () => onTab(tab.id === shown ? null : tab.id) },
    h('span', { class: 'lb' }, tab.label), h('span', { class: 'c' }, String(tab.n)),
  ))));
  const wrap = h('div', { class: ['ssrc-tabs', shown ? null : 'shut'] }, strip, shown ? h('div', { class: 'tp', role: 'tabpanel', dataset: { panel: shown } }, panelOf(shown, card, on || {})) : null);
  watchMore(wrap, strip);
  return wrap;
}
