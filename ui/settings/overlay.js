// Builds the Settings overlay frame: header, section nav, the section or search page, the "what's sent" footer, and its back-stack entry.
import { h, clear } from '../kit/dom.js';
import { createNav } from './nav.js';
import { createPages } from './page.js';
import { searchRows, renderSearchResults } from './search.js';

function footerBar(sent, onGo) {
  const pct = sent.cap > 0 ? Math.min(100, Math.round((sent.used / sent.cap) * 100)) : 0;
  const fmt = n => Number(n).toLocaleString('en-US');
  return h(
    'button',
    { type: 'button', class: 'sfoot', onClick: onGo },
    h('span', '⚖ ', h('span', { class: 'fl3' }, 'What’s sent each reply'), h('span', { class: 'fs3' }, 'Sent')),
    h('span', { class: 'mb2' }, h('b', { style: { width: `${pct}%`, background: 'var(--su-accent)' } })),
    h('b', { class: 'v' }, `${fmt(sent.used)} of ${fmt(sent.cap)} tokens`),
    sent.total !== undefined ? h('span', { class: 'fl3' }, `${fmt(sent.total)} in all`) : null,
    h('span', { style: { 'margin-left': 'auto' } }, '›'),
  );
}

/**
 * Creates the Settings overlay over a `settings` view-model.
 * Options: `doc`, `host`, `settings`, `backStack`, `subtitle`, `sent` ({used, cap, total?}, optional footer meter),
 * `renderSection(section, ctx)` (returns nodes, or null for the default rows), `onChange(key, value, row)`,
 * `onAction(key, label, row)`, `onClose`. Returns `{ el, open(id?), close(), show(id), setQuery(text), isOpen, destroy }`.
 */
export function createSettingsOverlay(options = {}) {
  const { doc = globalThis.document, host = doc.body, settings = {}, backStack = null } = options;
  const subtitle = settings.subtitle ?? options.subtitle ?? '';
  const sent = options.sent ?? settings.sent ?? null;
  const { renderSection = null, onChange, onAction, onClose } = options;
  const sections = settings.sections ?? [];
  const ctx = { doc, settings, onChange, onAction, go: id => show(id) };

  let current = sections[0]?.id ?? null;
  let query = '';
  let page = 'list';
  let isOpen = false;
  let release = null;
  let destroyed = false;

  const nav = createNav(sections, {
    onPick: (id, via) => { query = ''; nav.setQuery(''); if (via === 'list') page = 'section'; show(id); },
    onQuery: (text) => { query = text.trim(); nav.setQuery(text); paint(); },
  });
  const main = h('div', { class: 'spage' });
  const body = h('div', { class: 'sbody', dataset: { page: 'list' } }, nav.side, h('div', { class: 'smain' }, nav.list, main));
  const closeBtn = h('button', { type: 'button', class: 'ibtn x', 'aria-label': 'Close settings', onClick: () => close() }, '×');
  const parts = [
    h('div', { class: 'shd' }, h('span', { class: 'ttl' }, h('b', 'Story Suite · Settings'), subtitle ? h('small', subtitle) : null), closeBtn),
    body,
    sent ? footerBar(sent, () => { query = ''; nav.setQuery(''); page = 'section'; show('tools'); }) : null,
  ];
  const el = h('div', { class: 'sov', role: 'dialog', 'aria-label': 'Story Suite settings', hidden: true },
    h('div', { class: 'glass' }, parts));
  host.appendChild(el);

  function backButton() {
    return h('button', { type: 'button', class: 'btn2 sback', onClick: () => { page = 'list'; query = ''; nav.setQuery(''); paint(); } }, '‹ Settings');
  }

  const pages = createPages(settings, { ...ctx, repaint: () => paint() });
  const sectionPage = section => pages.page(section, renderSection ? renderSection(section, ctx) : null);

  function paint() {
    clear(main);
    const showSearch = query !== '';
    const section = sections.find(s => s.id === current);
    body.setAttribute('data-page', showSearch || page === 'section' ? 'section' : 'list');
    nav.setCurrent(showSearch ? null : current);
    main.appendChild(backButton());
    if (showSearch) main.appendChild(renderSearchResults(searchRows(sections, query), query, ctx));
    else if (section) for (const node of sectionPage(section)) main.appendChild(node);
  }

  function show(id) {
    if (!sections.some(s => s.id === id)) return false;
    current = id;
    query = '';
    nav.setQuery('');
    paint();
    return true;
  }

  function back() {
    if (page === 'section' || query !== '') {
      page = 'list';
      query = '';
      nav.setQuery('');
      paint();
      return false;
    }
    return true;
  }

  function open(id) {
    if (destroyed) return false;
    if (id) show(id);
    if (isOpen) return false;
    isOpen = true;
    page = id ? 'section' : 'list';
    paint();
    el.removeAttribute('hidden');
    if (backStack) release = backStack.push({ id: 'settings', layer: 'settings', close: () => (back() ? close(true) : false) });
    return true;
  }

  function close(fromStack = false) {
    if (destroyed || !isOpen) return false;
    isOpen = false;
    el.setAttribute('hidden', '');
    if (release && !fromStack) release();
    release = null;
    if (typeof onClose === 'function') onClose();
    return true;
  }

  paint();
  return {
    el,
    open,
    close: () => close(),
    show,
    setQuery(text) { query = String(text ?? '').trim(); nav.setQuery(text); paint(); },
    isOpen: () => isOpen,
    destroy() { if (destroyed) return; if (isOpen) close(); destroyed = true; el.remove(); },
  };
}
