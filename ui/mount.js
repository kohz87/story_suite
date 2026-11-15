// Mounts the suite on a port: builds the shell and tab host, wires back-stack and redraw, and returns open, close and destroy.

import { checkPort } from './port/contract.js';
import { createBackStack } from './runtime/back-stack.js';
import { createRedraw } from './runtime/redraw.js';
import { createSuiteView } from './shell/suite-view.js';
import { createTabHost } from './shell/tab-host.js';
import { GLASS_DARK, GLASS_LIGHT } from './theme/tokens.js';
import { followSt } from './theme/follow-st.js';
import { skyFor } from './theme/sky.js';
import { createPrefs } from './runtime/prefs.js';
import { defaultViews } from './shell/default-views.js';
import { createSettingsOverlay } from './settings/overlay.js';
import { renderSettingsSection } from './settings/sections/index.js';

const PORT_EVENTS = ['head', 'committed', 'turn', 'feature'];

function resolveTheme(theme, doc) {
  if (theme === 'light') return { tokens: GLASS_LIGHT, scheme: 'light' };
  if (theme === 'follow') {
    const tokens = followSt({ doc });
    return { tokens, scheme: tokens['--su-back'] === GLASS_LIGHT['--su-back'] ? 'light' : 'dark' };
  }
  return { tokens: GLASS_DARK, scheme: 'dark' };
}

function readFlags(port, override) {
  const card = port.view('card');
  const chat = port.view('chat');
  return {
    rpg: override?.rpg ?? card?.rpg !== false,
    fightOpen: override?.fightOpen ?? Boolean(chat?.inlineRow?.fightOpen),
  };
}

/**
 * Mounts the suite. Options: `port` (required), `doc`, `host`, `flags` ({ rpg, fightOpen } overrides),
 * `theme` ('dark' | 'light' | 'follow'), `tabs` (id → (view, ctx) => node), `card` ((view, ctx) => node),
 * `schedule` (frame scheduler for tests), `initial` (first tab). Returns `{ open(tab), close(), destroy(), ... }`.
 */
export function mountSuite(options = {}) {
  const { port, doc = globalThis.document, host = doc?.body, flags: override = null, theme = 'dark' } = options;
  const { tabs = {}, card = null, schedule, initial = 'now' } = options;
  const verdict = checkPort(port);
  if (!verdict.ok) throw new TypeError(`mountSuite needs a working port: ${verdict.errors.join('; ')}`);

  const backStack = createBackStack();
  const unbindKeys = backStack.bindDocument(doc);
  const redraw = createRedraw({ port, initialTab: initial, ...(schedule ? { schedule } : {}) });
  const offs = [];
  let flags = readFlags(port, override);
  let scheme = 'dark';
  let destroyed = false;

  const prefs = options.prefs ?? createPrefs({ port });
  let settingsOverlay = null;
  const openSettings = () => {
    const settings = port.view('settings');
    if (!settings || destroyed) return port.command('suite.settings', {});
    settingsOverlay?.destroy();
    settingsOverlay = createSettingsOverlay({
      doc, host: view.root, settings, backStack, subtitle: 'this chat', renderSection: renderSettingsSection,
      onChange: (key, value) => port.command('settings.set', { key, value }),
      onAction: (key) => port.command('settings.action', { key }),
    });
    settingsOverlay.open();
    return port.command('suite.settings', {});
  };
  const views = defaultViews({
    port, prefs, backStack, doc, tabHost: () => tabHost, onSettings: openSettings,
    onChat: () => view.close(), refresh: () => showTab(tabHost.current()), width: () => tabHost.panel.clientWidth,
  });
  const picked = resolveTheme(theme, doc);
  scheme = picked.scheme;
  const view = createSuiteView({ doc, host, backStack, tokens: picked.tokens, scheme });
  const tabHost = createTabHost({
    doc,
    flags,
    initial,
    onSelect: id => showTab(id),
    onChat: () => view.close(),
    onSettings: openSettings,
  });
  view.content.appendChild(tabHost.el);

  function paintSky() {
    const time = port.view('card')?.scene?.time ?? null;
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

  redraw.register('card', {
    tab: 'always',
    read: () => {
      paintSky();
      return port.view('card');
    },
    target: tabHost.cardSlot,
    render: vm => (card ? card(vm, { port, backStack }) : views.card(vm)),
  });
  register(tabHost.current());

  function refreshFlags() {
    flags = readFlags(port, override);
    const before = tabHost.current();
    tabHost.setFlags(flags);
    if (tabHost.current() !== before) showTab(tabHost.current());
  }
  for (const event of PORT_EVENTS) offs.push(port.on(event, refreshFlags));

  return {
    root: view.root,
    tabHost,
    backStack,
    redraw,
    open(tab) {
      if (destroyed) return false;
      if (tab && tab !== tabHost.current()) tabHost.select(tab);
      const opened = view.open();
      redraw.setVisibleTab(tabHost.current());
      redraw.flush();
      return opened;
    },
    close: () => view.close(),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const off of offs) off();
      unbindKeys();
      redraw.destroy();
      settingsOverlay?.destroy();
      view.destroy();
    },
  };
}
