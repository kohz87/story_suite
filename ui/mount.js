// Mounts the suite on a port: builds the shell and tab host, wires back-stack and redraw, and returns open, close and destroy.

import { checkPort } from './port/contract.js';
import { createBackStack } from './runtime/back-stack.js';
import { bindBackHistory } from './runtime/back-history.js';
import { createRedraw } from './runtime/redraw.js';
import { createSuiteView } from './shell/suite-view.js';
import { createTabHost } from './shell/tab-host.js';
import { watchDesk } from './shell/desk-layout.js';
import { GLASS_DARK, GLASS_LIGHT } from './theme/tokens.js';
import { followSt, watchSt } from './theme/follow-st.js';
import { skyFor } from './theme/sky.js';
import { lookOf, lookTheme } from './theme/look.js';
import { createPrefs } from './runtime/prefs.js';
import { defaultViews } from './shell/default-views.js';
import { createSettingsOverlay } from './settings/overlay.js';
import { renderSettingsSection } from './settings/sections/index.js';
import { SCENE_SPOILERS } from './select/director-rows.js';
import { PANELBG_KEY, applyPanelBg } from './settings/panel-bg.js';
import { DEVELOPER_KEY } from './settings/developer.js';
import { leaveTrackerIntent } from './tabs/story/tracker-intent.js';

// SillyTavern's theme variables, read on <html> (follow-st.js reads the same).
const stVar = doc => name => {
  try { return String(doc?.defaultView?.getComputedStyle?.(doc.documentElement)?.getPropertyValue?.(name) ?? ''); } catch { return ''; }
};

function resolveTheme(theme, doc) {
  if (theme === 'light') return { tokens: GLASS_LIGHT, scheme: 'light' };
  if (theme === 'follow') {
    const tokens = followSt({ doc });
    return { tokens, scheme: tokens['--su-hp'] === GLASS_LIGHT['--su-hp'] ? 'light' : 'dark' };
  }
  return { tokens: GLASS_DARK, scheme: 'dark' };
}

// The tab strip's flags: the port's light `flags` view (no scene gather, no cast); a port without one (or whose view failed) is read the old way, from the card, fight and scene views.
function readFlags(port, override) {
  const light = port.view('flags');
  const scene = light ? null : port.view('scene');
  return {
    rpg: override?.rpg ?? (light ? light.rpg !== false : port.view('card')?.rpg !== false),
    fightOpen: override?.fightOpen ?? (light ? Boolean(light.fightOpen) : Boolean(port.view('fight'))),
    sceneOpen: override?.sceneOpen ?? (light ? Boolean(light.sceneOpen) : Boolean(scene)),
    sceneTitle: override?.sceneTitle ?? (light ? light.sceneTitle ?? '' : scene?.title ?? ''),
  };
}

/**
 * Mounts the suite. Options: `port` (required), `doc`, `host`, `flags` ({ rpg, fightOpen } overrides),
 * `theme` ('dark' | 'light' | 'follow'), `tabs` (id → (view, ctx) => node), `card` ((view, ctx) => node),
 * `schedule` (frame scheduler for tests), `initial` (first tab),
 * `storage` (a localStorage-like store: device preferences survive a reload), `look` (() → the host settings: Settings › Look's Panel style, Glass strength, Font and Text size decide the theme in place of `theme`, read again
 * on open, after every Settings change and when SillyTavern's theme changes). Returns `{ open(tab), close(), person(keys), settings(), destroy(), ... }`.
 */
