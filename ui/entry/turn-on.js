// Mounts the new view on the Story Block port (styles, body class, menu entry, chat surfaces, listeners) and returns the one function that removes it all.

import { mountSuite } from '../mount.js';
import { createSbPort } from '../port/sb-port.js';
import { addMenuEntry, chatPrefs } from '../port/st-chat.js';
import { createChatSurfaces } from '../chat/chat-surfaces.js';
import { replyMenuButton, replySheet } from '../chat/reply-menu.js';
import { buildSelectors } from '../select/build.js';

const BODY_CLASS = 'ss-ui-next';
const STYLES = ['base', 'shell', 'kit', 'card', 'now', 'chat', 'party', 'bag', 'fight', 'people', 'dossier', 'world', 'journal', 'story', 'settings'];
const EVENTS = ['head', 'committed', 'turn', 'feature'];

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

// Draws everything the flag turns on and returns the one function that takes it all away again.
export function turnOn({ doc, base, ctx, StoryBlock }) {
  const links = addStyles(doc, base);
  doc.body.classList.add(BODY_CLASS);
  const prefs = { chat: chatPrefs(ctx) };
  const port = createSbPort({ sdk: StoryBlock.sdk, selectors: buildSelectors(ctx, StoryBlock.sdk), prefs });
  const suite = mountSuite({ port, doc, host: doc.body, theme: 'follow' });
  const entry = addMenuEntry(doc, { label: 'Story Suite (preview)', onClick: () => suite.open('now') });
  const drawerHost = doc.createElement('div');
  drawerHost.className = 'ss-drawer-host';
  const form = doc.querySelector('#send_form');
  if (form?.parentNode) form.parentNode.insertBefore(drawerHost, form);
  const surfaces = createChatSurfaces({
    messagesEl: doc.querySelector('#chat'), drawerHost, isNarrow: () => (globalThis.innerWidth ?? 1000) < 600,
    handlers: { onOpenSuite: tab => suite.open(tab), onNeedsYou: () => suite.open('journal'), onFight: () => suite.open('fight'), onOpenPerson: id => { suite.open('people'); port.command('suite.go', { tab: 'people', personId: id }); } },
  });
  let button = null;
  let sheet = null;
  const refresh = () => {
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
        sheet = replySheet(port.view('chat')?.replyMenu, { onOpenSuite: tab => suite.open(tab), onClose: () => { sheet?.remove(); sheet = null; } });
        bar.parentNode?.appendChild(sheet);
      },
    });
    bar.appendChild(button);
  };
  const offs = EVENTS.map(event => port.on(event, refresh));
  const types = ctx()?.eventTypes ?? ctx()?.event_types ?? {};
  for (const type of [types.CHAT_CHANGED, types.MESSAGE_RECEIVED, types.MESSAGE_SENT]) if (type) ctx()?.eventSource?.on?.(type, refresh);
  const box = doc.querySelector('#send_textarea');
  const typing = () => surfaces.setTyping(String(box?.value ?? '').length > 0);
  box?.addEventListener('input', typing);
  refresh();
  return () => {
    for (const off of offs) off();
    for (const type of [types.CHAT_CHANGED, types.MESSAGE_RECEIVED, types.MESSAGE_SENT]) if (type) ctx()?.eventSource?.removeListener?.(type, refresh);
    box?.removeEventListener?.('input', typing);
    suite.destroy();
    entry?.remove();
    button?.remove();
    sheet?.remove();
    drawerHost.remove();
    for (const link of links) link.remove();
    doc.body.classList.remove(BODY_CLASS);
  };
}
