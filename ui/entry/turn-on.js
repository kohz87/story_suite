// Mounts the new view on the Story Block port (styles, menu entry, the Extensions drawer, chat surfaces, listeners) and returns the one function that removes it all.

import { mountSuite } from '../mount.js';
import { createSbPort } from '../port/sb-port.js';
import { addMenuEntry, chatPrefs } from '../port/st-chat.js';
import { createChatSurfaces } from '../chat/chat-surfaces.js';
import { replyMenuButton, replySheet } from '../chat/reply-menu.js';
import { buildSelectors } from '../select/build.js';
import { liveOffer } from '../port/live-offer.js';
import { packs as livePacks, refreshLore } from '../../packs/index.js';
import { readCharacterLorebook } from '../../packs/st-adapter.js';
import { isCarrier } from '../../core/persist.js';
import { addDrawerButtons, DRAWER_ROW_ID } from './drawer-buttons.js';
import { createHold, showScreens } from '../port/hold.js';
import { frameCoalesced } from '../runtime/redraw.js';
import { attachWizard } from '../wizard/attach.js';
import { SUITE_VERSION } from '../../core/version.js';

const STYLES = ['base', 'shell', 'kit', 'card', 'now', 'chat', 'party', 'bag', 'fight', 'scene', 'people', 'dossier', 'world', 'journal', 'story', 'settings', 'wizard'];
// The Packs page's handle: the same installed-packs store and lorebook reader the old Packs panel uses.
const PACKS_HANDLE = Object.freeze({ packs: livePacks, readLorebook: readCharacterLorebook, lore: { read: refreshLore } });
const EVENTS = ['head', 'committed', 'turn', 'feature', 'offer'];
// The screen the RPG opens for a fight (the waiting pause, Send while it waits, a fight begun): shown here as the Fight tab, never as the old view's screen.
const FIGHT_SCREEN = 'story-block/fight';

// The drawer's status line: the version and the modules that started.
const drawerStatus = sdk => { let names = []; try { names = (sdk?.modules?.() ?? []).map(module => module.name); } catch { names = []; } return `Story Suite ${SUITE_VERSION} · ${names.join(', ')}`; };

function addStyles(doc, base) {
  return STYLES.map(name => {
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${base}css/${name}.css`;
    link.setAttribute('data-ss-next', '1');
    doc.head.appendChild(link);
    return link;
  });
}

// Draws the new view and returns the one function that takes it all away again.
export function turnOn({ doc, base, ctx, StoryBlock }) {
  const links = addStyles(doc, base);
  const prefs = { chat: chatPrefs(ctx) };
  const hold = createHold(doc);
  const port = createSbPort({ sdk: StoryBlock.sdk, writes: StoryBlock.writes, tools: StoryBlock.tools, packs: PACKS_HANDLE, hold, selectors: buildSelectors(ctx, StoryBlock.sdk, StoryBlock.tools, hold), rpgValues: () => StoryBlock.sdk?.settings?.('story-block'), prefs, offer: liveOffer, screens: { open: (...args) => wizard?.open(...args) ?? false }, onError: (tab, error) => console.warn(`[Story Suite] the ${tab} view could not be built`, error) });
  const suite = mountSuite({ port, doc, host: doc.body, theme: 'follow' });
  // The New character wizard and the first-send hold (the port's `open` reaches it first).
  const wizard = attachWizard({ doc, ctx, sdk: StoryBlock.sdk, suite });
  const entry = addMenuEntry(doc, { label: 'Story Suite', onClick: () => suite.open('now') });
  const offScreens = showScreens(doc, id => { if (id !== FIGHT_SCREEN) return false; suite.open(port.view('fight') ? 'fight' : 'now'); return true; });
  const drawerHost = doc.createElement('div');
  drawerHost.className = 'ss-drawer-host';
  const form = doc.querySelector('#send_form');
  if (form?.parentNode) form.parentNode.insertBefore(drawerHost, form);
  const surfaces = createChatSurfaces({
    messagesEl: doc.querySelector('#chat'), drawerHost, isNarrow: () => (globalThis.innerWidth ?? 1000) < 600,
    handlers: { onReread: () => { const at = (ctx()?.chat ?? []).findLastIndex(isCarrier); if (at >= 0) port.reread(at); }, onOpenSuite: tab => suite.open(tab), onNeedsYou: () => suite.open(port.view('now')?.needsYou?.some(row => row.kind === 'overdue') ? 'journal' : 'now'), onFight: () => suite.open('fight'), onOpenPerson: id => { suite.open('people'); port.command('suite.go', { tab: 'people', personId: id }); } },
  });
  let button = null;
  let sheet = null;
  const refresh = () => {
    addDrawerButtons(doc, { onSettings: () => { suite.open('now'); suite.settings(); }, onOpen: () => suite.open('now'), title: `Story Suite ${SUITE_VERSION}`, status: drawerStatus(StoryBlock.sdk) });
    const vm = port.view('chat');
    surfaces.refresh(vm);
    const bar = [...doc.querySelectorAll('#chat .mes .extraMesButtons')].pop() ?? null;
    if (!bar || !vm?.replyMenu) return;
    if (button && button.parentNode === bar) return;
    button?.remove();
    sheet?.remove();
    sheet = null;
    button = replyMenuButton({
      onOpen: () => {
        if (sheet) { sheet.remove(); sheet = null; return; }
        const close = () => { sheet?.remove(); sheet = null; };
        sheet = replySheet(port.view('chat')?.replyMenu, {
          onOpenSuite: tab => suite.open(tab),
          // The sheet is the head reply's: its repaired lines are taken out and the reply is read again (the repair is not asked again).
          onDiscard: () => { const at = (ctx()?.chat ?? []).findLastIndex(isCarrier); close(); if (at >= 0) port.reread(at, { discardRepair: true }); },
          onClose: close,
        });
        bar.parentNode?.appendChild(sheet);
      },
    });
    bar.appendChild(button);
  };
  // A burst of port and SillyTavern events redraws the chat surfaces once, in the next frame (always: their DOM may change with an equal view).
  const frame = frameCoalesced(refresh);
  const offs = EVENTS.map(event => port.on(event, frame.request));
  const types = ctx()?.eventTypes ?? ctx()?.event_types ?? {};
  for (const type of [types.CHAT_CHANGED, types.MESSAGE_RECEIVED, types.MESSAGE_SENT]) if (type) ctx()?.eventSource?.on?.(type, frame.request);
  const box = doc.querySelector('#send_textarea');
  const typing = () => surfaces.setTyping(String(box?.value ?? '').length > 0);
  box?.addEventListener('input', typing);
  refresh();
  return () => {
    frame.cancel();
    for (const off of offs) off();
    for (const type of [types.CHAT_CHANGED, types.MESSAGE_RECEIVED, types.MESSAGE_SENT]) if (type) ctx()?.eventSource?.removeListener?.(type, frame.request);
    box?.removeEventListener?.('input', typing);
    offScreens();
    wizard.destroy();
    suite.destroy();
    entry?.remove();
    doc.querySelector(`#${DRAWER_ROW_ID}`)?.remove();
    button?.remove();
    sheet?.remove();
    drawerHost.remove();
    for (const link of links) link.remove();
  };
}
