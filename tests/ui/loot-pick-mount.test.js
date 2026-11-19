// Pick what you take on the live mount (the new view as SillyTavern mounts it, ui/entry/turn-on.js): the newest reply's card shows Pick up on
// its action line, and Take selected there reaches the engine (the mount wires the card's onLootTake to `inventory.lootTake`).
import test from 'node:test';
import assert from 'node:assert/strict';
import { livePage, settle } from './helpers/live-page.js';

const CRATE = 'A crate.\n\n<Changes>\n? loot Torch x2, Rope — in the crate\n</Changes>';
const qty = (host, name) => (host.sdk.query('inventory.items') ?? []).filter(item => item.name === name).reduce((sum, item) => sum + item.qty, 0);

test('the mounted card takes the ticked loot through the engine, and then has nothing left to pick up', async t => {
  const { doc, host } = await livePage(t, { seed: 4801 });
  const mes = doc.createElement('div');
  mes.className = 'mes';
  doc.querySelector('#chat').appendChild(mes);
  await host.send('Search the crate.', CRATE);
  mes.setAttribute('mesid', String(host.store.headIndex()));
  host.events.emit('head', { index: host.store.headIndex(), reason: 'test' });
  for (let n = 0; n < 4; n += 1) await settle();
  const row = () => doc.querySelector('#chat .mes .ssrc');
  assert.ok(row()?.querySelector('.ssrc-acts button[data-loot]'), 'Pick up is on the newest reply\'s action line');
  row().querySelector('button[data-loot]').click();
  row().querySelector('.lpchip[data-at="0"]').click();
  row().querySelector('.lptake').click();
  for (let n = 0; n < 6; n += 1) await settle();
  assert.deepEqual([qty(host, 'Torch'), qty(host, 'Rope')], [2, 0], 'the ticked thing is in the bag');
  host.events.emit('head', { index: host.store.headIndex(), reason: 'test' });
  for (let n = 0; n < 4; n += 1) await settle();
  assert.equal(row().querySelector('button[data-loot]'), null, 'taken: nothing left to pick up');
});
