// The Tools page's Chat data card: Export this chat's people (NPC State's file, saved by the browser) and what the suite does when a message is deleted or edited.
import { h } from '../kit/dom.js';

/** Builds the card. `state` = { note (the export's last answer), busy, exportPeople() }. */
export function renderChatData(state) {
  const fact = (key, label, text) => h('div', { class: 'srow', dataset: { key } }, h('span', { class: 'lb' }, h('b', label), h('small', text)));
  return h('div', { class: 'sgrp', dataset: { card: 'chat-data' } }, h('div', { class: 'gt' }, 'Chat data'),
    h('div', { class: 'srow', dataset: { key: 'tools.people.export' } },
      h('span', { class: 'lb' }, h('b', 'Export this chat’s people'), h('small', state.note || 'Their dossiers and portraits, as an NPC State file')),
      h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2', disabled: state.busy, onClick: () => state.exportPeople() }, 'Export'))),
    fact('tools.chat.middleDelete', 'Deleting a message in the middle', 'Its changes are taken back and the story is rebuilt from the replies that are left; there is nothing to switch on'),
    fact('tools.chat.edited', 'Swiped and edited replies', 'A swipe brings back that swipe’s own changes. An edited reply keeps its changes until you choose Re-read this reply in its message menu'));
}

/** Saves `bytes` as a file called `name` through the page's browser (a link the page clicks once). */
export function saveFile(doc, bytes, name) {
  const win = doc?.defaultView ?? globalThis;
  const url = win.URL.createObjectURL(new win.Blob([bytes], { type: 'application/octet-stream' }));
  const link = doc.createElement('a');
  link.href = url;
  link.download = name;
  doc.body.appendChild(link);
  link.click();
  link.remove();
  win.setTimeout(() => win.URL.revokeObjectURL(url), 0);
}
