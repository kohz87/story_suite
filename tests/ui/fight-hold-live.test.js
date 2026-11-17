// The waiting fight on the live mount: the old host (with the RPG's real pause controller) and the new view on one testkit page. The pause shows only as the
// new view's Fight tab offer; its answers write what the old pause writes; the board, its end and the held send run in the new view; with no new view, the old pause works as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { livePage, holdFight as hold, settle } from './helpers/live-page.js';

const tab = doc => doc.querySelector('.su-panel .fight-tab');
const oldScreen = ui => ui.mounts.screen.current?.() ?? null;
const box = host => host.ctx.chatMetadata.storySuiteInteraction;

test('the pause shows only as the new view\'s Fight tab offer (foes, party, its answers), never as the old view\'s screen', async t => {
  const { doc, host, ui } = await livePage(t);
  hold(host);
  await settle();
  assert.equal(oldScreen(ui), null, 'the old view did not open its Fight screen');
  assert.equal(doc.querySelector('.rpg-fight-pause'), null, 'no old pause card on the page');
  assert.notEqual(doc.querySelector('.su-layer')?.getAttribute('data-state'), 'closed', 'the new view opened');
  assert.equal(doc.querySelector('.su-panel')?.getAttribute('data-tab'), 'fight', 'on its Fight tab');
  assert.ok(doc.querySelector('.su-strip .su-tab[data-tab="fight"]'), 'the strip lists Fight while the fight waits');
  const root = tab(doc);
  assert.equal(root?.dataset.step, 'offer');
  assert.deepEqual(root.querySelectorAll('[data-offer]').map(b => b.dataset.offer), ['board', 'auto'], 'a known-foe pause offers the board and Auto-fight (no send without a fight, as the old pause)');
  assert.match(root.querySelector('.foes-card').textContent, /Rats/);
  assert.match(root.querySelector('.party-card').textContent, /Astra/);
  assert.match(root.querySelector('[data-card="offer"]').textContent, /One foe stands in your way/);
});

test('Fight on the board opens the board in the new view; it is played to the end there and Send with this sends the waiting message', async t => {
  const { doc, host, ui } = await livePage(t);
  const sent = [];
  host.ctx.generate = type => { sent.push(type); return Promise.resolve(); };
  hold(host);
  await settle();
  tab(doc).querySelector('[data-offer="board"]').click();
  await settle();
  assert.equal(box(host).start?.choice, 'board', 'the pause recorded the board, as its own button does');
  assert.ok(box(host).open, 'the fight is open');
  assert.equal(oldScreen(ui), null);
  let root = tab(doc);
  assert.equal(root.dataset.step, 'choose', 'the board, with a member to choose for');
  for (let turns = 0; turns < 30 && tab(doc)?.dataset.step !== 'end'; turns += 1) {
    root = tab(doc);
    if (root.dataset.step === 'after') { root.querySelector('[data-card="after"] button, .actp button')?.click(); await settle(); continue; }
    const tile = root.querySelector('.actions-card .at:not([disabled])');
    assert.ok(tile, `a tile to choose (step ${root.dataset.step})`);
    tile.click();
    await settle();
    const target = tab(doc).querySelector('.foes-card .mbx.tgt, .foes-card .fg.tgt');
    if (target) { target.click(); await settle(); }
  }
  root = tab(doc);
  assert.equal(root.dataset.step, 'end', 'the fight ended on the new board');
  assert.ok(root.querySelector('.endb, [data-card="end"]'), 'the end card');
  const send = root.querySelector('[data-act="send"]');
  assert.ok(send, 'Send with this');
  send.click();
  await settle();
  assert.deepEqual(sent, ['regenerate'], 'the waiting message went out (the pause\'s own send)');
  assert.ok(box(host).send, 'with the fight attached');
  assert.equal(doc.querySelector('.su-layer')?.getAttribute('data-state'), 'closed', 'the view closed so the reply is seen being written');
});

test('Discard fight on a board the message waits for puts the offer back, as the old board does', async t => {
  const { doc, host } = await livePage(t);
  hold(host);
  await settle();
  tab(doc).querySelector('[data-offer="board"]').click();
  await settle();
  const discard = tab(doc).querySelector('[data-discard]');
  assert.ok(discard);
  discard.click();
  await settle();
  assert.equal(box(host).open, undefined, 'the fight is gone');
  assert.equal(box(host).start?.choice, null, 'the waiting choice is back');
  assert.equal(tab(doc)?.dataset.step, 'offer', 'the offer shows again');
});

test('the same answer through the new offer and the old pause writes the same chat metadata (replay == live)', async t => {
  const viaNew = await livePage(t, { next: true, seed: 4402 });
  hold(viaNew.host);
  await settle();
  tab(viaNew.doc).querySelector('[data-offer="board"]').click();
  await settle();
  const viaOld = await livePage(t, { next: false, seed: 4402 });
  hold(viaOld.host);
  await settle();
  assert.equal(oldScreen(viaOld.ui), 'story-block/fight', 'without the new view the old view opens its Fight screen, as before');
  const board = viaOld.doc.querySelector('.rpg-fight-pause-board');
  assert.ok(board, 'and draws its pause card');
  board.click();
  await settle();
  assert.deepEqual(box(viaNew.host), box(viaOld.host));
});

test('with no new view on the page nobody claims the screen: the old pause and board are unchanged', async t => {
  const { doc, host, ui } = await livePage(t, { next: false, seed: 4403 });
  hold(host);
  await settle();
  assert.equal(oldScreen(ui), 'story-block/fight');
  assert.ok(doc.querySelector('.rpg-fight-pause-board'));
  assert.equal(doc.querySelector('.su-layer'), null);
});
