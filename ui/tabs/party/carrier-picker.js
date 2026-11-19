// The Party paper-doll's Mount and Bag slot sheets: the mount a member rides or the bag they carry, and the party's mounts or
// bags to choose from (mounts.ride, inventory.bag), each one that cannot be chosen saying why; None frees the slot.
import { h } from '../../kit/dom.js';
import { glyph } from '../../kit/glyphs.js';
import { ownerOf } from '../../runtime/owner-id.js';
import { SLOT_META, openSheet } from './slot-picker.js';

const fold = text => String(text ?? '').trim().toLowerCase();
const tile = name => h('span', { class: 'ti' }, glyph(name));
const names = list => (list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`);
const paceText = row => [row.kind, row.pace ? `${row.pace} km/day` : ''].filter(Boolean).join(' · ');
const loadText = carry => (carry > 0 ? `+${carry} load` : 'Adds no load yet (Edit › Carries)');

// Sends one command; a refusal stays in the sheet with its reason, else the sheet closes.
async function send(ctx, sheet, note, type, payload) {
  const answer = await ctx.port?.command(type, payload);
  if (answer && answer.ok === false) { note.textContent = answer.message || 'That cannot be done.'; note.hidden = false; return; }
  sheet.close();
}

const button = (label, data, onClick, pri = false) => h('button', { type: 'button', class: ['ps-b', pri ? 'pri' : null], dataset: data, onClick }, label);

// Why this member cannot ride `row` ('' when they can): left behind, or no seat free.
function rideWhy(row, member) {
  if (!row.withParty) return `Not with the party: ${row.where || 'left behind'}.`;
  const others = row.riders.filter(name => fold(name) !== fold(member.name));
  return others.length >= row.count ? `Carries ${names(others)} already.` : '';
}

function mountRows(member, carriers, act) {
  const rows = carriers?.mounts ?? [];
  if (!carriers) return [h('p', { class: 'ps-p' }, 'Mounts show here when gear is on.')];
  if (!rows.length) return [h('p', { class: 'ps-p', dataset: { why: 'none' } }, 'The party has no mounts. A horse, mule or cart joins when the story gives you one.')];
  return rows.map(row => {
    const mine = row.riders.some(name => fold(name) === fold(member.name));
    const why = mine ? '' : rideWhy(row, member);
    const who = row.riders.length ? `ridden by ${names(row.riders)}` : 'free';
    return h('div', { class: 'ps-r', dataset: { mount: row.name } }, tile(/cart|wagon|carriage|coach|barrow|sledge/i.test(row.kind) ? 'cart' : 'mount'),
      h('span', null, h('b', null, row.name), h('small', null, [paceText(row), who].filter(Boolean).join(' · ')), why ? h('small', { class: 'ps-why', dataset: { why: 'mount' } }, why) : null),
      mine ? h('span', { class: 'ps-s' }, 'Riding') : h('button', { type: 'button', class: 'ps-b pri', dataset: { ride: row.name }, disabled: Boolean(why), onClick: () => act('mounts.ride', { who: member.name, mount: row.name }) }, 'Ride'));
  });
}

function bagRows(member, carriers, owner, act) {
  if (!carriers) return [h('p', { class: 'ps-p' }, 'Bags show here when gear is on.')];
  const rows = (carriers.packs ?? []).filter(row => !(row.owner === owner && row.bag));
  if (!rows.length) return [h('p', { class: 'ps-p', dataset: { why: 'none' } }, 'The party holds no other bag. A satchel, pack or sack shows here once you have one.')];
  return rows.map(row => {
    const why = row.bound && row.owner !== owner ? `Bound to ${row.bound}: it stays with them.` : '';
    const whose = row.bag ? `${row.by}'s bag` : row.owner === owner ? 'held' : `with ${row.by}`;
    return h('div', { class: 'ps-r', dataset: { pack: row.stack } }, tile('bagslot'),
      h('span', null, h('b', null, row.name), h('small', null, `${loadText(row.carry)} · ${whose}`), why ? h('small', { class: 'ps-why', dataset: { why: 'bag' } }, why) : null),
      h('button', { type: 'button', class: 'ps-b pri', dataset: { carry: row.stack }, disabled: Boolean(why), onClick: () => act('inventory.bag', { owner, stack: row.stack }) }, 'Carry'));
  });
}

function heldBlock(slotKey, item, act, payload) {
  if (!item) return [];
  const mount = slotKey === 'mount';
  return [
    h('div', { class: 'ps-i' }, tile(mount ? 'mount' : 'bagslot'),
      h('div', null, h('div', { class: 'ps-n ps-n2' }, item.name), h('div', { class: 'ps-s' }, mount ? paceText(item) : 'Carried as a bag'))),
    h('dl', { class: 'ps-kv' }, ...(mount ? [h('dt', null, 'Pace'), h('dd', null, item.pace ? `${item.pace} km/day` : '—')] : []),
      h('dt', null, mount ? 'Carries' : 'Adds'), h('dd', null, loadText(item.carry ?? 0))),
    h('div', { class: 'ps-row' }, button('None', { none: slotKey }, () => act(mount ? 'mounts.ride' : 'inventory.bag', payload))),
  ];
}

/** Opens the Mount or Bag sheet for one member; ctx = { port, backStack, go }. Returns the sheet handle. */
export function carrierSheet(member, slotKey, ctx = {}) {
  const meta = SLOT_META[slotKey];
  const item = member.slots.find(s => s.key === slotKey)?.item ?? null;
  const party = ctx.port?.view?.('party');
  const owner = ownerOf(member.id, party?.pcId);
  const mount = slotKey === 'mount';
  const sheet = openSheet(ctx, { title: `${member.name} · ${meta[1]}`, subtitle: item ? '' : mount ? 'Walks: rides no mount' : 'Carries no bag', tone: 'ps-slot' });
  const note = h('p', { class: 'ps-p ps-why', role: 'alert', hidden: true, dataset: { refused: '1' } });
  const act = (type, payload) => send(ctx, sheet, note, type, payload);
  const carriers = party?.carriers ?? null;
  sheet.body.replaceChildren(...[
    heldBlock(slotKey, item, act, mount ? { who: member.name, mount: null } : { owner, stack: null }),
    note,
    h('div', { class: 'ps-sec' }, mount ? 'The party\'s mounts' : 'The party\'s bags'),
    mount ? mountRows(member, carriers, act) : bagRows(member, carriers, owner, act),
    typeof ctx.go === 'function'
      ? h('div', { class: 'ps-row' }, h('button', { type: 'button', class: 'ps-b', dataset: { tabgo: 'bag' }, onClick: () => { sheet.close(); ctx.go('bag'); } }, 'Open Bag'))
      : null,
  ].flat().filter(Boolean));
  return sheet;
}
