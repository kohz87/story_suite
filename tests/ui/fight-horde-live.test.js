// A horde from a typed attack, end to end on the live page: the real pre-check answers groups and horde words, the pause records them with its opening, "Fight on the board"
// opens the board with the reserve built by code, and the new view's Foes card draws the "still coming" strip.
import test from 'node:test';
import assert from 'node:assert/strict';
import { livePage, settle } from './helpers/live-page.js';
import { createFakeModel } from '../../testkit/model.js';

const tab = doc => doc.querySelector('.su-panel .fight-tab');
const box = host => host.ctx.chatMetadata.storySuiteInteraction;
const settled = async () => { for (let n = 0; n < 6; n += 1) await settle(); };

test('a typed attack on foes that keep coming opens a horde: the words recorded with the opening, the reserve built at open, the strip on the board', async t => {
  const answer = JSON.stringify({ groups: [{ name: 'Ghoul', count: 2, level: 1, tier: 'mob' }], horde: { waves: 3, until: 'hold', hold: 6 } });
  const callModel = createFakeModel([], { fallback: 'none' });
  callModel.push(...Array.from({ length: 20 }, () => call => (/enemy groups/i.test(String(call?.prompt ?? '')) ? answer : 'none')));
  const { doc, host } = await livePage(t, { seed: 4901, callModel, reply: 'They keep coming.' });
  await host.sdk.command('dm.set', { module: 'pack.chat/foes', fields: { foe1: '', count1: 0 } });
  const sending = host.send('The ghouls pour through the breach. I hold the gate and attack them.', 'Never told.');
  await sending.catch(() => {});
  await settled();
  const start = box(host)?.start;
  assert.deepEqual(start?.opening?.payload?.setup?.horde, { waves: 3, until: 'hold', hold: 6 }, 'the pause records the checked words with its opening');
  tab(doc).querySelector('[data-offer="board"]').click();
  await settled();
  const open = box(host)?.open;
  assert.ok(open, 'the board is open');
  const setup = JSON.stringify(box(host));
  assert.match(setup, /"horde":\{"v":1,"reserve":\[\{"name":"Ghoul","count":2,"level":1,"tier":"mob"\},\{"name":"Ghoul","count":2,"level":1,"tier":"mob"\}\],"hold":6\}/u, 'the reserve: the front twice more, and the hold');
  const strip = tab(doc).querySelector('.foes-card .horde');
  assert.ok(strip, 'the Foes card draws the strip');
  assert.equal(strip.querySelector('b').textContent, 'Wave 1 · 4 still coming');
  assert.match(strip.querySelector('.fine').textContent, /^Hold 6 more exchanges · 0 down so far$/u);
});
