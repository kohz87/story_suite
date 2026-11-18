// A fight started from the standing-foes offer and discarded: the foes still stand, so the Fight tab stays with the offer, and a typed attack is held for the reader's choice again.
// The state after it is the same after a rebuild, a reload and a chat change (replay == live).
import test from 'node:test';
import assert from 'node:assert/strict';
import { livePage, settle } from './helpers/live-page.js';

const AMBUSH = 'Wolves close in.\n<Changes>\n+ dm foes — they ambush | kind: set-slot-2 | name: Wolves | count: 3 | level: 2\n</Changes>';
const tab = doc => doc.querySelector('.su-panel .fight-tab');
const strip = doc => Boolean(doc.querySelector('.su-strip .su-tab[data-tab="fight"]'));
const box = host => host.ctx.chatMetadata.storySuiteInteraction;

async function discarded(t, seed) {
  const page = await livePage(t, { seed });
  const { doc, host } = page;
  await host.send('I walk on.', AMBUSH);
  page.draw();
  host.events.emit('head', { index: host.store.headIndex(), reason: 'changed' });
  await settle();
  doc.querySelector('#story-suite-ui-menu')?.click(); await settle();
  doc.querySelector('.su-strip .su-tab[data-tab="fight"]').click(); await settle();
  tab(doc).querySelector('[data-offer="board"]').click(); await settle();
  assert.ok(box(host).open, 'the board is open');
  tab(doc).querySelector('[data-discard]').click(); await settle();
  assert.ok(box(host).open, 'the first press only asks');
  tab(doc).querySelector('[data-confirm="discard"]').click(); await settle();
  return page;
}

test('Discard on an offer-started fight puts the offer back: the Fight tab stays and the foes are offered again', async t => {
  const { doc, host } = await discarded(t, 4801);
  assert.equal(box(host)?.open, undefined, 'the fight is gone');
  assert.equal(host.ctx.chatMetadata.rpgFightOffers, undefined, 'the offer\'s choice mark is gone with it');
  assert.equal(strip(doc), true, 'the Fight tab stays while the foes stand');
  assert.equal(tab(doc)?.dataset.step, 'offer');
});

test('after that Discard a typed attack is held for the reader\'s choice, and the state is the same after a rebuild and a reload', async t => {
  const { host } = await discarded(t, 4802);
  host.st.addUser('I attack the wolves.');
  const held = await host.st.generate('normal', { reply: '' });
  assert.equal(held.aborted, true, 'the attack waits for Fight on the board / Auto-fight');
  const live = JSON.stringify(host.head());
  host.store.rebuild();
  assert.equal(JSON.stringify(host.head()), live, 'live == rebuild');
  await host.store.flush();
  const chat = structuredClone(host.ctx.chat), meta = structuredClone(host.ctx.chatMetadata);
  await host.st.loadChat(chat, 'discard-offer');
  host.ctx.chatMetadata = meta;
  assert.equal(JSON.stringify(host.head()), live, 'reload == live');
});
