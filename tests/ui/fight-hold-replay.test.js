// A waiting fight played and sent from the new view's Fight tab on the live mount gives the reply the old pause gives (the same steps, the same state), and the
// state after it survives swipe and swipe back, an edited Re-read (grown and shrunk), rewind, reload, a middle delete and a chat change (replay == live).
import test from 'node:test';
import assert from 'node:assert/strict';
import { livePage as mount, holdFight, settle } from './helpers/live-page.js';
import { holdStart } from '../../core/interaction/start-hold.js';
import { HOLD_EVENT } from '../../modules/rpg/board/hold-bridge.js';

const REPLY = 'Astra cuts the rat down.';
const xp = host => host.head().domains.dataModules.instances['pack.chat/character'].chat.fields.xp;
const tab = doc => doc.querySelector('.su-panel .fight-tab');
const listed = doc => Boolean(doc.querySelector('.su-strip .su-tab[data-tab="fight"]'));

async function livePage(t, { next, seed }) {
  const got = await mount(t, { next, seed, reply: REPLY });
  holdFight(got.host, 'I attack the rats.');
  await settle();
  return got;
}

// Plays the board in the new view, choosing for the member each time, to its end; returns the staged steps.
async function playNew(doc) {
  tab(doc).querySelector('[data-offer="board"]').click();
  await settle();
  for (let n = 0; n < 30 && tab(doc)?.dataset.step !== 'end'; n += 1) {
    const root = tab(doc);
    if (root.dataset.step === 'after') { root.querySelector('.actp button')?.click(); await settle(); continue; }
    root.querySelector('.actions-card .at:not([disabled])').click();
    await settle();
    const target = tab(doc).querySelector('.foes-card .mbx.tgt, .foes-card .fg.tgt');
    if (target) { target.click(); await settle(); }
  }
  assert.equal(tab(doc)?.dataset.step, 'end');
}

async function same(host, label) {
  const live = JSON.stringify(host.head());
  host.store.rebuild();
  assert.equal(JSON.stringify(host.head()), live, `${label}: live == rebuild`);
  await host.store.flush();
  const chat = structuredClone(host.ctx.chat), meta = structuredClone(host.ctx.chatMetadata);
  await host.st.loadChat(chat, `hold-${label}`);
  host.ctx.chatMetadata = meta;
  assert.equal(JSON.stringify(host.head()), live, `${label}: reload == live`);
}

test('sent from the new view, the fight\'s reply equals the old pause\'s; swipe, edited Re-read, rewind, reload, middle delete and chat change hold', async t => {
  const viaNew = await livePage(t, { next: true, seed: 4501 });
  await playNew(viaNew.doc);
  const steps = structuredClone(viaNew.host.ctx.chatMetadata.storySuiteInteraction.open.steps);
  tab(viaNew.doc).querySelector('[data-act="send"]').click();
  await settle();
  await viaNew.replied();
  await settle();
  const { host, doc } = viaNew;
  const at = host.ctx.chat.length - 1;
  assert.equal(host.ctx.chat[at].mes, REPLY);
  assert.ok(host.store.receipts().some(entry => entry.index === at && entry.receipt.type === 'interaction.settle'), 'the reply carries the fight');
  assert.ok(xp(host) > 0, 'and its pay');
  assert.equal(listed(doc), false, 'no Fight tab once it went with the reply');

  // The old pause with the same steps (its board's own send): the same reply state.
  const viaOld = await livePage(t, { next: false, seed: 4501 });
  viaOld.doc.querySelector('.rpg-fight-pause-board').click();
  await settle();
  const id = viaOld.host.ctx.chatMetadata.storySuiteInteraction.open.id;
  for (const step of steps) assert.equal(viaOld.host.sdk.interaction.stage(id, step).ok, true);
  viaOld.doc.dispatchEvent({ type: HOLD_EVENT, detail: { op: 'send' } });
  await viaOld.replied();
  await settle();
  assert.equal(JSON.stringify(viaOld.host.head()), JSON.stringify(host.head()), 'the same state as the old pause gives');
  await same(host, 'first');

  const live = JSON.stringify(host.head());
  await host.swipe('Another telling.');
  await host.st.swipeTo(at, 0);
  assert.equal(JSON.stringify(host.head()), live, 'swipe back: as before');
  await same(host, 'swipe');
  const text = host.ctx.chat[at].mes;
  await host.st.editMessage(at, `${text} She wipes the blade and looks around the yard.`);
  assert.equal((await host.sdk.reread(at)).ok, true);
  assert.equal(JSON.stringify(host.head()), live, 'Re-read (grown): the fight stands');
  await same(host, 'reread-grown');
  await host.st.editMessage(at, 'Done.');
  assert.equal((await host.sdk.reread(at)).ok, true);
  assert.equal(JSON.stringify(host.head()), live, 'Re-read (shrunk): the fight stands');
  await same(host, 'reread-shrunk');
  await host.st.editMessage(at, text);
  assert.equal((await host.sdk.reread(at)).ok, true);
  assert.equal(listed(doc), false, 'still no Fight tab');

  await host.send('Later.', 'A later reply.');
  const entry = host.store.receipts().filter(item => item.index === at).find(item => item.receipt.type === 'interaction.settle');
  assert.equal((await host.sdk.rewind({ index: entry.index, beforeRev: entry.receipt.rev })).ok, true);
  assert.equal(xp(host), 0, 'rewind: nothing paid');
  await same(host, 'rewind');
});

test('a middle delete takes the fight sent from the new view with its pair; a chat change takes the waiting offer away', async t => {
  const { host, doc, replied } = await livePage(t, { next: true, seed: 4502 });
  await playNew(doc);
  tab(doc).querySelector('[data-act="send"]').click();
  await settle();
  await replied();
  await host.send('Later.', 'A later reply.');
  assert.ok(xp(host) > 0);
  const user = host.ctx.chat.length - 4;
  await host.st.deleteMessage(user + 1);
  await host.st.deleteMessage(user);
  assert.equal(xp(host), 0, 'the fight pair is gone, so is its pay');
  await same(host, 'middle delete');

  // a new waiting fight, then another chat: the offer and the Fight tab go
  host.ctx.chat.push({ is_user: true, name: 'Astra', mes: 'I attack again.', extra: {} });
  assert.ok(holdStart(host.ctx.chatMetadata, host.ctx.chat, { kindId: 'story-block/fight', title: 'Fight', mode: 'known', choices: ['board', 'auto', 'plain'] }));
  host.events.emit('head', { index: host.store.headIndex(), reason: 'interaction-start' });
  await settle();
  assert.equal(listed(doc), true, 'the Fight tab for the new waiting fight');
  await host.st.loadChat([{ is_user: false, name: 'Narrator', mes: 'Elsewhere.', extra: {} }], 'other');
  host.ctx.chatMetadata = {};
  host.events.emit('head', { index: host.store.headIndex(), reason: 'chat' });
  await settle();
  assert.equal(listed(doc), false, 'another chat: no waiting fight, no Fight tab');
});
