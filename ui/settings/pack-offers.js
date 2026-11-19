// The card's pack offers at the top of Settings › Packs and trackers: what the card brings, the "Also apply" tick, Install or Update, and Not now.
import { h } from '../kit/dom.js';
import { glyph } from '../kit/glyphs.js';
import { toggle } from '../kit/controls.js';

// The "Also apply" boxes stay ticked until the reader unticks one; kept here, not in the drawn nodes, so a redraw does not tick it again.
const ticked = new Map();

function words(item) {
  if (item.state === 'done' || item.state === 'failed') return h('b', null, item.result);
  if (item.update) return [h('b', null, `A newer ${item.name}: ${item.version}`), h('small', null, `installed ${item.installedVersion}`)];
  return [h('b', null, `This card brings ${item.name} ${item.version}`), item.brings ? h('small', null, item.brings) : null];
}

function actionsOf(item, send) {
  const working = item.state === 'working';
  if (item.state === 'done' || item.state === 'failed') {
    return h('div', { class: 'offer' }, h('button', { type: 'button', class: 'btn2', onClick: () => send('dismiss', item.id) }, 'Dismiss'));
  }
  // (the words beside the switch flip it too, as a checkbox's label would: the switch is a button, so its words are a plain span that clicks it; SOAK2UI 18)
  const sw = item.settings.length ? toggle({ checked: ticked.get(item.id) !== false, disabled: working, label: `Also apply: ${item.settings.join(' · ')}`, onChange: on => ticked.set(item.id, on) }) : null;
  const tick = sw
    ? h('div', { class: 'rnr-tick' }, sw, h('span', { class: 'rnr-tick-t', 'aria-hidden': 'true', onClick: () => sw.click() }, `Also apply: ${item.settings.join(' · ')}`))
    : null;
  const install = h('button', { type: 'button', class: ['btn2', 'pri'], disabled: working || item.blocked, title: item.blocked ? item.notes[0] ?? '' : null, onClick: () => send('install', item.id, { settings: ticked.get(item.id) !== false }) }, item.update ? 'Update' : 'Install');
  const later = h('button', { type: 'button', class: 'btn2', disabled: working, onClick: () => send('notNow', item.id) }, 'Not now');
  return [tick, item.notes.map(note => h('small', { class: 'rnr-note' }, note)), h('div', { class: 'offer' }, install, later)];
}

/** One block per offer. `ctx.port.command('packs.offer', { op, id, settings })` carries the click to the controller (the same install, Not now and dismiss the old panel calls). */
export function offerBlocks(offers, ctx = {}) {
  const send = (op, id, extra) => ctx.port?.command?.('packs.offer', { op, id, ...extra });
  return offers.map(item => h(
    'div',
    { class: ['rnr', 'need-pack'], dataset: { pack: item.packId, state: item.state }, role: item.state === 'offer' ? 'group' : 'status', 'aria-label': `Card offer: ${item.name}` },
    h('span', { class: 'ti' }, glyph('info')),
    h('span', { class: 'rnr-text' }, words(item), actionsOf(item, send)),
  ));
}

/** The offers' group for the top of the Packs page; null when the card offers nothing. `send(payload)` carries `{ op, id, settings? }` to `packs.offer`. */
export function offerGroup(offers, send) {
  if (!offers?.length) return null;
  const ctx = { port: { command: (_type, payload) => send(payload) } };
  return h('div', { class: 'sgrp', dataset: { group: 'card-offers' } }, h('div', { class: 'gt' }, 'This card offers'), h('div', { class: 'rn2' }, offerBlocks(offers, ctx)));
}
