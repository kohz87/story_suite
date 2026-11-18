// The modules' cards under the head reply on the live mount (the new view as SillyTavern mounts it, the real RPG and block modules):
// a companion's join card in Ask mode (Add to party, Edit first, No) and the death card are drawn under the reply, their buttons go through
// the port, and an answered card stays answered through a swipe and swipe back, an edited Re-read, a middle delete, a reload and a chat change.
import test from 'node:test';
import assert from 'node:assert/strict';
import { livePage, settle } from './helpers/live-page.js';
import { makeMessage } from '../helpers/ui-fake-dom.js';
import { readRecord } from '../../core/persist.js';
import { CORE_FEATURE } from '../../core/features.js';

const reply = (...lines) => `The road bends.\n<Changes>\n${lines.join('\n')}\n</Changes>`;
const PELL = '+ party Pell | class: I | best: dex';

// The page draws the chat's messages inside #chat (where SillyTavern has them; the fake page draws none), then the view redraws.
async function redraw({ doc, host }) {
  for (const old of doc.querySelectorAll('.mes')) old.remove();
  const chat = doc.querySelector('#chat');
  host.ctx.chat.forEach((message, index) => chat.appendChild(makeMessage(doc, index)));
  host.events.emit('head', { index: host.store.headIndex(), reason: 'changed' });
  await settle();
}
const cardsOn = doc => doc.querySelectorAll('.sscd');
const titles = doc => cardsOn(doc).map(card => card.querySelector('.sscd-t').textContent);
const under = doc => cardsOn(doc).map(card => card.parentNode?.parentNode?.parentNode?.getAttribute?.('mesid'));
const party = host => Object.values(host.head().domains.dataModules?.instances ?? {}).map(item => item?.chat?.fields?.who).filter(Boolean).sort();
const pellCard = doc => cardsOn(doc).find(card => card.querySelector('.sscd-t').textContent === 'Pell joins the party') ?? null;

async function joined(t, seed, { before = false } = {}) {
  const page = await livePage(t, { seed });
  if (before) await page.host.send('A step.', 'Quiet road.');
  await page.host.send('Pell walks up.', reply(PELL));
  await redraw(page);
  return page;
}

test('a companion who joins in Ask mode: the card is under the head reply with Add to party, Edit first and No', async t => {
  const page = await joined(t, 5101);
  const { doc, host } = page;
  const card = pellCard(doc);
  assert.ok(card, `the join card is drawn (cards: ${JSON.stringify(titles(doc))})`);
  assert.deepEqual(under(doc), [String(host.ctx.chat.length - 1)], 'under the head reply');
  assert.deepEqual(card.querySelectorAll('button').map(b => b.dataset.act), ['add', 'edit', 'no']);
  assert.deepEqual(card.querySelectorAll('button').map(b => b.textContent), ['Add to party', 'Edit first', 'No']);
  card.querySelector('button[data-act="edit"]').click();
  await settle();
  assert.equal(doc.querySelector('[data-wiz="name"]')?.value, 'Pell', 'Edit first opens the New character window filled in with Pell');
  assert.ok(!party(host).includes('Pell'), 'opening the window adds nobody');
  card.querySelector('button[data-act="add"]').click();
  for (let n = 0; n < 5; n += 1) await settle();
  await redraw(page);
  assert.ok(party(host).includes('Pell'), 'Add to party made Pell (cause ui, recorded with the reply)');
  assert.equal(pellCard(doc), null, 'the card is answered');
});

