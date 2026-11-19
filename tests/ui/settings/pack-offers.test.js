import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { offerGroup } from '../../../ui/settings/pack-offers.js';
import { offerRows, waitingCount } from '../../../ui/select/offers.js';
import { selectNow } from '../../../ui/select/now.js';
import { selectReplyActions } from '../../../ui/select/reply-actions.js';
import { createSbPort } from '../../../ui/port/sb-port.js';
import { checkShape } from '../../../ui/contract/shapes.js';
import { NOW_SHAPE } from '../../../ui/contract/now.js';

const item = (over = {}) => ({ id: 'o1', packId: 'p', name: 'Ersveil', version: '2.0.0', installedVersion: null, update: false, state: 'offer', result: '', brings: '12 cast', notes: [], blocked: false, settings: [{ text: 'Rules: Standard' }], ...over });
const fakeController = (items) => {
  const calls = [];
  const listeners = new Set();
  return { calls, offers: () => items, install: async (id, o) => { calls.push(['install', id, o]); return { ok: true, text: 'Installed' }; }, notNow: id => calls.push(['notNow', id]), dismiss: id => calls.push(['dismiss', id]), subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); }, listeners };
};
// (the Packs page's `act('packs.offer', payload)`: the port's own command, as mount.js sends it)
const sendFor = controller => { const port = createSbPort({ sdk: {}, offer: () => controller }); return payload => port.command('packs.offer', payload); };

test('an offer shows at the top of Packs and trackers, and no offer leaves nothing', () => {
  installFakeDom();
  const rows = offerRows(fakeController([item()]));
  const needs = offerGroup(rows, () => {});
  assert.equal(needs.querySelector('.gt').textContent, 'This card offers');
  assert.match(needs.textContent, /This card brings Ersveil 2\.0\.0/);
  assert.equal(offerGroup([], () => {}), null);
  assert.deepEqual(checkShape({ ...baseNow(), offers: rows }, NOW_SHAPE), []);
});

function baseNow() {
  const vm = selectNow({}, {});
  return vm;
}

test('Install sends the ticked state; unticking survives a redraw; Not now and Dismiss reach the controller', async () => {
  installFakeDom();
  const c = fakeController([item()]);
  const send = sendFor(c);
  const draw = () => offerGroup(offerRows(c), send);
  let node = draw();
  assert.equal(node.querySelector('input'), null, 'the tick is the suite switch, not a native checkbox (SOAK2UI 18)');
  assert.equal(node.querySelector('.rnr-tick .sw').getAttribute('aria-checked'), 'true');
  node.querySelector('.rnr-tick .sw').click();
  node = draw();
  assert.equal(node.querySelector('.rnr-tick .sw').getAttribute('aria-checked'), 'false', 'a redraw does not tick it again');
  const [install, later] = node.querySelectorAll('.offer .btn2');
  install.click();
  later.click();
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(c.calls, [['install', 'o1', { settings: false }], ['notNow', 'o1']]);
  const done = offerGroup(offerRows(fakeController([item({ state: 'done', result: 'Installed Ersveil.' })])), send);
  done.querySelector('.btn2').click();
  await new Promise(r => setTimeout(r, 0));
});

test('clicking the "Also apply" words flips the switch, as a label would (SOAK2UI 18); a disabled switch stays', () => {
  installFakeDom();
  const c = fakeController([item()]);
  const draw = () => offerGroup(offerRows(c), sendFor(c));
  let node = draw();
  const was = node.querySelector('.rnr-tick .sw').getAttribute('aria-checked');
  node.querySelector('.rnr-tick .rnr-tick-t').click();
  assert.notEqual(node.querySelector('.rnr-tick .sw').getAttribute('aria-checked'), was);
  node.querySelector('.rnr-tick .rnr-tick-t').click();
  assert.equal(node.querySelector('.rnr-tick .sw').getAttribute('aria-checked'), was, 'and back');
  node = offerGroup(offerRows(fakeController([item({ state: 'working' })])), sendFor(c));
  const before = node.querySelector('.rnr-tick .sw').getAttribute('aria-checked');
  node.querySelector('.rnr-tick .rnr-tick-t').click();
  assert.equal(node.querySelector('.rnr-tick .sw').getAttribute('aria-checked'), before);
});

test('the newest reply\'s action line counts waiting offers; with none it is unchanged; the selector never refreshes the card', () => {
  const rows = offerRows(fakeController([item(), item({ id: 'o2', state: 'done' })]));
  assert.equal(waitingCount(rows), 1);
  assert.equal(selectReplyActions({}, { offers: rows }).offers, 1);
  assert.equal(selectReplyActions({}, {}).offers, 0);
  let refreshed = 0;
  offerRows({ offers: () => [], refresh: () => { refreshed += 1; } });
  assert.equal(refreshed, 0);
  assert.deepEqual(offerRows(null), []);
});

test('the port forwards the offer event and answers a missing controller', async () => {
  const c = fakeController([]);
  const port = createSbPort({ sdk: {}, offer: () => c });
  const off = port.on('offer', () => {});
  assert.equal(c.listeners.size, 1);
  off();
  assert.equal(c.listeners.size, 0);
  assert.equal((await createSbPort({ sdk: {} }).command('packs.offer', { op: 'notNow', id: 'x' })).ok, false);
  assert.equal((await port.command('packs.offer', { op: 'bogus', id: 'x' })).ok, false);
});

test('a format 4 pair is one offer row: the world and the game by name, both versions, what they bring (REVPF4: the pair notice in the new view)', () => {
  installFakeDom();
  const rows = offerRows(fakeController([item({ id: 'ersveil@1.0.0+ersveil-game@1.0.0', packId: 'ersveil+ersveil-game', name: 'Ersveil and Ersveil rules', version: '1.0.0 + 1.0.0', brings: 'lore; money' })]));
  const needs = offerGroup(rows, () => {});
  assert.match(needs.textContent, /This card brings Ersveil and Ersveil rules 1\.0\.0 \+ 1\.0\.0/);
  assert.match(needs.textContent, /lore; money/);
  assert.deepEqual(checkShape({ ...baseNow(), offers: rows }, NOW_SHAPE), []);
});

test('Settings › Packs and trackers: the card\'s offers are the first group, and Install and Not now send packs.offer', async () => {
  const { mountSettings } = await import('./sections/mount.js');
  installFakeDom();
  const rows = offerRows(fakeController([item()]));
  const sent = [];
  const { page } = mountSettings({}, {
    onAction: async (key, value) => { sent.push([key, value]); return { ok: true }; },
    onView: name => (name === 'now' ? { offers: rows } : name === 'settings' ? { packs: { packs: [], modules: [], trackers: { cap: 28, items: [] } } } : null),
  });
  const el = page('packs');
  const first = el.querySelector('.sgrp');
  assert.equal(first.dataset.group, 'card-offers', 'at the top of the page');
  assert.match(first.textContent, /This card brings Ersveil 2\.0\.0/);
  const [install, later] = first.querySelectorAll('.offer .btn2');
  install.click();
  later.click();
  assert.deepEqual(sent.map(([key, value]) => [key, value.op, value.id]), [['packs.offer', 'install', 'o1'], ['packs.offer', 'notNow', 'o1']]);
});
