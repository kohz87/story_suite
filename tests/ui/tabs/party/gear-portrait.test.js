// The Party tab's worn-slot sheet has the piece's Stats row and Change (the Bag's repoint edit), and the paper-doll's centre circle is the member's portrait.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/ui-fake-dom.js';
import { partyFixture } from '../../../../ui/fixtures/party.js';
import { BAG } from '../../../../ui/fixtures/bag.js';
import { createFakePort } from '../../../../ui/port/fake-port.js';
import { createBackStack } from '../../../../ui/runtime/back-stack.js';
import { slotSheet } from '../../../../ui/tabs/party/slot-picker.js';
import { slotsDoll } from '../../../../ui/tabs/party/slots.js';
import { selectParty } from '../../../../ui/select/party.js';
import { partyPortraits } from '../../../../ui/select/gather.js';
import { flush, commands, sheetEl } from './helpers.js';

function ctxWith(extra) {
  installFakeDom();
  const party = partyFixture({ members: 4 });
  const bag = structuredClone(BAG);
  bag.items = bag.items.map(item => (item.stack === 'oak-round-shield' ? { ...item, ...extra } : item));
  return { party, port: createFakePort({ views: { party, bag } }), backStack: createBackStack(), go: () => {} };
}

test('worn slot sheet: Stats row with Change; the picker sends the repoint edit and closes the sheet', async () => {
  const ctx = ctxWith({ repoint: { budget: 2, stats: { VIT: 2 } } });
  slotSheet(ctx.party.members[0], 'offhand', ctx);
  assert.match(sheetEl().querySelector('.ps-kv').textContent, /Stats\+2 VITChange/);
  sheetEl().querySelector('[data-change="stats"]').click();
  const view = sheetEl().querySelector('[data-form="item-stats"]');
  assert.match(view.textContent, /Oak round shield · Stats/);
  view.querySelector('[data-minus="VIT"]').click();
  view.querySelector('[data-plus="CHA"]').click();
  view.querySelector('[data-save="stats"]').click();
  await flush();
  assert.deepEqual(commands(ctx.port), [['inventory.edit', { stack: 'oak-round-shield', stats: { VIT: 1, CHA: 1 } }]]);
  assert.equal(sheetEl(), null);
});

test('worn slot sheet: Cancel goes back to the slot view; a piece with no points to move shows the engine\'s reason', async () => {
  const ctx = ctxWith({ repoint: { budget: 1, stats: { VIT: 1 } } });
  slotSheet(ctx.party.members[0], 'offhand', ctx);
  sheetEl().querySelector('[data-change="stats"]').click();
  sheetEl().querySelector('[data-cancel="stats"]').click();
  assert.notEqual(sheetEl().querySelector('[data-unequip]'), null, 'back to the worn piece');
  const bound = ctxWith({ bound: true });
  bound.port.command = async (type, payload) => ({ ok: false, message: 'Mara keeps this piece as it is.', type, payload });
  slotSheet(bound.party.members[0], 'offhand', bound);
  sheetEl().querySelector('[data-change="stats"]').click();
  await flush();
  assert.equal(sheetEl().querySelector('.gst-why').textContent, 'Mara keeps this piece as it is.');
});

const reader = (people, pcId = 'ac_you') => name => (name === 'people.list' ? people : name === 'party.pc' ? { id: pcId } : null);
const ACTORS = [{ id: 'ac_you', name: 'Astra' }, { id: 'ac_mara', name: 'Mara' }, { id: 'ac_tor', name: 'Torka' }];

test('portraits: You = the people row of the party name, else the persona avatar; a companion = their people row (name or alias); none = left out', () => {
  const ctx = () => ({ name1: 'Astra', user_avatar: 'astra face.png' });
  assert.deepEqual(partyPortraits(reader([{ name: 'Mara', portrait: '/img/mara.png' }]), ctx, ACTORS),
    { ac_you: '/User%20Avatars/astra%20face.png', ac_mara: '/img/mara.png' });
  assert.deepEqual(partyPortraits(reader([{ name: 'Astra', portrait: '/img/a.png' }, { name: 'T.', aliases: ['torka'], portrait: '/img/t.png' }]), ctx, ACTORS),
    { ac_you: '/img/a.png', ac_tor: '/img/t.png' });
  assert.deepEqual(partyPortraits(reader([]), () => ({}), ACTORS), {});
});

test('selectParty puts the portrait on the member (a sheet row\'s own wins), and the doll draws it, the initial only as the fallback', () => {
  installFakeDom();
  const vm = selectParty({ actors: ACTORS, pc: { id: 'ac_you' }, portraits: { ac_you: '/User%20Avatars/a.png', ac_mara: '/img/mara.png' }, sheet: [{ id: 'ac_mara', portrait: '/img/own.png' }] });
  assert.deepEqual(vm.members.map(m => m.portrait), ['/User%20Avatars/a.png', '/img/own.png', null]);
  const doll = member => slotsDoll(member, {}).querySelector('.big');
  assert.equal(doll(vm.members[0]).styleProps['background-image'], 'url("/User%20Avatars/a.png")');
  assert.equal(doll(vm.members[0]).textContent, '');
  assert.equal(doll(vm.members[2]).textContent, 'T', 'no portrait: the initial');
  assert.equal(selectParty({ actors: ACTORS }).members[0].portrait, null, 'no portraits given: null as before');
});
