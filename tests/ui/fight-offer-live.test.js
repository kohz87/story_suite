// Foes left standing without the reader's attack (an ambush, a standoff), on the live mount: the new view's Needs-you card and Fight tab offer come from the
// RPG offer (nothing is drawn under the reply), and the answers (board, auto) write what the earlier offer line wrote (captured values; replay == live).
import test from 'node:test';
import assert from 'node:assert/strict';
import { livePage, settle } from './helpers/live-page.js';

const AMBUSH = 'Wolves close in.\n<Changes>\n+ dm foes — they ambush | kind: set-slot-2 | name: Wolves | count: 3 | level: 2\n</Changes>';
const tab = doc => doc.querySelector('.su-panel .fight-tab');
const strip = doc => Boolean(doc.querySelector('.su-strip .su-tab[data-tab="fight"]'));
const line = doc => Boolean(doc.querySelector('.rpg-fight-offer'));
const BOARD = {"open":{"v":1,"id":"sw_33335aa3284a:0:story-block/fight","kindId":"story-block/fight","version":1,"origin":"sw_33335aa3284a","anchor":"sw_33335aa3284a","attempt":0,"seed":399224945,"offset":0,"setup":{"id":"sw_33335aa3284a:0","v1":1,"groups":[1,2],"offset":0,"rules":{"formula":"standard","foeBase":4,"foeClassWeight":3,"classWeight":2,"costMargin":2,"decisiveMargin":8,"roundCap":8,"startStat":5,"createPoints":10,"createMin":5,"createMax":10,"pointsPerSoul":4,"statMax":20,"quickStartMargin":10,"levelDivisor":5},"practice":3,"rate":100},"steps":[]}};
const AUTO_BOARD = {"open":{"v":1,"id":"sw_3540901e4b0a:0:story-block/fight","kindId":"story-block/fight","version":1,"origin":"sw_3540901e4b0a","anchor":"sw_3540901e4b0a","attempt":0,"seed":2124842544,"offset":0,"setup":{"id":"sw_3540901e4b0a:0","v1":1,"groups":[1,2],"offset":0,"rules":{"formula":"standard","foeBase":4,"foeClassWeight":3,"classWeight":2,"costMargin":2,"decisiveMargin":8,"roundCap":8,"startStat":5,"createPoints":10,"createMin":5,"createMax":10,"pointsPerSoul":4,"statMax":20,"quickStartMargin":10,"levelDivisor":5},"practice":3,"rate":100},"steps":[{"inputs":[{"choice":"auto","args":{},"actor":"ac_nf4fuziz"}]},{"inputs":[{"choice":"auto","args":{},"actor":"ac_nf4fuziz"}]},{"inputs":[{"choice":"auto","args":{},"actor":"ac_nf4fuziz"}]}],"witness":{"offset":0,"hash":"b23b07debd830e39aed7c794163e56def869de272174b40f927380a96379aa03"},"player":"ac_nf4fuziz","policy":{"choosers":"own","party":true}}};
const box = host => host.ctx.chatMetadata.storySuiteInteraction;

// The page draws the chat's messages (the fake page does not).
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
// The offer stands on the Fight tab (the foes are still standing after each swipe and edit; captured from the earlier line) and no line is drawn under the reply.
const agree = (doc, why, stands = true) => { assert.equal(strip(doc), stands, `the offer: ${why}`); assert.equal(line(doc), false, `no line under the reply: ${why}`); };
const openOn = async (doc, name) => { doc.querySelector('#story-suite-ui-menu')?.click(); await settle(); doc.querySelector(`.su-strip .su-tab[data-tab="${name}"]`).click(); await settle(); };

test('an ambush with no attack: the new view has the Needs-you card on Now and the offer on its Fight tab, with the offer\'s two choices', async t => {
  const { doc, host } = await ambushed(t, 4701);
  assert.equal(line(doc), false, 'nothing is drawn under the reply');
  assert.ok(strip(doc), 'the Fight tab is listed');
  await openOn(doc, 'now');
  const need = [...doc.querySelectorAll('.su-panel .rnr[data-go="fight"]')].find(el => /Foes are standing/.test(el.textContent));
  assert.ok(need, 'a Needs-you card for the standing foes');
  assert.match(need.textContent, /Wolves/);
  await openOn(doc, 'fight');
  const root = tab(doc);
  assert.equal(root.dataset.step, 'offer');
  assert.deepEqual(root.querySelectorAll('[data-offer]').map(b => b.dataset.offer), ['board', 'auto'], 'the offer\'s two choices; no story button (nothing is held back)');
  assert.match(root.querySelector('[data-card="offer"] .otext').textContent, /Four foes stand in your way\. Choose each exchange on the board, let the code fight it out\.$/);
  assert.match(root.querySelector('.foes-card').textContent, /Wolves/);
  assert.equal(host.ctx.chatMetadata.rpgFightOffers, undefined, 'looking records nothing');
});

test('Fight on the board opens the board and marks the offer done, as the earlier line\'s button did; Auto-fight plays it', async t => {
  const viaNew = await ambushed(t, 4702);
  await openOn(viaNew.doc, 'fight');
  tab(viaNew.doc).querySelector('[data-offer="board"]').click();
  await settle();
  const sid = Object.keys(viaNew.host.ctx.chatMetadata.rpgFightOffers ?? {});
  assert.equal(sid.length, 1, 'the offer is marked chosen on its reply');
  assert.ok(box(viaNew.host).open, 'the board is open');
  assert.notEqual(tab(viaNew.doc)?.dataset.step, 'offer', 'the Fight tab is the board now');

  assert.deepEqual(viaNew.host.ctx.chatMetadata.rpgFightOffers, { sw_33335aa3284a: true }, 'the same mark');
  assert.deepEqual(box(viaNew.host), BOARD, 'the same board');

  const auto = await ambushed(t, 4703);
  await openOn(auto.doc, 'fight');
  tab(auto.doc).querySelector('[data-offer="auto"]').click();
  await settle();
  assert.deepEqual(box(auto.host), AUTO_BOARD, 'Auto-fight: the same board');
});

test('swipe, swipe back, an edited Re-read, a middle delete, rewind and a chat change: the offer follows', async t => {
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
  assert.equal(tab(doc)?.dataset.step, 'choose', 'chosen: the board stays on its Fight tab after a later reply');
  assert.equal(line(doc), false);
  await host.st.deleteMessage(host.ctx.chat.length - 1);
  await host.st.deleteMessage(host.ctx.chat.length - 1);
  await redraw(page);
  assert.equal(tab(doc)?.dataset.step, 'choose', 'middle delete: the choice stays with its reply');
  assert.equal(line(doc), false);
  await host.st.loadChat([{ is_user: false, name: 'Narrator', mes: 'Elsewhere.', extra: {} }], 'other');
  host.ctx.chatMetadata = {};
  host.events.emit('head', { index: host.store.headIndex(), reason: 'chat' });
  await redraw(page);
  agree(doc, 'chat change', false);
  assert.equal(strip(doc), false, 'another chat: no offer, no Fight tab');
});
