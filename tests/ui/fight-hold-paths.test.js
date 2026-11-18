// More ways into and out of the waiting fight on the live mount: the RPG screens loaded after the view, a reload into the pause (offer and board), Send from the
// chat while the suite is closed, Auto-fight on a known-foe pause, and a real pre-check's pause answered with Keep telling the story.
import test from 'node:test';
import assert from 'node:assert/strict';
import { livePage, holdFight, settle } from './helpers/live-page.js';
import { createFakeModel } from '../../testkit/model.js';
import { CORE_FEATURE } from '../../core/features.js';

const tab = doc => doc.querySelector('.su-panel .fight-tab');
const listed = doc => Boolean(doc.querySelector('.su-strip .su-tab[data-tab="fight"]'));
const box = host => host.ctx.chatMetadata.storySuiteInteraction;
const layer = doc => doc.querySelector('.su-layer').getAttribute('data-state');
const settled = async () => { for (let n = 0; n < 6; n += 1) await settle(); };

test('the RPG screens loading after the view: the waiting fight is listed once the pause can be read', async t => {
  const { doc, host } = await livePage(t, { seed: 4801 });
  holdFight(host);
  await settled();
  assert.equal(listed(doc), true);
  host.features.set(CORE_FEATURE.leanRpg, false);
  await settled();
  assert.equal(listed(doc), false, 'RPG off: no pause to read, no Fight tab');
  host.features.set(CORE_FEATURE.leanRpg, true);   // the screens load again, after the feature event the view heard
  await settled();
  assert.equal(listed(doc), true, 'listed again when the pause can be read');
});

test('a reload into a waiting fight shows its offer; a reload with the board chosen shows the board, its Send still the pause\'s', async t => {
  const { doc, host } = await livePage(t, { seed: 4802 });
  holdFight(host);
  await settled();
  const reload = async () => { const chat = structuredClone(host.ctx.chat), meta = structuredClone(host.ctx.chatMetadata); await host.st.loadChat(chat, 'again'); host.ctx.chatMetadata = meta; host.events.emit('head', { index: host.store.headIndex(), reason: 'chat' }); await settled(); };
  await reload();
  assert.equal(listed(doc), true);
  doc.querySelector('.su-strip .su-tab[data-tab="fight"]').click();
  await settled();
  assert.equal(tab(doc).dataset.step, 'offer', 'the offer after a reload');
  tab(doc).querySelector('[data-offer="board"]').click();
  await settled();
  await reload();
  doc.querySelector('.su-strip .su-tab[data-tab="fight"]').click();
  await settled();
  assert.equal(tab(doc).dataset.step, 'choose', 'the board after a reload');
  tab(doc).querySelector('[data-discard]').click();
  tab(doc).querySelector('[data-confirm="discard"]').click(); // (Discard asks first)
  await settled();
  assert.equal(box(host).start?.choice, null, 'Discard still answers the pause (the offer is back)');
});

test('Send from the chat while the suite is closed and the message waits opens the new view\'s Fight tab', async t => {
  const { doc, host } = await livePage(t, { seed: 4803 });
  holdFight(host);
  await settled();
  doc.querySelector('.su-dim').click();
  assert.equal(layer(doc), 'closed');
  const sendBut = doc.createElement('div');
  sendBut.id = 'send_but';
  doc.body.appendChild(sendBut);
  const event = { type: 'click', target: sendBut, preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {} };
  for (const entry of doc.listeners.filter(item => item.type === 'click' && item.capture)) entry.fn(event);   // the pause's own Send catch (capture, on the page)
  await settled();
  assert.equal(layer(doc), 'open');
  assert.equal(doc.querySelector('.su-panel').getAttribute('data-tab'), 'fight');
});

test('Auto-fight on a known-foe pause plays the board in the new view, as the old pause\'s Auto does', async t => {
  const { doc, host } = await livePage(t, { seed: 4804 });
  holdFight(host);
  await settled();
  tab(doc).querySelector('[data-offer="auto"]').click();
  await settled();
  assert.equal(box(host).start?.choice, 'board');
  assert.ok(box(host).open.steps.length > 0, 'exchanges were played');
  assert.ok(['after', 'end'].includes(tab(doc).dataset.step), `the board after Auto (${tab(doc).dataset.step})`);
});

test('a real pre-check\'s pause offers Keep telling the story; it sends the message without a fight and closes the view', async t => {
  const groups = JSON.stringify({ groups: [{ name: 'Rat-catcher', count: 1, level: 1, tier: 'minion' }] });
  const callModel = createFakeModel([], { fallback: 'none' });
  const answer = call => (/enemy groups/i.test(String(call?.prompt ?? '')) ? groups : 'none');
  callModel.push(...Array.from({ length: 20 }, () => answer));
  const { doc, host, replied } = await livePage(t, { seed: 4805, callModel, reply: 'He runs.' });
  await host.sdk.command('dm.set', { module: 'pack.chat/foes', fields: { foe1: '', count1: 0 } });
  const sending = host.send('A rat-catcher blocks the gate. I draw my blade and attack him.', 'Never told.');
  sending.catch(() => {});
  await sending.catch(() => {});
  await settled();
  const start = box(host)?.start;
  assert.ok(start?.opening, 'the pre-check found the foe and recorded its opening');
  assert.equal(tab(doc)?.dataset.step, 'offer');
  assert.deepEqual(tab(doc).querySelectorAll('[data-offer]').map(b => b.dataset.offer), ['board', 'auto', 'story']);
  assert.match(tab(doc).querySelector('.foes-card').textContent, /Rat-catcher/);
  tab(doc).querySelector('[data-offer="story"]').click();
  await settled();
  await replied();
  await settled();
  assert.equal(host.ctx.chat.at(-1).mes, 'He runs.', 'the message went out');
  assert.equal(host.store.receipts().some(entry => entry.receipt.type === 'interaction.settle'), false, 'without a fight');
  assert.equal(layer(doc), 'closed');
  assert.equal(listed(doc), false);
});