test('No answers the card, and it stays answered through swipe and swipe back, edited Re-reads, a middle delete, a reload, a chat change and a rewind', async t => {
  const page = await joined(t, 5102, { before: true });
  const { doc, host } = page;
  pellCard(doc).querySelector('button[data-act="no"]').click();
  for (let n = 0; n < 5; n += 1) await settle();
  assert.equal(pellCard(doc), null, 'No answered it (the view redrew on its own)');
  let at = host.ctx.chat.length - 1;
  const answered = async why => { await redraw(page); assert.equal(pellCard(doc), null, `still answered: ${why}`); assert.ok(!party(host).includes('Pell'), `nobody added: ${why}`); };

  await host.swipe('Nobody comes.');
  await settle();
  assert.equal(pellCard(doc), null, 'the other swipe has no offer');
  await host.st.swipeTo(at, 0);
  await settle();
  assert.equal(pellCard(doc), null, 'swipe back: still answered, with no redraw by the page');
  assert.equal(titles(doc).length, 0);

  await host.st.editMessage(at, reply(PELL, '+ item Rope'));
  assert.equal((await host.turn.reread(at)).ok, true);
  await answered('an edited Re-read, grown');
  await host.st.editMessage(at, reply(PELL));
  assert.equal((await host.turn.reread(at)).ok, true);
  await answered('an edited Re-read, shrunk');

  // a middle delete: the plain exchange before the join reply goes (its reply, then its user message)
  assert.equal(host.ctx.chat[at - 2].mes, 'Quiet road.');
  await host.st.deleteMessage(at - 2);
  await host.st.deleteMessage(at - 3);
  at -= 2;
  await answered('a middle delete');

  await host.st.loadChat(JSON.parse(JSON.stringify(host.ctx.chat)));
  await answered('a reload');

  // a chat change: another chat without the join reply has no card; back in this one, still answered
  const home = host.ctx.chatId, saved = JSON.parse(JSON.stringify(host.ctx.chat));
  await host.st.loadChat(saved.slice(0, at - 1), 'another-chat');
  await redraw(page);
  assert.deepEqual(titles(doc).filter(title => /joins the party/.test(title)), [], 'another chat: no join card');
  await host.st.loadChat(saved, home);
  await answered('back in this chat');

  // a rewind to before the No: the branch has the card unanswered again; the chat it came from keeps it answered
  const no = readRecord(host.ctx.chat[at]).receipts.find(receipt => receipt?.data?.join?.op === 'no');
  assert.ok(no, 'the No is in the join reply\'s own receipts');
  assert.equal((await host.sdk.rewind({ index: at, beforeRev: no.rev })).ok, true);
  assert.notEqual(host.ctx.chatId, home, 'the rewind opened a branch');
  await redraw(page);
  assert.ok(pellCard(doc), 'rewind: the card is back, unanswered');
  await host.st.loadChat(saved, home);
  await answered('the chat the rewind came from');
});

test('an unanswered card follows its swipe and comes back after a swipe back and a reload (it is the reply\'s own, never the view\'s)', async t => {
  const page = await joined(t, 5103);
  const { doc, host } = page;
  const at = host.ctx.chat.length - 1;
  await host.swipe('Nobody comes.');
  await settle();
  assert.equal(pellCard(doc), null, 'gone with the swipe, with no redraw by the page');
  await host.st.swipeTo(at, 0);
  await settle();
  assert.ok(pellCard(doc), 'back with the swipe back, with no redraw by the page');
  await host.st.loadChat(JSON.parse(JSON.stringify(host.ctx.chat)));
  await redraw(page);
  assert.ok(pellCard(doc), 'and after a reload');
  await host.st.deleteMessage(at);
  await settle();
  assert.equal(pellCard(doc), null, 'a delete of the join reply takes it away');
});

test('the Cards under replies switch: off takes the cards away, on draws them again', async t => {
  const page = await joined(t, 5105);
  const { doc, host } = page;
  assert.ok(pellCard(doc));
  host.features.set(CORE_FEATURE.cards, false);
  await settle();
  assert.equal(doc.querySelector('.sscards'), null, 'off: no strip');
  assert.equal(doc.querySelector('.ssrow') !== null, true, 'the inline row stays');
  host.features.set(CORE_FEATURE.cards, true);
  await settle();
  assert.ok(pellCard(doc), 'on: the card again');
});

test('the death card: a Character left Down at the end of a reply dies, and "The story ends here" is drawn under the head reply', async t => {
  const page = await livePage(t, { seed: 5104 });
  const { doc, host } = page;
  await host.send('The blade falls.', reply('~ dm character — cut down | kind: set-health | to: Down'));
  await host.send('Silence.', 'The dark closes in.');
  await redraw(page);
  assert.equal(host.sdk.query('dataModules.view', { module: 'pack.chat/character' })?.chat?.alive, false, 'the Character died');
  assert.ok(titles(doc).includes('The story ends here'), `the death card (cards: ${JSON.stringify(titles(doc))})`);
  assert.deepEqual(under(doc), [String(host.ctx.chat.length - 1)]);
  // delete the reply that ended it: the card goes with it (a swipe of it would end the same way, HP still 0 and Down)
  await host.st.deleteMessage(host.ctx.chat.length - 1);
  await redraw(page);
  assert.equal(host.sdk.query('dataModules.view', { module: 'pack.chat/character' })?.chat?.alive, true);
  assert.ok(!titles(doc).includes('The story ends here'), 'the delete took the death back');
});
