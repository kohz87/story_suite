// The Tools page's Game pack card: the settings now in force, saved as a game pack file the reader can share or install again.
import { h } from '../kit/dom.js';

/** Builds the card. `state` = { note, busy, run() }: `note` is the last answer (what was saved, or why not), `run` asks the engine for the pack and saves it. */
export function renderGameExport(state) {
  return h('div', { class: 'sgrp', dataset: { card: 'game-export' } }, h('div', { class: 'gt' }, 'Game pack'),
    h('div', { class: 'srow', dataset: { key: 'tools.gamepack.export' } },
      h('span', { class: 'lb' }, h('b', 'Export settings'), h('small', state.note || 'Your money and level cap, saved as a game pack file')),
      h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2', disabled: state.busy === true, onClick: () => state.run() }, 'Export as a game pack'))));
}

/** Saves `text` as a file through the page's download link, then releases its temporary URL. */
export function saveGamePack(doc, text, name) {
  const win = doc.defaultView ?? globalThis;
  const url = win.URL.createObjectURL(new win.Blob([text], { type: 'application/json;charset=utf-8' }));
  const link = doc.createElement('a');
  link.href = url;
  link.download = name;
  link.hidden = true;
  doc.body.appendChild(link);
  try { link.click(); } finally { link.remove(); setTimeout(() => win.URL.revokeObjectURL(url), 1000); }
}
