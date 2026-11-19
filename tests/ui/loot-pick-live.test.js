// Pick what you take (SOAKRPG #2): a `? loot` reply's things show on its card's action line (Pick up ›, then chips) and on the Bag's To pick up, and
// Take selected sends `inventory.lootTake { sid, pick }`. Built from a live host through the real selectors (ui/select/build.js), so a
// swipe, swipe back, an edited Re-read (grown and shrunk), a middle delete, a rewind, a reload and a chat change show what a rebuild shows.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/dom.js';
import { createHost } from '../../testkit/index.js';
import { buildSelectors } from '../../ui/select/build.js';
import { makeReader } from '../../ui/port/sb-port.js';
import { replyBoxActions } from '../../ui/chat/reply-box-actions.js';
import { bagTab } from '../../ui/tabs/bag/bag.js';
import { checkShape } from '../../ui/contract/shapes.js';
import { CHAT_SHAPE } from '../../ui/contract/chat.js';
import { BAG_SHAPE } from '../../ui/contract/bag.js';
import { LOOT_OFFER_SHAPE } from '../../ui/contract/loot.js';

const reply = (text, lines) => `${text}\n\n<Changes>\n${lines.join('\n')}\n</Changes>`;
const qty = (host, name) => host.sdk.query('inventory.items').filter(item => item.name === name).reduce((sum, item) => sum + item.qty, 0);
const headSid = host => host.store.carrierSid(host.store.headIndex());
const at = (host, start) => host.ctx.chat.findIndex(message => !message.is_user && message.mes.startsWith(start));
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const CRATE = reply('A crate.', ['? loot Torch x2, Rope, 5 gold — in the crate']);
const CRATE_ITEMS = [{ at: 0, label: 'Torch ×2' }, { at: 1, label: 'Rope' }, { at: 2, label: '5 gold' }];

// What the reader sees: the head reply's row loot and the Bag's loot, from the real selectors over the sdk.
function views(host) {
  const selectors = buildSelectors(() => host.ctx, host.sdk);
  const read = makeReader(host.sdk);
  const chat = selectors.chat(read);
  const bag = selectors.bag(read);
  assert.deepEqual(checkShape(chat.head?.actions, CHAT_SHAPE.head.$nullable.actions), [], 'the action line keeps its shape');
  // (the Bag's other gaps, such as a null pace, are not this test's: only its loot is checked, against the Bag's own entry)
  if (bag?.loot) assert.deepEqual(checkShape(bag.loot, BAG_SHAPE.loot.$optional), [], 'the Bag\'s loot keeps its shape');
  if (bag?.loot) assert.deepEqual(checkShape(bag.loot, [LOOT_OFFER_SHAPE]), []);
  return { row: chat.head?.actions.loot.length ? chat.head.actions.loot : null, bag: bag?.loot ?? null, chat, bagVm: bag };
}

// The views live equal the views after a rebuild and after a reload of the chat as saved.
async function agrees(t, host, label) {
  const live = views(host);
  host.store.rebuild();
  const rebuilt = views(host);
  assert.deepEqual([rebuilt.row, rebuilt.bag], [live.row, live.bag], `${label}: a rebuild shows the same loot`);
  const loaded = await createHost({ st: { chat: structuredClone(host.ctx.chat), extensionSettings: structuredClone(host.ctx.extensionSettings) } });
  t.after(() => loaded.close());
  const reloaded = views(loaded);
  // a reload gives the same record ids, so the same offers by sid
  assert.deepEqual([reloaded.row, reloaded.bag], [live.row, live.bag], `${label}: a reload shows the same loot`);
  return live;
}

async function fresh(t, options = {}) {
  installFakeDom();
  t.mock.method(console, 'warn', () => {});
  const host = await createHost(options);
  t.after(() => host.close());
  await host.send('Hello.', 'The road.');
  return host;
}

test('inventory.loot { reply: true } answers only the head reply\'s own offer, taken or not; the plain answer is as before', async t => {
  const host = await fresh(t);
  await host.send('Search the crate.', CRATE);
  const sid = headSid(host);
  const own = host.sdk.query('inventory.loot', { reply: true });
  assert.deepEqual(own.map(offer => [offer.sid, offer.where, offer.taken]), [[sid, 'in the crate', false]]);
  assert.equal(Object.hasOwn(host.sdk.query('inventory.loot')[0], 'taken'), false, 'the plain answer has no taken flag');
  await host.send('Walk on.', reply('The road goes on.', ['+ item Apple']));
  assert.deepEqual(host.sdk.query('inventory.loot', { reply: true }), [], 'a later reply laid nothing out');
  assert.deepEqual(host.sdk.query('inventory.loot').map(offer => offer.sid), [sid], 'the crate is still there to pick from');
  assert.deepEqual(host.sdk.query('inventory.loot', { reply: true, asOf: at(host, 'A crate.') }).map(offer => offer.sid), [sid], 'that reply\'s own, as of it');
  assert.equal((await host.sdk.command('inventory.lootTake', { sid, pick: [1] })).ok, true);
  assert.deepEqual(host.sdk.query('inventory.loot'), [], 'taken: no longer to pick up');
  assert.deepEqual(host.sdk.query('inventory.loot', { reply: true, asOf: host.store.headIndex() }), []);
});

