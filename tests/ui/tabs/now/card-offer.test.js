import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/ui-fake-dom.js';
import { rightNow } from '../../../../ui/tabs/now/right-now.js';
import { offerRows, waitingCount } from '../../../../ui/select/offers.js';
import { selectNow } from '../../../../ui/select/now.js';
import { selectInlineRow } from '../../../../ui/select/chat.js';
import { createSbPort } from '../../../../ui/port/sb-port.js';
import { checkShape } from '../../../../ui/contract/shapes.js';
import { NOW_SHAPE } from '../../../../ui/contract/now.js';

const item = (over = {}) => ({ id: 'o1', packId: 'p', name: 'Ersveil', version: '2.0.0', installedVersion: null, update: false, state: 'offer', result: '', brings: '12 cast', notes: [], blocked: false, settings: [{ text: 'Rules: Standard' }], ...over });
const fakeController = (items) => {
  const calls = [];
  const listeners = new Set();
  return { calls, offers: () => items, install: async (id, o) => { calls.push(['install', id, o]); return { ok: true, text: 'Installed' }; }, notNow: id => calls.push(['notNow', id]), dismiss: id => calls.push(['dismiss', id]), subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); }, listeners };
};
const ctxFor = controller => ({ port: createSbPort({ sdk: {}, offer: () => controller }), go() {} });

test('an offer shows in Needs you with the count, and no offer leaves the card as before', () => {
  installFakeDom();
  const rows = offerRows(fakeController([item()]));
  const [needs] = rightNow({ needsYou: [], offers: rows }, {});
  assert.equal(needs.querySelector('.cnt').textContent, '1');
  assert.match(needs.textContent, /This card brings Ersveil 2\.0\.0/);
  assert.deepEqual(rightNow({ needsYou: [], offers: [] }, {}), []);
  assert.deepEqual(checkShape({ ...baseNow(), offers: rows }, NOW_SHAPE), []);
});

function baseNow() {
  const vm = selectNow({}, {});
  return vm;
}

test('Install sends the ticked state; unticking survives a redraw; Not now and Dismiss reach the controller', async () => {
  installFakeDom();
  const c = fakeController([item()]);
  const ctx = ctxFor(c);
  const draw = () => rightNow({ needsYou: [], offers: offerRows(c) }, ctx)[0];
  let node = draw();
  const box = node.querySelector('input');
  box.checked = false;
  box.dispatchEvent({ type: 'change' });
  node = draw();
  assert.equal(node.querySelector('input').hasAttribute('checked'), false, 'a redraw does not tick it again');
  const [install, later] = node.querySelectorAll('.offer .btn2');
  install.click();
  later.click();
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(c.calls, [['install', 'o1', { settings: false }], ['notNow', 'o1']]);
  const done = rightNow({ needsYou: [], offers: offerRows(fakeController([item({ state: 'done', result: 'Installed Ersveil.' })])) }, ctx)[0];
  assert.equal(done.querySelector('.cnt'), null);
  done.querySelector('.btn2').click();
  await new Promise(r => setTimeout(r, 0));
});

test('the chat chip counts waiting offers; with none it is unchanged; the selector never refreshes the card', () => {
  const rows = offerRows(fakeController([item(), item({ id: 'o2', state: 'done' })]));
  assert.equal(waitingCount(rows), 1);
  assert.deepEqual(selectInlineRow({}, { offers: rows }).needsYou, { n: 1, title: '1 pack offer' });
  assert.equal(selectInlineRow({}, {}).needsYou, null);
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
