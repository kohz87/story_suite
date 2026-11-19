// Composes one person's dossier: the top bar, the portrait column, the cards with the opened part (beside them on a desktop window, a page of its own below),
// the Map tab, and the library strip; Escape closes through the back-stack (menu, then the part, then the dossier).
import { h } from '../../../kit/dom.js';
import { tabTrap } from '../../../kit/trap.js';
import { dossierPages, dossierCards } from './cards.js';
import { dossierHero } from './hero.js';
import { dossierBar } from './top-bar.js';
import { dossierPart } from './part.js';
import { dossierLibrary, libraryPeople } from './library.js';
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
  const state = { page: null, tab: 'dossier', menu: false, sure: false, following: Boolean(d.following), lib: false, libFilter: 'all', map: {} };
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
  root.addEventListener('keydown', tabTrap(root, { isOn: () => !shut }));

  function closeMenu() { release('menu'); state.menu = false; state.sure = false; drawBar(); }
  function openPage(id) {
    state.page = id;
    state.tab = 'dossier';
    hold('page', 'page', () => { state.page = null; draw(); });
    draw();
  }
  function closePage() { release('page'); state.page = null; draw(); }
  function close() { shut = true; release('menu'); release('page'); release('dossier'); ctx.onClose?.(); }
  root.close = close;
  // The person changed while the dossier is open (a reply, an Edit save): the same part is drawn again from the fresh record.
  root.update = (next) => {
    if (!next || shut) return;
    d = next;
    pages = dossierPages(d, ctx.youName);
    state.following = Boolean(d.following);
    if (state.page && !pages.some(p => p.id === state.page)) { release('page'); state.page = null; }
    draw();
  };
  // Another person from the library, a tie or the map: shown in place (the strip, its filter and the map's lens stay), on `page` when given.
  function show(id, page = null) {
    const next = ctx.port?.view?.('dossier')?.[id];
    if (!next || shut) return;
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
    if (id === 'delete' && !state.sure) { state.sure = true; drawBar(); return; }
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
        hold('menu', 'menu', () => { state.menu = false; state.sure = false; drawBar(); });
        drawBar();
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
      dossierHero(d, { following: state.following, onFollow: follow, onProfile: () => openPage('profile'), party }),
      dossierCards(d, pages, { current: open?.id ?? null, onOpen: openPage }),
      open ? dossierPart(d, pages, open.id, { ctx: { ...ctx, openPerson: id => show(id) }, onBack: closePage, onGo: openPage }) : null].filter(Boolean));
    body.classList.toggle('paged', Boolean(open));
  }

  function drawMap() {
    const vm = ctx.port?.view?.('people') ?? {};
    const people = [...(vm.here ?? []).map(p => ({ ...p, here: true })), ...(vm.elsewhere ?? []).map(p => ({ ...p, here: false }))];
    const you = ctx.you ?? ctx.port?.view?.('card')?.you ?? { name: ctx.youName ?? 'You' };
    body.replaceChildren(dossierMapTab(d, {
      people, ties: vm.ties ?? [], you: { ...you, name: you?.name ?? ctx.youName ?? 'You' }, map: state.map,
      onMap: (next) => { state.map = next; drawMap(); },
      onOpen: (id, page) => (id === d.id ? (page ? openPage(page) : (state.tab = 'dossier', draw())) : show(id, page)),
    }));
    body.classList.remove('paged');
  }

  function drawLibrary() {
    libSlot.replaceChildren(dossierLibrary(libraryPeople(ctx.port?.view?.('dossier')), {
      currentId: d.id, open: state.lib, filter: state.libFilter,
      onToggle: () => { state.lib = !state.lib; drawLibrary(); },
      onFilter: (id) => { state.libFilter = id; drawLibrary(); },
      onPick: (id) => { if (id !== d.id) show(id); },
    }));
  }

  function draw() {
    drawBar();
    root.classList.toggle('maptab', state.tab === 'map');
    if (state.tab === 'map') drawMap(); else drawDossier();
    drawLibrary();
  }

  function downFromStack() { shut = true; release('menu'); release('page'); ctx.onClose?.(); }
  draw();
  hold('dossier', 'page', downFromStack);
  return root;
}
