// Bag data (G6): the purse's "this turn" list is the head reply's coin line, worded in the chat's currency; a swipe, swipe back, middle delete, rewind, reload and a Re-read (unedited, grown, shrunk) agree with live; with the reply's receipts gone the list is empty.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { createSbPort } from '../../ui/port/sb-port.js';
import { buildSelectors } from '../../ui/select/build.js';
import { BAG_SHAPE } from '../../ui/contract/bag.js';
import { checkShape } from '../../ui/contract/shapes.js';
import { purseLines } from '../../ui/select/purse-lines.js';

const said = (text, lines) => `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>`;
const settings = { modules: { 'story-block': { currency: 'penny', currencyPlural: 'pennies', coins: [{ name: 'penny', plural: 'pennies', value: 1 }, { name: 'silver', plural: 'silver', value: 10 }] } } };
const bagOf = host => createSbPort({ sdk: host.sdk, selectors: buildSelectors(() => null, host.sdk) }).view('bag');
const turnOf = host => bagOf(host).purse.thisTurn.map(row => `${row.delta}|${row.up}`);

async function story(t, opts = {}) {
  t.mock.method(console, 'warn', () => {});
  const host = await createHost(opts);
  t.after(() => host.close());
  await host.send('Begin.', said('The road.', ['+ coin 35']));
  await host.send('Buy.', said('A bargain.', ['- coin 12']));
  return host;
}

test('the head reply\'s coin line is the purse\'s this-turn list, in the currency\'s denominations, and fits BAG_SHAPE', async t => {
  const host = await story(t, { settings });
  const vm = bagOf(host);
  assert.deepEqual(checkShape(vm, BAG_SHAPE).filter(e => e.startsWith('purse')), []); // (the pace's null is the engine's, not the purse's)
  assert.deepEqual(vm.purse.thisTurn, [{ line: '', delta: '−1 silver 2 pennies', up: false, earlier: false }]);
  assert.equal(vm.purse.words, '2 silver 3 pennies');
  await host.send('More.', said('A gift.', ['+ coin 5']));
  assert.deepEqual(turnOf(host), ['+5 pennies|true']);
  await host.send('Quiet.', 'Nothing changes.');
  assert.deepEqual(turnOf(host), [], 'a reply with no coin gives an empty list');
});

test('a one-amount currency words the line plainly', async t => {
  const host = await story(t);
  assert.deepEqual(turnOf(host), ['−12 gold|false']);
});

test('replay is live: swipe, swipe back, rewind, reload, middle delete', async t => {
  const host = await story(t, { settings });
  assert.deepEqual(turnOf(host), ['−1 silver 2 pennies|false']);
  await host.swipe(said('Haggled.', ['- coin 3']));
  assert.deepEqual(turnOf(host), ['−3 pennies|false'], 'swipe');
  await host.swipe(said('A bargain.', ['- coin 12']));
  assert.deepEqual(turnOf(host), ['−1 silver 2 pennies|false'], 'swipe back');
  host.store.rebuild();
  assert.deepEqual(turnOf(host), ['−1 silver 2 pennies|false'], 'rebuild');
  await host.store.flush();
  const loaded = await createHost({ settings, st: { chat: structuredClone(host.ctx.chat), extensionSettings: structuredClone(host.ctx.extensionSettings) } });
  t.after(() => loaded.close());
  assert.deepEqual(turnOf(loaded), ['−1 silver 2 pennies|false'], 'reload');
  await host.st.deleteMessage(host.ctx.chat.length - 1);
  assert.deepEqual(turnOf(host), ['+3 silver 5 pennies|true'], 'rewind to the first reply');
  const again = await story(t, { settings });
  await again.st.deleteMessage(1);
  await again.st.deleteMessage(1);
  assert.deepEqual(turnOf(again), ['−1 silver 2 pennies|false'], 'a middle delete: the head reply keeps its own line');
});

test('a Re-read (unedited, grown, shrunk) gives the coin line its text has', async t => {
  const host = await story(t, { settings });
  const index = host.ctx.chat.length - 1;
  assert.equal((await host.sdk.reread(index)).ok, true);
  assert.deepEqual(turnOf(host), ['−1 silver 2 pennies|false'], 'unedited');
  await host.st.editMessage(index, said('A bargain.', ['- coin 12', '- coin 8']));
  assert.equal((await host.sdk.reread(index)).ok, true);
  assert.deepEqual(turnOf(host), ['−2 silver|false'], 'grown');
  await host.st.editMessage(index, 'Nothing now.');
  assert.equal((await host.sdk.reread(index)).ok, true);
  assert.deepEqual(turnOf(host), [], 'shrunk');
});

test('purseLines: coin lines only, assist lines marked, a bad line left out; with no answer it is empty', () => {
  const rows = [{ glyph: 'item', line: '+1 Rope' }, { glyph: 'coin', line: '+4', assist: false }, { glyph: 'coin', line: '−2', assist: true }, { glyph: 'coin', line: 'x' }];
  assert.deepEqual(purseLines({ lines: rows }, { name: 'mark', plural: 'marks' }), [{ line: '', delta: '+4 marks', up: true, earlier: false }, { line: '(assist)', delta: '−2 marks', up: false, earlier: false }]);
  assert.deepEqual(purseLines(null, null), []);
});
