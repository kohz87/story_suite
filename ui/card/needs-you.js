// Builds the Needs you card under the character card on every tab: what asks for the reader (a fight, overdue items, points to spend, a joiner) and the card's pack offers.
import { h } from '../kit/dom.js';
import { glyph } from '../kit/glyphs.js';
import { offerBlocks } from './card-offer.js';

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

function card(title, count, rows, kind) {
  return h(
    'section',
    { class: 'card glass now-o1', dataset: { card: kind } },
    h('div', { class: 'ch' }, h('h3', null, title), count ? h('span', { class: 'cnt' }, String(count)) : null),
    h('div', { class: 'rn2' }, rows),
  );
}

function needsRows(needsYou, ctx) {
  return needsYou.map(n => row({
    icon: NEED_GLYPH[n.kind] ?? 'info',
    tone: `need-${n.kind}`,
    title: n.title,
    detail: n.detail,
    go: n.go,
  }, ctx));
}

/** Returns the Needs you card, or null when nothing needs the reader and the card offers nothing; ctx = { go(tab), port }. */
export function needsYou(now = {}, ctx = {}) {
  const needs = Array.isArray(now.needsYou) ? now.needsYou : [];
  const offers = Array.isArray(now.offers) ? now.offers : [];
  if (!needs.length && !offers.length) return null;
  const waiting = offers.filter(o => o.state === 'offer' || o.state === 'working').length;
  return card('Needs you', needs.length + waiting, [needsRows(needs, ctx), offerBlocks(offers, ctx)], 'needs');
}
