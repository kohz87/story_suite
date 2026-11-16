// Builds the two "Right now" cards: Needs you (actions only) and Today (focus, trip, due soon, torn gear).
import { h } from '../../kit/dom.js';
import { glyph } from '../../kit/glyphs.js';

const GO_LABEL = Object.freeze({ fight: 'Fight ›', party: 'Party ›', world: 'Map ›', bag: 'Bag ›' });
const NEED_GLYPH = Object.freeze({ fight: 'fight', overdue: '!', points: '+' });

function asRow(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') return { title: value, detail: null };
  return value.title ? value : null;
}

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

function todayRows(today, ctx) {
  const rows = [];
  const focus = asRow(today.focus);
  if (focus) rows.push(row({ icon: '◆', tone: 'focus', title: focus.title, detail: focus.detail, go: focus.go ?? 'journal' }, ctx));
  if (today.trip) {
    const t = today.trip;
    rows.push(row({
      icon: 'road',
      tone: `trip-${t.state}`,
      title: t.title ?? 'Trip',
      detail: t.detail,
      go: t.go ?? 'world',
      progressPct: t.progressPct ?? undefined,
    }, ctx));
  }
  const due = Array.isArray(today.dueSoon) ? today.dueSoon : [today.dueSoon];
  for (const item of due.map(asRow).filter(Boolean)) {
    rows.push(row({ icon: '✉', tone: 'dueitem', title: item.title, detail: item.detail, go: item.go ?? 'journal' }, ctx));
  }
  for (const torn of today.torn ?? []) {
    rows.push(row({
      icon: '⛨',
      tone: 'torn',
      title: `${torn.name} torn`,
      detail: torn.detail,
      go: 'bag',
    }, ctx));
  }
  return rows;
}

/** Returns the Needs you and Today cards; an empty card is left out, so the result may have 0, 1 or 2 elements. */
export function rightNow(now = {}, ctx = {}) {
  const needs = Array.isArray(now.needsYou) ? now.needsYou : [];
  const todayList = now.today ? todayRows(now.today, ctx) : [];
  const out = [];
  if (needs.length) out.push(card('Needs you', needs.length, needsRows(needs, ctx), 'needs'));
  if (todayList.length) out.push(card('Today', 0, todayList, 'today'));
  return out;
}