export function mountSuite(options = {}) {
  const { port, doc = globalThis.document, host = doc?.body, flags: override = null, theme = 'dark' } = options;
  const { tabs = {}, card = null, schedule, initial = 'now', look = null } = options;
  const verdict = checkPort(port);
  if (!verdict.ok) throw new TypeError(`mountSuite needs a working port: ${verdict.errors.join('; ')}`);

  const backStack = createBackStack();
  const unbindKeys = backStack.bindDocument(doc);
  const unbindBack = bindBackHistory(backStack, doc?.defaultView);
  const offs = [];
  let flags = readFlags(port, override);
  let scheme = 'dark';
  let destroyed = false;
  let desk = null;   // the desktop layout watcher (shell/desk-layout.js), made once the tab host is in place

  const prefs = options.prefs ?? createPrefs({ port, storage: options.storage ?? null });
  let settingsOverlay = null;
  const openSettings = () => {
    const settings = port.view('settings');
    if (!settings || destroyed) return port.command('suite.settings', {});
    settingsOverlay?.destroy();
    settingsOverlay = createSettingsOverlay({
      doc, host: view.root, settings: { ...settings, developer: prefs.getFold(DEVELOPER_KEY, false), panelBg: prefs.getFold(PANELBG_KEY, false) }, backStack, subtitle: 'this chat', renderSection: renderSettingsSection, prefs,
      onChange: (key, value) => (key === DEVELOPER_KEY ? prefs.setFold(key, value) : key === PANELBG_KEY ? applyPanelBg(view.root, prefs.setFold(key, value)) : key === SCENE_SPOILERS.key ? ({ ok: true, value: !prefs.setSpoiler('scene', value !== true) }) : relook(port.command('settings.set', { key, value }))),
      onAction: (key, value) => (key === 'trackers.open' ? openTrackers(value) : key === 'people.open' ? openPerson(value) : key === 'people.reread' ? port.command('npc.refresh', value) : relook(port.command('settings.action', { key, value }))), onView: (name, args) => port.view(name, args),
    });
    settingsOverlay.open();
    return port.command('suite.settings', {});
  };
  // Settings › Packs and trackers: a tracker is added from a template and edited on Story › Trackers, so each button there closes Settings and opens its own sheet.
  const openTrackers = (where) => { settingsOverlay?.close(); leaveTrackerIntent(where); prefs.setFold('story.trackers', true); showTab('story'); return { ok: true }; };
  // Settings › People › People in this chat: Open closes Settings and shows the person's dossier on People.
  const openPerson = ({ id, name } = {}) => { settingsOverlay?.close(); showTab('people'); return { ok: views.openPerson([String(id ?? ''), String(name ?? '').trim().toLocaleLowerCase()]) }; };
  const views = defaultViews({
    port, prefs, backStack, doc, tabHost: () => tabHost, onSettings: openSettings,
    onChat: () => view.close(), refresh: () => showTab(tabHost.current()), width: () => tabHost.panel.clientWidth, desk: () => desk?.on() === true,
  });
  // Settings › Look (theme/look.js) when the mount reads it: its theme, and its Text size as the root's `data-text` (the zoom in shell.css).
  const readLook = () => { try { return lookOf(look()); } catch { return lookOf(null); } };
  const pickTheme = () => (look ? lookTheme(readLook(), stVar(doc)) : { ...resolveTheme(theme, doc), zoom: null });
  const picked = pickTheme();
  scheme = picked.scheme;
  const view = createSuiteView({ doc, host, backStack, tokens: picked.tokens, scheme });
  let shown = '';
  function applyLook(next = pickTheme()) {
    const key = JSON.stringify(next);
    if (key === shown) return;
    shown = key;
    scheme = next.scheme;
    view.setTheme(next.tokens, next.scheme);
    if (next.zoom) view.root.setAttribute('data-text', String(Math.round(next.zoom * 100)));
    else view.root.removeAttribute('data-text');
    view.root.style.setProperty('--su-sky', skyFor(skyTime, scheme));
  }
  // A Settings write (or reset) answered: the look is read again, so a Look change shows at once.
  function relook(answer) {
    if (!look) return answer;
    return Promise.resolve(answer).then(done => { if (!destroyed) applyLook(); return done; });
  }
  applyPanelBg(view.root, prefs.getFold(PANELBG_KEY, false));
  // While the suite is closed its card and tabs are not read; open() draws what changed meanwhile (the tab strip's flags stay live).
  const redraw = createRedraw({ port, initialTab: initial, isOpen: () => view.isOpen(), ...(schedule ? { schedule } : {}) });
  const tabHost = createTabHost({
    doc,
    flags,
    initial,
    onSelect: id => showTab(id),
    onChat: () => view.close(),
    onSettings: openSettings,
  });
  view.content.appendChild(tabHost.el);

  let skyTime = null;   // the scene time the backdrop was last painted for: a look change paints with it and never reads the card
  function paintSky(cardVm = port.view('card')) {
    const time = cardVm?.scene?.time ?? null;
    skyTime = time;
    view.root.style.setProperty('--su-sky', skyFor(time, scheme));
  }

  function register(tab) {
    redraw.register(`tab:${tab}`, {
      tab,
      read: () => port.view(tab),
      target: tabHost.panel,
      render: vm => (tabs[tab] ? tabs[tab](vm, { port, backStack, flags }) : views.tab(tab, vm)),
    });
  }

  function showTab(id) {
    redraw.unregister(`tab:${id}`);
    register(id);
    redraw.setVisibleTab(id);
    redraw.flush();
  }

  // Port events mark the flags dirty with every section: they are read once a frame, before the card and the tab, so a fight's tab is there in the frame that draws it.
  redraw.register('flags', { tab: 'always', whileClosed: true, first: true, read: () => readFlags(port, override), draw: next => applyFlags(next) });
  redraw.register('card', {
    tab: 'always',
    read: () => {
      const vm = port.view('card');
      paintSky(vm);
      return vm;
    },
    target: tabHost.cardSlot,
    render: vm => (card ? card(vm, { port, backStack }) : views.card(vm)),
  });
  // A person's page left open over the tabs follows the story: it is read again with every change.
  redraw.register('dossier', { tab: 'always', isVisible: () => views.hasDossier(), read: () => views.openDossier(), draw: vm => views.updateDossier(vm) });
  register(tabHost.current());
  // Desktop (ui/css/desk.css): Here now under the card on every tab, read only while drawn; crossing the width draws it and redraws Now without (or with) its Here card.
  redraw.register('here', { tab: 'always', isVisible: () => desk?.on() === true, read: () => { const now = port.view('now'); return { here: now?.here ?? [], unrecorded: now?.unrecorded ?? [] }; }, target: tabHost.hereSlot, render: vm => views.here(vm) });
  desk = watchDesk({ probe: tabHost.scroll.firstChild, root: view.root, onChange: () => { if (tabHost.current() === 'now') showTab('now'); redraw.reveal(); } });

  function applyFlags(next) {
    flags = next;
    const before = tabHost.current();
    tabHost.setFlags(flags);
    if (tabHost.current() !== before) showTab(tabHost.current());
  }
  const refreshFlags = () => applyFlags(readFlags(port, override));
  // An interaction call changes chat metadata only, so the engine says nothing: the port does (`interaction`), and the open tab and the tab strip redraw.
  offs.push(port.on('interaction', () => redraw.markDirty()));
  // The arc planner changes on its own (automatic plan, Planning…): the port says so (`arc`), and the story tab redraws.
  offs.push(port.on('arc', () => redraw.markDirty()));

  if (look) applyLook(picked);
  if (look || theme === 'follow') {
    offs.push(watchSt(doc, () => {
      if (destroyed) return;
      if (look) { applyLook(); return; }
      const next = resolveTheme('follow', doc);
      scheme = next.scheme;
      view.setTheme(next.tokens, next.scheme);
      paintSky();
    }));
  }

  return {
    root: view.root,
    tabHost,
    backStack,
    redraw,
    // Opening on a tab the strip does not list reads the flags first (a fight that just began has its tab); opening on a tab closes a person's page left open over the tabs.
    open(tab) {
      if (destroyed) return false;
      if (tab && !tabHost.tabs().includes(tab)) refreshFlags();
      if (tab) views.closePage?.();
      if (tab && tab !== tabHost.current()) tabHost.select(tab);
      if (look) applyLook();
      const opened = view.open();
      desk.check();   // (the stylesheets are added at mount: a size check that ran before desk.css applied is read again here)
      redraw.setVisibleTab(tabHost.current());
      redraw.reveal();
      redraw.flush();
      return opened;
    },
    close: () => view.close(),
    // Opens the suite on People with one person's dossier (`keys`: their store id and/or lower-case name); false when nobody matches.
    person(keys) {
      if (destroyed) return false;
      if (!views.personKey(keys)) return false;
      this.open('people');
      return views.openPerson(keys);
    },
    settings: () => (destroyed ? null : openSettings()),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const off of offs) off();
      desk.stop();
      unbindKeys();
      unbindBack();
      redraw.destroy();
      settingsOverlay?.destroy();
      view.destroy();
    },
  };
}
