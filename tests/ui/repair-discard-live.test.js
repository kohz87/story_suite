// "Discard repair" on the live mount (the new view on the old host, as SillyTavern mounts it): a reply that came with no block is repaired (on by default); its
// ✦ sheet marks the repaired lines as Assist's and offers one Discard repair; pressing it takes the lines out, closes the sheet, reads the reply again, and the repair
// is not asked again for that reply, not by a Re-read nor by a reload.
import test from 'node:test';
import assert from 'node:assert/strict';
import { livePage, settle } from './helpers/live-page.js';
import { repairState } from '../../core/capture.js';

const ANSWER = '<Changes>\n+ item Rope | qty: 1\n- coin 5 | to: Bob\n</Changes>';

test('the reply sheet of a repaired reply marks its lines as Assist and Discard repair takes them out for good', async t => {
  const calls = [];
  const { doc, host } = await livePage(t, { seed: 4701, callModel: async prompt => { calls.push(prompt); return ANSWER; } });
  host.ctx.extensionSettings.storySuite.modules['story-block'].assistRepair = true;   // (the test host starts with it off; the real default is on, see tests/modules/assist/repair-discard.test.js)
  const chat = doc.querySelector('#chat');
  const mes = doc.createElement('div');
  mes.className = 'mes';
  const bar = doc.createElement('div');
  bar.className = 'extraMesButtons';
  mes.appendChild(bar);
  chat.appendChild(mes);
  const rope = () => (host.sdk.query('inventory.items') ?? []).filter(item => item.name === 'Rope').reduce((sum, item) => sum + item.qty, 0);
  const ropeBefore = rope();
  const repairs = () => calls.filter(p => /should have ended with a block of change lines/.test(p)).length;
  const before = repairs();
  const turn = await host.send('I pay Bob and take a rope.', 'You pay Bob five coins and take a rope.');
  for (let n = 0; n < 6; n += 1) await settle();
  assert.equal(repairs() - before, 1, 'repaired once');
  assert.equal(rope(), ropeBefore + 1);
  assert.equal(repairState(host.ctx.chat[turn.index].mes), 'repaired');
  host.events.emit('head', { index: host.store.headIndex(), reason: 'test' });
  await settle();
  const button = doc.querySelector('.extraMesButtons .xbt.ss');
  assert.ok(button, 'the ✦ button is drawn');
  button.click();
  const sheet = doc.querySelector('.trsheet');
  assert.ok(sheet, 'the sheet opens');
  assert.ok(sheet.querySelectorAll('li small.as').length >= 1, 'a repaired line is marked Assist');
  const discard = sheet.querySelectorAll('button').find(b => b.textContent === 'Discard repair');
  assert.ok(discard, 'one Discard repair');
  discard.click();
  for (let n = 0; n < 6; n += 1) await settle();
  assert.equal(doc.querySelector('.trsheet'), null, 'the sheet closes');
  assert.equal(rope(), ropeBefore, 'the repaired lines are gone, the opening\'s stay');
  assert.equal(repairState(host.ctx.chat[turn.index].mes), 'discarded');
  await host.sdk.reread(turn.index);
  await host.turn.onChatChanged();
  for (let n = 0; n < 6; n += 1) await settle();
  assert.equal(repairs() - before, 1, 'not asked again by a Re-read or a reload');
  assert.equal(rope(), ropeBefore);
});
