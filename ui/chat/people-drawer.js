// Builds the people drawer above the message box: a "Here" header and one page of feelings-ring cards.
import { h, svgEl } from '../kit/dom.js';

const METERS = [['trust', '#5aa0ff', 'Trust'], ['affection', '#ff7aa8', 'Affection'], ['desire', '#c08aff', 'Desire'], ['tension', '#f0b84a', 'Tension']];

function point(r, deg) {
  const a = (deg * Math.PI) / 180;
  return [(50 + r * Math.sin(a)).toFixed(2), (50 - r * Math.cos(a)).toFixed(2)];
}

function arc(r, a0, a1) {
  const [x0, y0] = point(r, a0);
  const [x1, y1] = point(r, a1);
  return `M${x0} ${y0}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

function ring(meters) {
  const w = 6;
  const r = 50 - w / 2 - 1;
  const kids = [svgEl('circle', { cx: 50, cy: 50, r, fill: 'none', stroke: 'var(--SmartThemeBorderColor)', 'stroke-width': w })];
  METERS.forEach(([key, color], q) => {
    const v = Math.max(0, Math.min(100, Number(meters?.[key]) || 0));
    if (!v) return;
    const z = q * 90;
    kids.push(svgEl('path', { d: arc(r, z + 4, z + 4 + (82 * v) / 100), fill: 'none', stroke: color, 'stroke-width': w, 'stroke-linecap': 'round' }));
  });
  return svgEl('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true' }, kids);
}

function safeUrl(src) {
  return typeof src === 'string' && src && !/["'()\\\s]/.test(src) ? src : null;
}

function face(person, cls) {
  const url = safeUrl(person.portrait);
  const el = h('span', { class: cls }, url ? null : (person.name || '?').slice(0, 1));
  if (url) el.style.setProperty('background-image', `url("${url}")`);
  return el;
}

function meterLabel(m) {
  return METERS.map(([key, , label]) => `${label} ${Number(m?.[key]) || 0}`).join(', ');
}

function card(person, on) {
  const where = String(person.where || '').slice(0, 40);
  const label = `${person.name}, ${person.mood || ''}${where ? `, ${where}` : ''}. Open dossier`;
  const go = () => on.onOpenPerson?.(person.personId);
  return h(
    'div',
    {
      class: 'pc2', role: 'button', tabindex: '0', title: `Open ${person.name}’s dossier`, 'aria-label': label,
      onClick: go,
      onKeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault?.(); go(); } },
    },
    h('span', { class: 'rg2', role: 'img', 'aria-label': `Feelings: ${meterLabel(person.meters)}` }, ring(person.meters), face(person, 'ph')),
    person.mood ? h('span', { class: 'md3' }, person.mood) : null,
    h('b', person.name),
    where ? h('span', { class: 'wh3' }, where) : null,
    person.thought ? h('div', { class: 'th4' }, h('span', person.thought)) : null,
  );
}

function arrow(dir, label, disabled, on, pages, page) {
  return h('button', {
    type: 'button', class: 'arr', disabled: disabled ? true : null, 'aria-label': label,
    onClick: () => on.onPage?.(Math.max(0, Math.min(pages - 1, page + dir))),
  }, dir < 0 ? '‹' : '›');
}

/** Builds the drawer from the drawer rows (null when nobody is here); opts: folded, page, perPage, onToggle, onPage(page), onOpenPerson(id). */
export function peopleDrawer(rows, opts = {}) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return null;
  const per = Math.max(1, Number(opts.perPage) || 2);
  const pages = Math.ceil(list.length / per);
  const page = Math.max(0, Math.min(pages - 1, Number(opts.page) || 0));
  const folded = Boolean(opts.folded);
  let startX = NaN;
  const header = h(
    'button',
    { type: 'button', class: 'dhd', 'aria-expanded': String(!folded), onClick: () => opts.onToggle?.(!folded) },
    h('b', `Here · ${list.length}`),
    h('span', { class: 'mini' }, list.map(p => face(p, 'mface'))),
    !folded && pages > 1 ? h('span', { class: 'dots2' }, Array.from({ length: pages }, (_, i) => h('i', { class: i === page ? 'on' : null }))) : null,
    h('span', { class: 'chev', 'aria-hidden': 'true' }, folded ? '▴' : '▾'),
  );
  const body = folded ? null : h(
    'div',
    { class: 'dbody2' },
    arrow(-1, 'Previous', page === 0, opts, pages, page),
    h('div', { class: 'pcrow', style: { '--per': String(per) }, onTouchstart: e => { startX = e.changedTouches?.[0]?.clientX; }, onTouchend: e => {
      const t = e.changedTouches?.[0];
      if (t && Number.isFinite(startX) && Math.abs(t.clientX - startX) > 40) opts.onPage?.(Math.max(0, Math.min(pages - 1, page + (t.clientX < startX ? 1 : -1))));
    } }, list.slice(page * per, page * per + per).map(p => card(p, opts))),
    arrow(1, 'Next', page >= pages - 1, opts, pages, page),
  );
  return h('div', { class: 'ssdrawer', dataset: { ssDrawer: '1', page: String(page) } }, header, body);
}
