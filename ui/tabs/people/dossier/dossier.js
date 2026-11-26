// Composes one person's dossier: the top bar, the portrait column, the cards with the opened part (beside them on a desktop window, a page of its own below),
// the Map tab, and the library strip; Escape closes through the back-stack (menu, then the part, then the dossier).
import { h } from '../../../kit/dom.js';
import { tabTrap } from '../../../kit/trap.js';
import { dossierPages, dossierCards } from './cards.js';
import { dossierHero } from './hero.js';
import { dossierBar } from './top-bar.js';
import { dossierPart } from './part.js';
import { dossierLibrary } from './library.js';
import { libraryPeople, chipSets, stepPerson } from './library-sets.js';
import { dossierMapTab } from './map-tab.js';
import { sendFollow } from './follow.js';

export { dossierPages };

/**
 * Builds the dossier for a `dossier` view-model. ctx = { port, prefs, backStack, go(tab, args), onClose(), onPerson(id) (another person is shown in place), origin, youName, you }.
 * Commands: people.follow (the store's Follow flag; the star goes back if the engine refuses), npc.edit (opens NPC State's editor), npc.refresh, npc.portrait, npc.inspect, npc.merge,
 * npc.delete (asks twice; the dossier closes once they are gone), npc.markAlive, npc.memory.add. The library and the Map tab read the port's `dossier` and `people` views.
 * Returns the root element; `root.close()` takes the dossier down from the back-stack too; `root.update(vm)` redraws it from a fresh record.
 */
