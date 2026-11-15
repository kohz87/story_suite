// Renders the Packs and trackers page: installed packs with a remove confirmation, data modules and this chat's trackers.
import { h } from '../kit/dom.js';
import { toggle } from '../kit/controls.js';

function group(title, ...rows) {
  return h('div', { class: 'sgrp' }, h('div', { class: 'gt' }, title), rows);
}

function line(name, desc, ...ctl) {
  return h('div', { class: 'srow' }, h('span', { class: 'lb' }, h('b', name), h('small', desc)), h('span', { class: 'ctl' }, ctl));
}

function switchLine(item, onChange) {
  const sw = toggle({ checked: item.on, label: item.name, onChange: v => onChange(item.name, v) });
  const row = h('div', { class: ['srow', 'swrow'] }, h('span', { class: 'lb' }, h('b', item.name), h('small', item.desc)), h('span', { class: 'ctl' }, sw));
  row.addEventListener('click', (e) => { if (!e.target.closest('button')) sw.click(); });
  return row;
}

function packBlock(pack, state) {
  const { confirming, setConfirm, change, act } = state;
  const sw = toggle({ checked: pack.on, label: pack.name, onChange: v => change(pack.name, v) });
  const remove = h('button', { type: 'button', class: 'btn2 dng', onClick: () => setConfirm(!confirming) }, 'Remove');
  const name = pack.name.replace(/ \(.*$/, '');
  const confirm = confirming ? h('div', { class: 'cfm' }, h('b', `Remove ${name}?`),
    h('small', 'Its content leaves the game. Stories already told keep what they used from it.'),
    h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2 dng', onClick: () => { setConfirm(false); act('packs.remove', pack.name); } }, 'Remove'),
      h('button', { type: 'button', class: 'btn2', onClick: () => setConfirm(false) }, 'Keep it'))) : null;
  return [line(pack.name, pack.desc, sw, remove), confirm];
}

/** Builds the Packs page body: `state` = { packs, confirming, setConfirm(bool), change(name, on), act(key, name) }. */
export function renderPacks(state) {
  const { packs, change, act } = state;
  const btn = (label, key, pri) => h('button', { type: 'button', class: ['btn2', pri && 'pri'], onClick: () => act(key, label) }, label);
  const { trackers } = packs;
  return [
    group('Packs', packs.packs.map(p => packBlock(p, state)),
      h('div', { class: 'srow wide' }, h('span', { class: 'ctl' }, btn('Import a pack file', 'packs.import', true), btn('Read from the character’s lorebook', 'packs.lorebook')))),
    group('Data modules in this chat', packs.modules.map(m => switchLine(m, change))),
    group(`Trackers in this chat · ${trackers.items.length} of ${trackers.cap}`,
      trackers.items.map(t => line(t.name, t.desc, btn('Edit fields', `trackers.edit:${t.name}`))),
      h('div', { class: 'srow wide' }, h('span', { class: 'ctl' }, btn('New tracker', 'trackers.new', true), btn('From a template', 'trackers.template'), btn('Build it in the chat', 'trackers.chat')))),
  ];
}
