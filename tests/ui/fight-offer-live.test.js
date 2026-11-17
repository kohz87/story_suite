// Foes left standing without the reader's attack (an ambush, a standoff), on the live mount: the old view's offer line and the new view's Needs-you card and
// Fight tab offer come from the same RPG offer, and the answers (board, auto) are the old line's own choose (replay == live).
import test from 'node:test';
import assert from 'node:assert/strict';
import { livePage, settle } from './helpers/live-page.js';

const AMBUSH = 'Wolves close in.\n<Changes>\n+ dm foes — they ambush | kind: set-slot-2 | name: Wolves | count: 3 | level: 2\n</Changes>';
const tab = doc => doc.querySelector('.su-panel .fight-tab');
const strip = doc => Boolean(doc.querySelector('.su-strip .su-tab[data-tab="fight"]'));
const line = doc => Boolean(doc.querySelector('.rpg-fight-offer'));
const box = host => host.ctx.chatMetadata.storySuiteInteraction;

// The page draws the chat's messages (the fake page does not): the old line sits under the reply that set the foes.
async function redraw(page) {
  page.draw();
  page.host.events.emit('head', { index: page.host.store.headIndex(), reason: 'changed' });
  await settle();
}
async function ambushed(t, seed) {
  const page = await livePage(t, { seed });
  await page.host.send('I walk on.', AMBUSH);
  await redraw(page);
  return page;
}
// The old line and the new view's offer are one: both stand or both are gone.
const agree = (doc, why) => assert.equal(strip(doc), line(doc), `old line and new offer agree: ${why}`);
const openOn = async (doc, name) => { doc.querySelector('#story-suite-ui-menu')?.click(); await settle(); doc.querySelector(`.su-strip .su-tab[data-tab="${name}"]`).click(); await settle(); };

test('an ambush with no attack: the new view has the Needs-you card on Now and the offer on its Fight tab, with the old line\'s two choices', async t => {
  const { doc, host } = await ambushed(t, 4701);
  assert.ok(line(doc), 'the RPG makes its offer under the reply (the new view hides that line with CSS)');
  assert.ok(strip(doc), 'the Fight tab is listed');
  await openOn(doc, 'now');
  const need = [...doc.querySelectorAll('.su-panel .rnr[data-go="fight"]')].find(el => /Foes are standing/.test(el.textContent));
  assert.ok(need, 'a Needs-you card for the standing foes');
  assert.match(need.textContent, /Wolves/);
  await openOn(doc, 'fight');
  const root = tab(doc);
  assert.equal(root.dataset.step, 'offer');
  assert.deepEqual(root.querySelectorAll('[data-offer]').map(b => b.dataset.offer), ['board', 'auto'], 'the old line\'s two choices; no story button (nothing is held back)');
  assert.match(root.querySelector('[data-card="offer"] .otext').textContent, /Four foes stand in your way\. Choose each exchange on the board, let the code fight it out\.$/);
  assert.match(root.querySelector('.foes-card').textContent, /Wolves/);
  assert.equal(host.ctx.chatMetadata.rpgFightOffers, undefined, 'looking records nothing');
});

test('Fight on the board opens the board and marks the offer done, as the old line\'s button does; Auto-fight plays it', async t => {
  const viaNew = await ambushed(t, 4702);
  await openOn(viaNew.doc, 'fight');
  tab(viaNew.doc).querySelector('[data-offer="board"]').click();
  await settle();
  const sid = Object.keys(viaNew.host.ctx.chatMetadata.rpgFightOffers ?? {});
  assert.equal(sid.length, 1, 'the offer is marked chosen on its reply');
  assert.ok(box(viaNew.host).open, 'the board is open');
  assert.notEqual(tab(viaNew.doc)?.dataset.step, 'offer', 'the Fight tab is the board now');
  assert.equal(line(viaNew.doc), false, 'the old line is gone');

  const viaOld = await ambushed(t, 4702);
  viaOld.doc.querySelector('.rpg-fight-offer-fight').click();
  await settle();
  assert.deepEqual(viaNew.host.ctx.chatMetadata.rpgFightOffers, viaOld.host.ctx.chatMetadata.rpgFightOffers, 'the same mark');
  assert.deepEqual(box(viaNew.host), box(viaOld.host), 'the same board');

  const auto = await ambushed(t, 4703);
  await openOn(auto.doc, 'fight');
  tab(auto.doc).querySelector('[data-offer="auto"]').click();
  await settle();
  const old = await ambushed(t, 4703);
  old.doc.querySelector('.rpg-fight-offer-auto').click();
  await settle();
  assert.deepEqual(box(auto.host), box(old.host), 'Auto-fight: the same board');
});

test('swipe, swipe back, an edited Re-read, a middle delete, rewind and a chat change: the new offer follows the old line', async t => {
  const page = await ambushed(t, 4704);
  const { host, doc } = page;
  const at = host.ctx.chat.length - 1, text = host.ctx.chat[at].mes;
  agree(doc, 'first');
  await host.swipe('Another telling, no foes.');
  await redraw(page);
  agree(doc, 'swipe');
  await host.st.swipeTo(at, 0);
  await redraw(page);
  assert.equal(strip(doc), true, 'swipe back: the offer is back');
  agree(doc, 'swipe back');
  await host.st.editMessage(at, `${text} More wolves circle the camp.`);
  assert.equal((await host.sdk.reread(at)).ok, true);
  await redraw(page);
  agree(doc, 'Re-read grown');
  await host.st.editMessage(at, 'Done.');
  assert.equal((await host.sdk.reread(at)).ok, true);
  await redraw(page);
  agree(doc, 'Re-read shrunk');
  await host.st.editMessage(at, text);
  assert.equal((await host.sdk.reread(at)).ok, true);
  await redraw(page);
  assert.equal(strip(doc), true, 'the original text again: the offer');
  agree(doc, 'Re-read restored');
  // the offer chosen, then a reply that follows: the choice stays with its reply
  await openOn(doc, 'fight');
  tab(doc).querySelector('[data-offer="board"]').click();
  await settle();
  await host.send('Later.', 'A later reply.');
  await redraw(page);
  assert.equal(line(doc), false, 'chosen: the line stays gone after a later reply');
  await host.st.deleteMessage(host.ctx.chat.length - 1);
  await host.st.deleteMessage(host.ctx.chat.length - 1);
  await redraw(page);
  assert.equal(line(doc), false, 'middle delete: the choice stays with its reply');
  await host.st.loadChat([{ is_user: false, name: 'Narrator', mes: 'Elsewhere.', extra: {} }], 'other');
  host.ctx.chatMetadata = {};
  host.events.emit('head', { index: host.store.headIndex(), reason: 'chat' });
  await redraw(page);
  agree(doc, 'chat change');
  assert.equal(strip(doc), false, 'another chat: no offer, no Fight tab');
});
