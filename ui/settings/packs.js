// Renders the Packs and trackers page: installed packs with a remove confirmation, data modules and this chat's trackers.
import { h } from '../kit/dom.js';
import { toggle } from '../kit/controls.js';
import { renderV4 } from './packs-v4.js';

function group(title, ...rows) {
  return h('div', { class: 'sgrp' }, h('div', { class: 'gt' }, title), rows);
}

function line(name, desc, ...ctl) {
  return h('div', { class: 'srow' }, h('span', { class: 'lb' }, h('b', name), h('small', desc)), h('span', { class: 'ctl' }, ctl));
}

function switchLine(item, onChange) {
  const sw = toggle({ checked: item.on, label: item.name, disabled: item.locked === true, onChange: v => onChange(`packs.module.${item.id ?? item.name}`, v) });
  const row = h('div', { class: ['srow', 'swrow'] }, h('span', { class: 'lb' }, h('b', item.name), h('small', item.desc)), h('span', { class: 'ctl' }, sw));
  row.addEventListener('click', (e) => { if (!e.target.closest('button')) sw.click(); });
  return row;
}

function packBlock(pack, state) {
  const { confirming, setConfirm, change, act } = state;
  const key = pack.id ?? pack.name;
  const sw = toggle({ checked: pack.on, label: pack.name, onChange: v => change(`packs.on.${key}`, v) });
  const remove = h('button', { type: 'button', class: 'btn2 dng', onClick: () => setConfirm(!confirming) }, 'Remove');
  const name = pack.name.replace(/ \(.*$/, '');
  const confirm = confirming ? h('div', { class: 'cfm' }, h('b', `Remove ${name}?`),
    h('small', 'Its content leaves the game. Stories already told keep what they used from it.'),
    h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2 dng', onClick: () => { setConfirm(false); act('packs.remove', key); } }, 'Remove'),
      h('button', { type: 'button', class: 'btn2', onClick: () => setConfirm(false) }, 'Keep it'))) : null;
  return [line(pack.name, pack.desc, sw, remove), confirm];
}

// The picked files go to `act('packs.import', files)`: a pack.json with its images, or one .zip (the same picker the old panel has).
function importButton(act) {
  const file = h('input', { type: 'file', multiple: true, accept: '.json,application/json,.zip,application/zip,.webp,.png,.jpg,.jpeg,image/webp,image/png,image/jpeg', style: { display: 'none' }, 'aria-label': 'Pack file' });
  file.addEventListener('change', () => act('packs.import', Array.from(file.files ?? [])));
  return [h('button', { type: 'button', class: ['btn2', 'pri'], onClick: () => file.click() }, 'Import a pack file'), file];
}

/** The last import's words and the lines it ignored or refused (a status the reader can hear). */
function statusBlock(status) {
  if (!status?.text) return null;
  return h('div', { class: 'srow wide' }, h('span', { class: 'lb' }, h('b', { role: 'status' }, status.text), (status.errors ?? []).map(e => h('small', e))));
}

/**
 * Builds the Packs page body: `state` = { packs, status, confirming, setConfirm(bool), change(settingKey, on), act(key, value) }; the format 4 page (`packs.v4`) also takes
 * { kept, setKept(bool), removing, setRemoving(id) }. A format 4 page lists the worlds and games itself; the older packs keep their switch in their own group.
 */
export function renderPacks(state) {
  const { packs, change, act, status } = state;
  const btn = (label, key, pri) => h('button', { type: 'button', class: ['btn2', pri && 'pri'], onClick: () => act(key, label) }, label);
  const { trackers } = packs;
  const importRow = () => [statusBlock(status), h('div', { class: 'srow wide' }, h('span', { class: 'ctl' }, importButton(act), btn('Read from the character’s lorebook', 'packs.lorebook')))];
  const top = packs.v4
    ? [...renderV4(packs.v4, state, { group, importRow }), packs.packs.length ? group('Older packs (format 3)', packs.packs.map(p => packBlock(p, state))) : null]
    : [group('Packs', packs.packs.map(p => packBlock(p, state)), importRow())];
  return [
    ...top,
    group('Data modules in this chat', packs.modules.map(m => switchLine(m, change))),
    group(`Trackers in this chat · ${trackers.items.length} of ${trackers.cap}`,
      trackers.items.map(t => line(t.name, t.desc, h('button', { type: 'button', class: 'btn2', onClick: () => act('trackers.open', { edit: t.id }) }, 'Edit fields'))),
      h('div', { class: 'srow wide' }, h('span', { class: 'lb' }, h('small', 'A tracker is added from a template, then changed with Edit fields.')), h('span', { class: 'ctl' }, h('button', { type: 'button', class: ['btn2', 'pri'], onClick: () => act('trackers.open', { template: true }) }, 'Add from a template')))),
  ];
}
