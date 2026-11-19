// Mounts the new view on the Story Block port (styles, menu entry, the Extensions drawer, chat surfaces, listeners) and returns the one function that removes it all.

import { mountSuite } from '../mount.js';
import { createSbPort } from '../port/sb-port.js';
import { addMenuEntry, chatPrefs } from '../port/st-chat.js';
import { createChatSurfaces } from '../chat/chat-surfaces.js';
import { runCardAction } from '../chat/reply-cards.js';
import { replyMenuButton, replySheet } from '../chat/reply-menu.js';
import { buildSelectors } from '../select/build.js';
import { liveOffer } from '../port/live-offer.js';
import { packs as livePacks, refreshLore } from '../../packs/index.js';
import { readCharacterLorebook, stLorebooks, stSettings } from '../../packs/st-adapter.js';
import { isCarrier } from '../../core/persist.js';
import { addDrawerButtons, DRAWER_ROW_ID } from './drawer-buttons.js';
import { createHold, showScreens } from '../port/hold.js';
import { frameCoalesced } from '../runtime/redraw.js';
import { attachWizard } from '../wizard/attach.js';
import { SUITE_VERSION } from '../../core/version.js';
import { pageHandles } from '../../modules/people/runtime/handles.js';

const STYLES = ['base', 'shell', 'desk', 'kit', 'card', 'now', 'chat', 'loot', 'party', 'bag', 'fight', 'scene', 'people', 'dossier', 'world', 'journal', 'story', 'settings', 'sheet-desk', 'wizard', 'gear-stats'];
// The Packs page's handle: the same installed-packs store and lorebook reader the old Packs panel uses, and SillyTavern's World Info for a world pack's lorebook.
const PACKS_HANDLE = Object.freeze({ packs: livePacks, readLorebook: readCharacterLorebook, lore: { read: refreshLore }, lorebooks: { books: stLorebooks(), settings: stSettings() } });
const EVENTS = ['head', 'committed', 'turn', 'feature', 'offer'];
// SillyTavern events that move or redraw a reply's action bar (a swipe, a delete and an edit send none of the three before).
const ST_EVENTS = ['CHAT_CHANGED', 'MESSAGE_RECEIVED', 'MESSAGE_SENT', 'MESSAGE_SWIPED', 'MESSAGE_DELETED', 'MESSAGE_EDITED'];
// The screen the RPG opens for a fight (the waiting pause, Send while it waits, a fight begun): shown here as the Fight tab, never as the old view's screen.
const FIGHT_SCREEN = 'story-block/fight';

// The drawer's status line: the version and the modules that started.
const drawerStatus = sdk => { let names = []; try { names = [...new Set((sdk?.modules?.() ?? []).filter(module => !module.hidden).map(module => module.name))]; } catch { names = []; } return `Story Suite ${SUITE_VERSION} · ${names.join(', ')}`; };

// This device's store for the device preferences (Panel background, Developer tools, folds); none reachable keeps them in memory.
function deviceStorage(doc) {
  try { return doc.defaultView?.localStorage ?? globalThis.localStorage ?? null; } catch { return null; }
}

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
  const port = createSbPort({ sdk: StoryBlock.sdk, writes: StoryBlock.writes, tools: StoryBlock.tools, packs: PACKS_HANDLE, hold, selectors: buildSelectors(ctx, StoryBlock.sdk, StoryBlock.tools, hold, StoryBlock.cards), rpgValues: () => StoryBlock.sdk?.settings?.('story-block'), prefs, offer: liveOffer, screens: { open: (...args) => wizard?.open(...args) ?? false }, onError: (tab, error) => console.warn(`[Story Suite] the ${tab} view could not be built`, error) });
  const suite = mountSuite({ port, doc, host: doc.body, storage: deviceStorage(doc), theme: 'follow', look: () => StoryBlock.sdk?.settings?.() });
  // The New character wizard and the first-send hold (the port's `open` reaches it first: the old host's window never opens too).
  const wizard = attachWizard({ doc, ctx, sdk: StoryBlock.sdk, suite });
  const entry = addMenuEntry(doc, { label: 'Story Suite', onClick: () => suite.open('now') });
  const offScreens = showScreens(doc, id => { if (id !== FIGHT_SCREEN) return false; suite.open(port.view('fight') ? 'fight' : 'now'); return true; });
  const drawerHost = doc.createElement('div');
  drawerHost.className = 'ss-drawer-host';
  const form = doc.querySelector('#send_form');
  if (form?.parentNode) form.parentNode.insertBefore(drawerHost, form);
  const surfaces = createChatSurfaces({
    messagesEl: doc.querySelector('#chat'), drawerHost, isNarrow: () => (globalThis.innerWidth ?? 1000) < 600,
    handlers: { onCardAction: action => runCardAction(port, action), onReread: () => { const at = (ctx()?.chat ?? []).findLastIndex(isCarrier); if (at >= 0) port.reread(at); }, chatterOpen: () => prefs.chat.get().chatterOpen === true, onChatterFold: open => prefs.chat.set('chatterOpen', open), onOpenSuite: tab => suite.open(tab), onNeedsYou: () => suite.open(port.view('now')?.needsYou?.some(row => row.kind === 'overdue') ? 'journal' : 'now'), onFight: () => suite.open('fight'), onLootTake: (sid, pick) => port.command('inventory.lootTake', { sid, pick }), onOpenPerson: (id, name) => { if (!pageHandles.openPerson?.({ id, name })) suite.open('people'); } }, // (the person's own page, the same opener NPC State's "open dossier" uses)
  });
  // NPC State's "open this person's dossier" (a present card, the world's People list, its public openDossier) opens it here.
  const openPerson = ({ id, name } = {}) => suite.person([String(id ?? ''), String(name ?? '').trim().toLocaleLowerCase()]);
  pageHandles.openPerson = openPerson;
  let button = null;
  let sheet = null;
  const refresh = () => {
    addDrawerButtons(doc, { onSettings: () => { suite.open('now'); suite.settings(); }, onOpen: () => suite.open('now'), title: `Story Suite ${SUITE_VERSION}`, status: drawerStatus(StoryBlock.sdk) });
    const vm = port.view('chat');
    surfaces.refresh(vm);
    // The head reply's own action bar (the reply the sheet is about), not the last message's: that may be the reader's.
    const at = (ctx()?.chat ?? []).findLastIndex(isCarrier);
    const bar = (at >= 0 ? doc.querySelector(`#chat .mes[mesid="${at}"] .extraMesButtons`) : null) ?? [...doc.querySelectorAll('#chat .mes .extraMesButtons')].pop() ?? null;
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
          // The sheet is the head reply's: Re-read reads its (possibly edited) text again.
          onReread: () => { const at = (ctx()?.chat ?? []).findLastIndex(isCarrier); close(); if (at >= 0) port.reread(at); },
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
  for (const name of ST_EVENTS) if (types[name]) ctx()?.eventSource?.on?.(types[name], frame.request);
  const box = doc.querySelector('#send_textarea');
  const typing = () => surfaces.setTyping(String(box?.value ?? '').length > 0);
  box?.addEventListener('input', typing);
  refresh();
  return () => {
    frame.cancel();
    for (const off of offs) off();
    for (const name of ST_EVENTS) if (types[name]) ctx()?.eventSource?.removeListener?.(types[name], frame.request);
    box?.removeEventListener?.('input', typing);
    offScreens();
    if (pageHandles.openPerson === openPerson) pageHandles.openPerson = null;
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
