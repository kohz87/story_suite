// The Tools page's NPC State data card: Back up, Restore and Diagnostics, the three dialogs NPC State keeps for this chat's people.
import { h } from '../kit/dom.js';

const ROWS = [
  ['tools.npcdata.backup', 'Back up', 'Back up this chat’s people', 'Saves a file with every dossier, portrait and the portrait settings of this chat'],
  ['tools.npcdata.restore', 'Restore', 'Restore people from a file', 'Opens a file made by Back up and shows what it holds before anything is changed'],
  ['tools.npcdata.diagnostics', 'Open', 'People diagnostics', 'What NPC State is sending to the narrator and how its last scans went'],
];

/** Builds the card. `state` = { note, ask(key) }: `note` is the last answer (why a dialog did not open), `ask` starts the dialog or download for a row's key. */
export function renderNpcData(state) {
  return h('div', { class: 'sgrp', dataset: { card: 'npc-data' } }, h('div', { class: 'gt' }, 'NPC State data'),
    ...ROWS.map(([key, button, label, hint]) => h('div', { class: 'srow', dataset: { key } },
      h('span', { class: 'lb' }, h('b', label), h('small', hint)),
      h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2', onClick: () => state.ask(key) }, button)))),
    state.note ? h('div', { class: 'srow', dataset: { note: 'npc-data' } }, h('span', { class: 'lb' }, h('small', state.note))) : null);
}
