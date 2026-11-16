// Contract: a real Story Block host (one-amount wallet) read through createSbPort + the bag selector fits BAG_SHAPE; selector errors reach onError.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { checkPort } from '../../ui/port/contract.js';
import { createSbPort } from '../../ui/port/sb-port.js';
import { buildSelectors } from '../../ui/select/build.js';
import { BAG_SHAPE } from '../../ui/contract/bag.js';
import { checkShape } from '../../ui/contract/shapes.js';
import { bagFixture } from '../../ui/fixtures/bag.js';

const reply = (text, lines) => `${text}\n\n<Changes>\n${lines.join('\n')}\n</Changes>`;

test('a real host with a one-amount wallet gives a Bag view that has a purse that fits BAG_SHAPE (coins null, words set)', async t => {
  t.mock.method(console, 'warn', () => {});
  const host = await createHost();
  t.after(() => host.close());
  await host.send('Hello.', reply('The road.', ['+ coin 40', '+ item Torch']));
  const port = createSbPort({ sdk: host.sdk, selectors: buildSelectors(() => null, host.sdk) });
  assert.equal(checkPort(port).ok, true);
  const vm = port.view('bag');
  assert.notEqual(vm, null);
  // Only the purse is G3's; other real-vs-shape gaps (item isNew/weight/soak/desc and pace null) are reported, not fixed here.
  assert.deepEqual(checkShape(vm, BAG_SHAPE).filter(e => e.startsWith('purse')), []);
  assert.equal(vm.purse.coins, null);
  assert.match(vm.purse.words, /40/);
});

test('the fake-port fixture and a one-amount purse both fit the shape; a shaped purse still does', () => {
  const one = bagFixture();
  one.purse = { coins: null, words: '40 marks' };
  assert.deepEqual(checkShape(one, BAG_SHAPE), []);
  one.purse = { coins: null, words: '40 marks', thisTurn: [], rates: null };
  assert.deepEqual(checkShape(one, BAG_SHAPE), []);
  assert.deepEqual(checkShape(bagFixture(), BAG_SHAPE), []);
});

test('feature off: with no engine answers the view is null so the card hides', () => {
  const port = createSbPort({ sdk: { query: () => null }, selectors: buildSelectors(() => null, null) });
  assert.equal(checkPort(port).ok, true);
  const vm = port.view('bag');
  assert.ok(vm === null || (vm.load === null && vm.pace === null && vm.purse.coins === null));
});

test('a selector that throws is reported to onError once and the view stays null', () => {
  const seen = [];
  const port = createSbPort({ sdk: {}, selectors: { bag: () => { throw new Error('boom'); } }, onError: (tab, error) => seen.push([tab, error.message]) });
  assert.equal(port.view('bag'), null);
  assert.deepEqual(seen, [['bag', 'boom']]);
  const quiet = createSbPort({ sdk: {}, selectors: { bag: () => { throw new Error('x'); } }, onError: () => { throw new Error('listener'); } });
  assert.equal(quiet.view('bag'), null);
});
