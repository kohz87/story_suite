// Pick what you take on the live mount (the new view as SillyTavern mounts it, ui/entry/turn-on.js): the reply's row under the latest reply
// shows the loot chips, and Take selected there reaches the engine (the mount wires the row's onLootTake to `inventory.lootTake`).
import test from 'node:test';
import assert from 'node:assert/strict';
import { livePage, settle } from './helpers/live-page.js';

const CRATE = 'A crate.\n\n<Changes>\n? loot Torch x2, Rope — in the crate\n</Changes>';
const qty = (host, name) => (host.sdk.query('inventory.items') ?? []).filter(item => item.name === name).reduce((sum, item) => sum + item.qty, 0);

test('the mounted row takes the ticked loot through the engine and then says Taken', async t => {
  const { doc, host } = await livePage(t, { seed: 4801 });
  const mes = doc.createElement('div');
  mes.className = 'mes';
  doc.querySelector('#chat').appendChild(mes);
  await host.send('Search the crate.', CRATE);
  host.events.emit('head', { index: host.store.headIndex(), reason: 'test' });
  for (let n = 0; n < 4; n += 1) await settle();
  const row = () => doc.querySelector('#chat .mes .ssrow');
  assert.ok(row()?.querySelector('button[data-loot]'), 'the Loot chip is on the latest reply\'s row');
  row().querySelector('.lpchip[data-at="0"]').click();
  row().querySelector('.lptake').click();
  for (let n = 0; n < 6; n += 1) await settle();
  assert.deepEqual([qty(host, 'Torch'), qty(host, 'Rope')], [2, 0], 'the ticked thing is in the bag');
  host.events.emit('head', { index: host.store.headIndex(), reason: 'test' });
  for (let n = 0; n < 4; n += 1) await settle();
  assert.match(row().querySelector('.lootpk').textContent, /Taken\./);
});