test('the newest reply\'s action line and the Bag show the loot; Pick up opens its chips; Take selected sends inventory.lootTake with the ticked ones', async t => {
  const host = await fresh(t);
  const before = views(host);
  assert.equal(before.row, null, 'no loot: no loot on the row');
  assert.deepEqual(before.chat.head.actions.loot, [], 'and an empty list');
  await host.send('Search the crate.', CRATE);
  const sid = headSid(host);
  const { row, bag, chat } = views(host);
  assert.deepEqual(row, [{ sid, where: 'in the crate', taken: false, items: CRATE_ITEMS }]);
  assert.deepEqual(bag, row, 'the Bag lists the same offer');
  const sent = [];
  const el = replyBoxActions(chat.head.actions, { onLootTake: (s, pick) => { sent.push({ s, pick }); return host.sdk.command('inventory.lootTake', { sid: s, pick }); } });
  const chip = el.querySelector('button[data-loot]');
  assert.ok(chip, 'Pick up is on the action line');
  assert.equal(chip.textContent, 'Pick up: Torch ×2, Rope, 5 gold›');
  assert.equal(chip.getAttribute('aria-expanded'), 'false', 'it rests folded');
  chip.click();
  assert.equal(el.querySelector('.sslootp').hasAttribute('hidden'), false, 'Pick up opens the chips');
  assert.equal(el.querySelectorAll('.lpchip').length, 3);
  const take = el.querySelector('.lptake');
  assert.equal(take.hasAttribute('disabled'), true, 'nothing ticked: Take selected waits');
  el.querySelector('.lpchip[data-at="0"]').click();
  el.querySelector('.lpchip[data-at="2"]').click();
  assert.equal(el.querySelector('.lpchip[data-at="0"]').getAttribute('aria-pressed'), 'true');
  take.click();
  await settle();
  assert.deepEqual(sent, [{ s: sid, pick: [0, 2] }]);
  assert.deepEqual([qty(host, 'Torch'), qty(host, 'Rope'), host.head().domains.inventory.wallets.party?.coin ?? 0], [2, 0, 5]);
  const after = views(host);
  assert.deepEqual(after.row, [{ sid, where: 'in the crate', taken: true, items: CRATE_ITEMS }], 'the row says it was taken');
  assert.equal(after.bag, null, 'nothing left to pick up in the Bag');
  assert.equal(replyBoxActions(after.chat.head.actions, {})?.querySelector('[data-loot]') ?? null, null, 'taken: nothing to pick up on the line');
  await agrees(t, host, 'after the take');
});

test('the Bag\'s To pick up takes through the port, and a refusal is shown, not lost', async t => {
  const host = await fresh(t);
  await host.send('Search the crate.', CRATE);
  const sid = headSid(host);
  const port = { command: (type, payload) => host.sdk.command(type, payload) };
  const tab = bagTab(views(host).bagVm, { port });
  const card = tab.querySelector('[data-card="loot"]');
  assert.ok(card, 'the To pick up card');
  assert.match(card.querySelector('h3').textContent, /To pick up/);
  // a stale picker: the offer is taken elsewhere first
  card.querySelector('.lpchip[data-at="1"]').click();
  assert.equal((await host.sdk.command('inventory.lootTake', { sid, pick: [0] })).ok, true);
  card.querySelector('.lptake').click();
  await settle();
  assert.match(card.querySelector('.lperr').textContent, /already been taken/);
  assert.deepEqual([qty(host, 'Torch'), qty(host, 'Rope')], [2, 0]);
  assert.equal(bagTab(views(host).bagVm, { port }).querySelector('[data-card="loot"]'), null, 'taken: the card goes');
});

test('the ticks and the fold outlive a redraw of the action line', async t => {
  const host = await fresh(t);
  await host.send('Search the crate.', CRATE);
  const first = replyBoxActions(views(host).chat.head.actions, {});
  first.querySelector('.lpchip[data-at="1"]').click();
  first.querySelector('button[data-loot]').click();
  const again = replyBoxActions(views(host).chat.head.actions, {});
  assert.equal(again.querySelector('.lpchip[data-at="1"]').getAttribute('aria-pressed'), 'true');
  assert.equal(again.querySelector('button[data-loot]').getAttribute('aria-expanded'), 'true', 'opened before the redraw: open after it');
  assert.equal(again.querySelector('.sslootp').hasAttribute('hidden'), false);
  assert.equal(again.querySelector('.lptake').hasAttribute('disabled'), false);
});

