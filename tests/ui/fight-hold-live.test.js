// The waiting fight on the live mount: the RPG's real pause controller and the new view on one testkit page. The pause shows only as the
// new view's Fight tab offer; its answers write the chat metadata below (captured from the earlier pause); the board, its end and the held send run in the new view.
import test from 'node:test';
import assert from 'node:assert/strict';
import { livePage, holdFight as hold, settle } from './helpers/live-page.js';

const tab = doc => doc.querySelector('.su-panel .fight-tab');
const box = host => host.ctx.chatMetadata.storySuiteInteraction;

test('the pause shows only as the new view\'s Fight tab offer (foes, party, its answers), never as the old view\'s screen', async t => {
  const { doc, host } = await livePage(t);
  hold(host);
  await settle();
  assert.equal(doc.querySelector('.rpg-fight-pause'), null, 'no pause card on the page');
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

test('Fight on the board opens the board in the new view; it is played to the end there and Back to the story sends the waiting message', async t => {
  const { doc, host } = await livePage(t);
  const sent = [];
  host.ctx.generate = type => { sent.push(type); return Promise.resolve(); };
  hold(host);
  await settle();
  tab(doc).querySelector('[data-offer="board"]').click();
  await settle();
  assert.equal(box(host).start?.choice, 'board', 'the pause recorded the board, as its own button does');
  assert.ok(box(host).open, 'the fight is open');
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
  assert.equal(root.querySelector('[data-act="send"]'), null, 'one primary button: no separate Send with this');
  const send = [...root.querySelectorAll('button')].find(b => /Back to the story/.test(b.textContent));
  assert.ok(send, 'the end card\'s Back to the story');
  send.click();
  await settle();
  assert.deepEqual(sent, ['regenerate'], 'the waiting message went out (the pause\'s own send)');
  assert.ok(box(host).send, 'with the fight attached');
  assert.equal(doc.querySelector('.su-layer')?.getAttribute('data-state'), 'closed', 'the view closed so the reply is seen being written');
});

test('Discard fight on a board the message waits for puts the offer back, as before', async t => {
  const { doc, host } = await livePage(t);
  hold(host);
  await settle();
  tab(doc).querySelector('[data-offer="board"]').click();
  await settle();
  const discard = tab(doc).querySelector('[data-discard]');
  assert.ok(discard);
  discard.click();
  tab(doc).querySelector('[data-confirm="discard"]').click(); // (Discard asks first)
  await settle();
  assert.equal(box(host).open, undefined, 'the fight is gone');
  assert.equal(box(host).start?.choice, null, 'the waiting choice is back');
  assert.equal(tab(doc)?.dataset.step, 'offer', 'the offer shows again');
});

const EXPECTED = {"start":{"anchor":"sw_1119041761f5","message":"utsh5w","mode":"known","choice":"board","id":"sw_1119041761f5:0:story-block/fight","choices":["board","auto","plain"],"kindId":"story-block/fight","title":"Fight"},"open":{"v":1,"id":"sw_1119041761f5:0:story-block/fight","kindId":"story-block/fight","version":1,"origin":"sw_1119041761f5","anchor":"sw_1119041761f5","attempt":0,"seed":2089307234,"offset":0,"setup":{"id":"sw_1119041761f5:0","v1":1,"fleeIdle":1,"xpRule":"each2","gearStats":1,"groups":[1],"offset":0,"rules":{"formula":"standard","foeBase":4,"foeClassWeight":3,"classWeight":2,"costMargin":2,"decisiveMargin":8,"roundCap":8,"startStat":5,"createPoints":10,"createMin":5,"createMax":10,"pointsPerSoul":4,"statMax":20,"quickStartMargin":10,"levelDivisor":5},"practice":3,"rate":100},"steps":[]}};

test('the board answer through the new offer writes the chat metadata the earlier pause wrote (replay == live)', async t => {
  const { doc, host } = await livePage(t, { next: true, seed: 4402 });
  hold(host);
  await settle();
  tab(doc).querySelector('[data-offer="board"]').click();
  await settle();
  assert.deepEqual(box(host), EXPECTED);
});

test('with no new view on the page nobody claims the screen: no pause card, no layer', async t => {
  const { doc, host } = await livePage(t, { next: false, seed: 4403 });
  hold(host);
  await settle();
  assert.equal(doc.querySelector('.rpg-fight-pause'), null);
  assert.equal(doc.querySelector('.su-layer'), null);
});
