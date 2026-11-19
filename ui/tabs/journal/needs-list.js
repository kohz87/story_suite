// Builds the Needs you list at the top of the Journal tab: what asks for the reader (a fight, overdue items, points to spend, a joiner); its length is the red count on the Journal tab.
import { h } from '../../kit/dom.js';
import { glyph } from '../../kit/glyphs.js';

const GO_LABEL = Object.freeze({ fight: 'Fight ›', party: 'Party ›', world: 'Map ›', bag: 'Bag ›', people: 'People ›' });
const NEED_GLYPH = Object.freeze({ fight: 'fight', overdue: '!', points: '+', join: '+' });

function row({ icon, tone, title, detail, go, progressPct }, ctx) {
  const body = h(
    'span',
    { class: 'rnr-text' },
    h('b', null, title),
    detail ? h('small', null, detail) : null,
    typeof progressPct === 'number'
      ? h('span', { class: 'lp' }, h('b', { style: { width: `${Math.max(0, Math.min(100, progressPct))}%` } }))
      : null,
  );
  const lead = h('span', { class: 'ti' }, icon && icon.length === 1 ? icon : (icon ? glyph(icon) : null));
  if (!go) return h('div', { class: ['rnr', tone] }, lead, body);
  return h(
    'button',
    { type: 'button', class: ['rnr', tone], dataset: { go }, onClick: () => ctx.go?.(go) },
    lead,
    body,
    h('span', { class: 'go' }, GO_LABEL[go] ?? '›'),
  );
}

function needsRows(needsYou, ctx) {
  // (overdue items are listed right below on this tab: that row says so and is not a button)
  return needsYou.map(n => row({
    icon: NEED_GLYPH[n.kind] ?? 'info',
    tone: `need-${n.kind}`,
    title: n.title,
    detail: n.detail,
    go: n.go === 'journal' ? null : n.go,
  }, ctx));
}

/** Returns the Needs you list, or null when nothing asks for the reader; ctx = { go(tab) }. */
export function needsList(needsYou = [], ctx = {}) {
  if (!Array.isArray(needsYou) || !needsYou.length) return null;
  return h(
    'section',
    { class: 'card glass su-needs', dataset: { card: 'needs' } },
    h('div', { class: 'ch' }, h('h3', null, 'Needs you'), h('span', { class: 'cnt' }, String(needsYou.length))),
    h('div', { class: 'rn2' }, needsRows(needsYou, ctx)),
  );
}