test('swipe, swipe back, middle delete, rewind and chat change: the loot shown follows the reply on screen', async t => {
  const host = await fresh(t);
  await host.send('Search the crate.', CRATE);
  const sid = headSid(host);
  assert.equal((await host.sdk.command('inventory.lootTake', { sid, pick: [0] })).ok, true);
  const taken = await agrees(t, host, 'taken');
  const index = host.store.headIndex();
  await host.swipe('The crate is empty.');
  const swiped = await agrees(t, host, 'after a swipe');
  assert.deepEqual([swiped.row, swiped.bag, qty(host, 'Torch')], [null, null, 0], 'the swipe laid nothing out and the take went with it');
  await host.st.swipeTo(index, 0);
  const back = await agrees(t, host, 'after the swipe back');
  assert.deepEqual([back.row, back.bag], [taken.row, taken.bag], 'swipe back: the offer and its take are back');
  assert.equal(qty(host, 'Torch'), 2);
  // a middle delete of a reply before the crate keeps the crate's own row
  await host.st.deleteMessage(at(host, 'The road.'));
  const deleted = await agrees(t, host, 'after a middle delete');
  assert.deepEqual(deleted.row, taken.row);
  // the take is the reader's own block on the crate's reply: a rewind to before it gives the offer back, untaken
  const rev = host.store.receipts().filter(entry => entry.index === host.store.headIndex()).find(entry => entry.receipt.type === 'inventory.lootTake')?.receipt?.rev;
  assert.ok(Number.isInteger(rev), 'the take\'s receipt has its rev');
  assert.equal((await host.sdk.rewind({ index: host.store.headIndex(), beforeRev: rev }))?.ok, true);
  const rewound = await agrees(t, host, 'after a rewind');
  assert.deepEqual(rewound.row, [{ ...taken.row[0], sid: rewound.row[0].sid, taken: false }], 'rewound to before the take: the chips are back');
  assert.deepEqual(rewound.bag, rewound.row);
  assert.equal(qty(host, 'Torch'), 0);
  const saved = structuredClone(host.ctx.chat);
  await host.st.loadChat([{ is_user: false, name: 'Narrator', mes: 'Elsewhere.', extra: {} }], 'other');
  assert.deepEqual([views(host).row, views(host).bag], [null, null], 'another chat: none of this chat\'s loot');
  await host.st.loadChat(saved, 'back');
  const returned = views(host);
  assert.equal(returned.row?.length, 1, 'back in the chat: its loot is back');
});

test('an edited Re-read that grows or shrinks the loot redraws the chips as the reply reads now', async t => {
  const host = await fresh(t);
  await host.send('Search the crate.', CRATE);
  const sid = headSid(host);
  const index = at(host, 'A crate.');
  await host.st.editMessage(index, reply('A crate.', ['? loot Torch x2, Rope, Lantern, 5 gold — in the crate']));
  assert.equal((await host.turn.reread(index)).ok, true);
  const grown = await agrees(t, host, 'grown');
  assert.deepEqual(grown.row[0].items.map(item => item.label), ['Torch ×2', 'Rope', 'Lantern', '5 gold']);
  await host.st.editMessage(index, reply('A crate, mostly empty.', ['? loot Rope — in the crate']));
  assert.equal((await host.turn.reread(index)).ok, true);
  const shrunk = await agrees(t, host, 'shrunk');
  assert.deepEqual(shrunk.row, [{ sid, where: 'in the crate', taken: false, items: [{ at: 0, label: 'Rope' }] }]);
  await host.st.editMessage(index, reply('An empty crate.', ['+ item Apple']));
  assert.equal((await host.turn.reread(index)).ok, true);
  const none = await agrees(t, host, 'no loot left');
  assert.deepEqual([none.row, none.bag], [null, null]);
  assert.equal(replyBoxActions(none.chat.head.actions, {})?.querySelector('button[data-loot]') ?? null, null);
});

test('with Pick what you take off the action line and the Bag carry no loot', async t => {
  const host = await fresh(t);
  host.features.set('story-block.loot', false);
  await host.send('Search the crate.', CRATE);
  const { chat, bagVm } = views(host);
  assert.deepEqual(chat.head.actions.loot, []);
  assert.equal(bagVm ? Object.hasOwn(bagVm, 'loot') : false, false);
  assert.equal(replyBoxActions(chat.head.actions, {}), null, 'nothing to do: no action line');
});