export function dossierPage(first, ctx = {}) {
  let d = first;
  const state = { page: null, tab: 'dossier', menu: false, sure: false, following: Boolean(d.following), lib: false, libFilter: 'around', libQuery: '', map: {} };
  const cmd = (type, extra = {}) => ctx.port?.command?.(type, { personId: d.id, ...extra });
  let pages = dossierPages(d, ctx.youName);
  const releases = { dossier: null, page: null, menu: null };
  const release = (key) => { releases[key]?.(); releases[key] = null; };
  const hold = (key, layer, close) => { release(key); releases[key] = ctx.backStack?.push({ id: `dossier-${d.id}-${key}`, layer, close }) ?? null; };

  const barSlot = h('div', { class: 'dbar-slot' });
  const noteSlot = h('div', { class: 'fine dnote', role: 'status', 'aria-live': 'polite' });
  const body = h('div', { class: 'dbody' });
  const libSlot = h('div', { class: 'dlib-slot' });
  // (it covers the tabs, so it is modal: Tab stays inside it until it closes)
  const root = h('div', { class: 'dossier dov', role: 'dialog', 'aria-modal': 'true', 'aria-label': `${d.name}’s dossier`, dataset: { personId: d.id } }, barSlot, noteSlot, body, libSlot);
  let shut = false;
  // The port's views are worked out afresh on every read (every person's queries): the strip's people and the map's are read once, and again only after an update.
  const views = { lib: null, people: null };
  const libPeople = () => (views.lib ??= libraryPeople(ctx.port?.view?.('dossier')));
  const peopleView = () => (views.people ??= ctx.port?.view?.('people') ?? {});
  root.addEventListener('keydown', tabTrap(root, { isOn: () => !shut }));

  function closeMenu() { release('menu'); state.menu = false; state.sure = false; keeping(drawBar); }
  function openPage(id) {
    state.page = id;
    state.tab = 'dossier';
    hold('page', 'page', () => { state.page = null; draw(); });
    draw();
    // (beside the cards the column narrows and the cards grow taller: the outlined one is brought back into view)
    root.querySelector?.('.dcard.sel')?.scrollIntoView?.({ block: 'nearest' });
  }
  function closePage() { release('page'); state.page = null; draw(); }
  function close() { shut = true; release('menu'); release('page'); release('dossier'); ctx.onClose?.(); }
  root.close = close;
  // The person changed while the dossier is open (a reply, an Edit save): the same part is drawn again from the fresh record.
  root.update = (next) => {
    if (!next || shut) return;
    d = next;
    views.lib = null; views.people = null;
    pages = dossierPages(d, ctx.youName);
    state.following = Boolean(d.following);
    if (state.page && !pages.some(p => p.id === state.page)) { release('page'); state.page = null; }
    draw();
  };
  // Another person from the library, a tie or the map: shown in place (the strip, its filter and the map's lens stay), on `page` when given.
  function show(id, page = null) {
    const all = ctx.port?.view?.('dossier');
    const next = all?.[id];
    if (!next || shut) return;
    views.lib = libraryPeople(all);
    release('menu'); release('page');
    Object.assign(state, { menu: false, sure: false, page: null, tab: 'dossier', following: Boolean(next.following), map: { ...state.map, sel: null, focus: null } });
    d = next;
    pages = dossierPages(d, ctx.youName);
    root.dataset.personId = d.id;
    root.setAttribute('aria-label', `${d.name}’s dossier`);
    hold('dossier', 'page', downFromStack);
    ctx.onPerson?.(d.id);
    if (page && pages.some(p => p.id === page)) openPage(page); else draw();
  }

  // Refresh runs a model call: the line under the top bar says it is going and then what came of it (the answer's own words).
  function refresh() {
    noteSlot.textContent = `Re-reading the recent story for ${d.name}…`;
    Promise.resolve(cmd('npc.refresh', { name: d.name })).then(
      (result) => { noteSlot.textContent = result?.ok === false ? (result.message ?? 'Refresh did not run.') : (result?.message ?? `Refresh sent for ${d.name}.`); },
      (error) => { noteSlot.textContent = String(error?.message || 'Refresh did not run.'); });
  }
  // Portrait opens a page dialog; a refusal (NPC State off, no NPC State dossier for this person) is shown in the same line as Refresh's.
  function portrait() {
    Promise.resolve(cmd('npc.portrait', { name: d.name })).then(
      (result) => { if (result?.ok === false) noteSlot.textContent = result.message ?? 'Portrait tools did not open.'; },
      (error) => { noteSlot.textContent = String(error?.message || 'Portrait tools did not open.'); });
  }
  // Edit, Delete, Merge and the like: what the engine answers is told under the top bar when it refuses; a deleted person takes the dossier down with them.
  function act(type) {
    Promise.resolve(cmd(type)).then(
      (result) => { if (result?.ok === false) noteSlot.textContent = result.message ?? 'That did not work.'; else if (type === 'npc.delete') close(); },
      (error) => { noteSlot.textContent = String(error?.message || 'That did not work.'); });
  }
  function pick(id) {
    if (id === 'delete' && !state.sure) { state.sure = true; keeping(drawBar); return; }
    if (id === 'refresh') refresh(); else if (id === 'portrait') portrait(); else act(`npc.${id}`);
    closeMenu();
  }

  function drawBar() {
    barSlot.replaceChildren(dossierBar(d, {
      ctx, tab: state.tab, menu: state.menu, sure: state.sure, onPick: pick, onClose: close,
      onTab: (id) => { state.tab = id; if (id === 'map') { release('page'); state.page = null; } draw(); },
      onMenu: () => {
        if (state.menu) { closeMenu(); return; }
        state.menu = true;
        hold('menu', 'menu', () => { state.menu = false; state.sure = false; keeping(drawBar); });
        keeping(drawBar);
      },
    }));
  }

  function follow() {
    const on = !state.following;
    state.following = on;
    Promise.resolve(sendFollow(ctx, d, on)).then(result => { if (result?.ok === false && state.following === on) { state.following = !on; draw(); } });
    draw();
  }

  function drawDossier() {
    const open = pages.find(p => p.id === state.page) ?? null;
    const party = { ...ctx, onAdded: () => { d.partyAdd = null; d.inParty = true; draw(); },
      onEdited: () => { const fresh = ctx.port?.view?.('dossier')?.[d.id]; if (fresh) { d.partyAdd = fresh.partyAdd ?? null; d.inParty = fresh.inParty; } draw(); } };
    // (a browser writes a null child as the text "null": only the parts there are)
    body.replaceChildren(...[
      dossierHero(d, { following: state.following, onFollow: follow, onProfile: () => openPage('profile'), party, profileOpen: open?.id === 'profile' }),
      dossierCards(d, pages, { current: open?.id ?? null, onOpen: openPage }),
      open ? dossierPart(d, pages, open.id, { ctx: { ...ctx, openPerson: id => show(id) }, onBack: closePage, onGo: openPage }) : null].filter(Boolean));
    body.classList.toggle('paged', Boolean(open));
  }

  function drawMap() {
    const vm = peopleView();
    const people = [...(vm.here ?? []).map(p => ({ ...p, here: true })), ...(vm.elsewhere ?? []).map(p => ({ ...p, here: false }))];
    const you = ctx.you ?? ctx.port?.view?.('card')?.you ?? { name: ctx.youName ?? 'You' };
    body.replaceChildren(dossierMapTab(d, {
      people, ties: vm.ties ?? [], you: { ...you, name: you?.name ?? ctx.youName ?? 'You' }, map: state.map,
      onMap: (next) => { state.map = next; drawMap(); },
      onOpen: (id, page) => (id === d.id ? (page ? openPage(page) : (state.tab = 'dossier', draw())) : show(id, page)),
    }));
    body.classList.remove('paged');
  }

  // The library's own controls redraw it alone. After a chip or the fold changes, the list starts at the open person (or its start).
  function redrawLibrary() { keeping(drawLibrary); }
  function relist() {
    redrawLibrary();
    for (const row of LISTS.map(sel => root.querySelector?.(sel))) if (row) { row.scrollTop = 0; row.scrollLeft = 0; }
    reveal();
  }
  function pickPerson(id) {
    if (id === d.id) return;
    show(id);
    reveal();
  }
  // ‹ › and the arrow keys go through the chosen chip's order; focus that was on a portrait moves to the new person's.
  function stepBy(delta) {
    const people = libPeople();
    const id = stepPerson(people, chipSets(people)[state.libFilter], d.id, delta);
    if (!id) return;
    const onPortrait = Boolean(root.ownerDocument?.activeElement?.closest?.('.dlib [data-person-id]'));
    pickPerson(id);
    if (onPortrait) (root.querySelector?.('.dlib [aria-current="true"]') ?? root.querySelector?.('.dlib [data-act="library"]'))?.focus?.({ preventScroll: true });
  }
  // The open person's portrait is brought into the library's list (the list alone scrolls, never the page behind it).
  function reveal() {
    for (const sel of LISTS) {
      const list = root.querySelector?.(sel);
      const mine = list?.querySelector?.('[aria-current="true"]');
      if (!mine?.getBoundingClientRect || !list.getBoundingClientRect) continue;
      const outer = list.getBoundingClientRect();
      const inner = mine.getBoundingClientRect();
      if (inner.left < outer.left) list.scrollLeft -= outer.left - inner.left; else if (inner.right > outer.right) list.scrollLeft += inner.right - outer.right;
      if (inner.top < outer.top) list.scrollTop -= outer.top - inner.top; else if (inner.bottom > outer.bottom) list.scrollTop += inner.bottom - outer.bottom;
    }
  }

  function drawLibrary() {
    libSlot.replaceChildren(dossierLibrary(libPeople(), {
      currentId: d.id, open: state.lib, filter: state.libFilter, query: state.libQuery,
      onToggle: () => { state.lib = !state.lib; relist(); },
      onMore: () => { Object.assign(state, { lib: true, libFilter: 'all', libQuery: '' }); relist(); },
      onFilter: (id) => { state.libFilter = id; relist(); },
      onQuery: (text) => { state.libQuery = text; },
      onStep: stepBy, onPick: pickPerson,
    }));
  }

  // A redraw keeps where the reader was: the columns' and lists' scroll (an outlined card low in the list stays in view) and the focus on the control it was on.
  const LISTS = ['.dlib .lrow', '.dlib .row2'];
  const KEEP = ['.dhero', '.dcards', '.dmapv .rmain', ...LISTS];
  const keyOf = (el) => {
    if (el?.closest?.('.dlib')) {
      if (el.dataset?.personId) return `.dlib [data-person-id="${el.dataset.personId}"]`;
      if (el.dataset?.filter) return `.dlib [data-filter="${el.dataset.filter}"]`;
    }
    return el?.dataset?.page && el.classList?.contains('dcard') ? `.dcard[data-page="${el.dataset.page}"]` : el?.dataset?.act ? `[data-act="${el.dataset.act}"]` : el?.dataset?.tab ? `[data-tab="${el.dataset.tab}"]` : null;
  };
  function keeping(redraw) {
    const scrolls = KEEP.map(sel => { const el = root.querySelector?.(sel); return [el?.scrollTop ?? 0, el?.scrollLeft ?? 0]; });
    const active = root.ownerDocument?.activeElement;
    const focus = active && root.contains(active) ? keyOf(active) : null;
    const inLibrary = Boolean(focus && active.closest?.('.dlib'));
    redraw();
    KEEP.forEach((sel, i) => { const el = root.querySelector?.(sel); const [top, left] = scrolls[i]; if (el && top) el.scrollTop = top; if (el && left) el.scrollLeft = left; });
    if (!focus) return;
    // (a library control that is gone or switched off hands the focus to the strip's head, so the arrow keys keep working)
    let next = root.querySelector?.(focus);
    if (inLibrary && (!next || next.disabled)) next = root.querySelector?.('.dlib [data-act="library"]');
    next?.focus?.({ preventScroll: true });
  }

  function draw() {
    keeping(() => {
      drawBar();
      root.classList.toggle('maptab', state.tab === 'map');
      if (state.tab === 'map') drawMap(); else drawDossier();
      drawLibrary();
    });
  }

  function downFromStack() { shut = true; release('menu'); release('page'); ctx.onClose?.(); }
  draw();
  hold('dossier', 'page', downFromStack);
  return root;
}
