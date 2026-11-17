// The card's pack offers inside the Needs you card: what the card brings, the "Also apply" tick, Install or Update, and Not now.
import { h } from '../../kit/dom.js';
import { glyph } from '../../kit/glyphs.js';

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
  const tick = item.settings.length
    ? h('label', { class: 'rnr-tick' },
      h('input', { type: 'checkbox', checked: ticked.get(item.id) !== false, disabled: working, onChange: e => ticked.set(item.id, e.target.checked) }),
      h('span', null, `Also apply: ${item.settings.join(' · ')}`))
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
