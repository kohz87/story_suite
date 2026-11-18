// Builds the Settings overlay frame: header, section nav, the section or search page, the "what's sent" footer, and its back-stack entry.
import { h, clear } from '../kit/dom.js';
import { createNav } from './nav.js';
import { createPages } from './page.js';
import { searchRows, renderSearchResults } from './search.js';
import { foldGroups, foldStore } from './fold-groups.js';
import { tabTrap } from '../kit/trap.js';

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
 * `renderSection(section, ctx)` (returns the body nodes, or null for the default rows; `ctx.body(section)` gives the default body, the page adds heading, note and resets), `onChange(key, value, row)`,
 * `onAction(key, label, row)`, `onClose`, `prefs` (folded cards kept per device: getFold/setFold). Returns `{ el, open(id?), close(), show(id), setQuery(text), isOpen, destroy }`.
 */
export function createSettingsOverlay(options = {}) {
  const { doc = globalThis.document, host = doc.body, settings = {}, backStack = null } = options;
  const subtitle = settings.subtitle ?? options.subtitle ?? '';
  const sent = options.sent ?? settings.sent ?? null;
  const { renderSection = null, onClose, onView = null } = options;
  const folds = foldStore(options.prefs);
  let sections = settings.sections ?? [];
  // A module switch, a preset or Reset to Standard can turn a page's module on or off (the RPG page goes with the RPG): the side list is read again after them.
  const modulesKey = key => /^modules\./.test(String(key ?? ''));
  // Any other change re-reads the open page, which redraws only when another row moved with it (a Portraits style brings its own text).
  const after = (answer, key) => {
    const read = () => (modulesKey(key) ? refreshSections() : refreshRows(key));
    if (typeof answer?.then === 'function') answer.then(read, () => {}); else read();
    return answer;
  };
  const onChange = (key, ...rest) => after(options.onChange?.(key, ...rest), key);
  const onAction = (key, ...rest) => after(options.onAction?.(key, ...rest), key);
  const ctx = { doc, settings, onChange, onAction, view: onView, backStack, go: id => show(id), has: id => sections.some(s => s.id === id) };

  let current = sections[0]?.id ?? null;
  let query = '';
  let page = 'list';
  let isOpen = false;
  let release = null;
  let destroyed = false;
  let opener = null;   // what had the focus before Settings opened: it gets it back on close
  let stilled = [];    // what Settings made inert behind it (nothing that was inert already)

  const makeNav = () => createNav(sections, {
    onPick: (id, via) => { query = ''; nav.setQuery(''); if (via === 'list') page = 'section'; show(id); },
    onQuery: (text) => { query = text.trim(); nav.setQuery(text); paint(); },
  });
  let nav = makeNav();
  const main = h('div', { class: 'spage' });
  const scroller = h('div', { class: 'smain' }, nav.list, main);
  const body = h('div', { class: 'sbody', dataset: { page: 'list' } }, nav.side, scroller);
  const closeBtn = h('button', { type: 'button', class: 'ibtn x', 'aria-label': 'Close settings', onClick: () => close() }, '×');
  const parts = [
    h('div', { class: 'shd' }, h('span', { class: 'ttl' }, h('b', 'Story Suite · Settings'), subtitle ? h('small', subtitle) : null), closeBtn),
    body,
    sent ? footerBar(sent, () => { query = ''; nav.setQuery(''); page = 'section'; show('tools'); }) : null,
  ];
  const el = h('div', { class: 'sov', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Story Suite settings', hidden: true },
    h('div', { class: 'glass' }, parts));
  host.appendChild(el);
  // Settings is a modal window: Tab stays inside it, the page behind is inert while it is open, and the × takes the focus (the suite's own sheets work the same way).
  el.addEventListener('keydown', tabTrap(el, { doc, isOn: () => isOpen }));
  const stillBehind = () => { stilled = [...(host.children ?? [])].filter(n => n !== el && !n.hasAttribute?.('inert')); for (const n of stilled) n.setAttribute('inert', ''); };
  const wakeBehind = () => { for (const n of stilled) n.removeAttribute('inert'); stilled = []; };

  function backButton() {
    return h('button', { type: 'button', class: 'btn2 sback', onClick: () => { page = 'list'; query = ''; nav.setQuery(''); paint(); scroller.scrollTop = 0; } }, '‹ Settings');
  }

  const pages = createPages(settings, { ...ctx, repaint: () => paint() });
  ctx.body = section => pages.body(section);
  const sectionPage = section => pages.page(section, renderSection ? renderSection(section, ctx) : null);

  function paint() {
    clear(main);
    const showSearch = query !== '';
    const section = sections.find(s => s.id === current);
    body.setAttribute('data-page', showSearch || page === 'section' ? 'section' : 'list');
    nav.setCurrent(showSearch ? null : current);
    main.appendChild(backButton());
    if (showSearch) main.appendChild(renderSearchResults(searchRows(sections, query), query, ctx));
    else if (section) { for (const node of sectionPage(section)) main.appendChild(node); foldGroups(main, section.id, folds); }
  }

  // The pages the host lists now: a page that came back is added, one that went is taken out of the lists and search (the open page moves to Start).
  function refreshSections() {
    const fresh = onView?.('settings')?.sections;
    if (!Array.isArray(fresh) || fresh.map(s => s.id).join() === sections.map(s => s.id).join()) return;
    sections = fresh.map(s => sections.find(old => old.id === s.id) ?? s);
    const next = makeNav();
    for (const part of ['side', 'list']) { nav[part].before(next[part]); nav[part].remove(); }
    nav = next;
    nav.setQuery(query);
    if (!sections.some(s => s.id === current)) current = sections[0]?.id ?? null;
    paint();
  }

  function refreshRows(key) {
    const section = sections.find(s => s.id === current);
    const fresh = section && onView?.('settings')?.sections?.find(s => s.id === section.id);
    const others = rows => JSON.stringify((rows ?? []).filter(r => r.key !== key));
    if (!fresh || others(fresh.rows) === others(section.rows)) return;
    // (in place: the Packs page writes a new pick's Start rows into the same section object, so the overlay and the page keep one copy)
    section.rows = fresh.rows;
    paint();
  }

  // Another page (a side or list pick, a link on a page, the footer) opens at its top: the page scroller kept the last page's place.
  function show(id) {
    if (!sections.some(s => s.id === id)) return false;
    current = id;
    query = '';
    nav.setQuery('');
    paint();
    scroller.scrollTop = 0;
    return true;
  }

  function back() {
    // An editor that is open on the page (Prompts › Read and edit) closes first: Escape does not take the whole window with it.
    const editor = main.querySelector?.('[data-dismiss]');
    if (editor) { editor.click(); return false; }
    if (page === 'section' || query !== '') {
      page = 'list';
      query = '';
      nav.setQuery('');
      paint();
      scroller.scrollTop = 0;
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
    opener = doc.activeElement ?? null;
    el.removeAttribute('hidden');
    stillBehind();
    closeBtn.focus?.();
    if (backStack) release = backStack.push({ id: 'settings', layer: 'settings', close: () => (back() ? close(true) : false) });
    return true;
  }

  function close(fromStack = false) {
    if (destroyed || !isOpen) return false;
    isOpen = false;
    el.setAttribute('hidden', '');
    wakeBehind();
    const active = doc.activeElement ?? null;
    // (focus goes back to the opener only when it was in Settings or nowhere: a window opened over it keeps it)
    if (!active || active === doc.body || el.contains?.(active) === true) opener?.focus?.();
    opener = null;
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
