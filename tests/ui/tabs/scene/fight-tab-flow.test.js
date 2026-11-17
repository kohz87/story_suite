// A real fight through the new view: the Fight tab appears while the fight is open, the reader picks on it, the step is staged by the real engine, and what the tab shows
// (the dice in its log, the fight view) is the same live, after a swipe and back, a grown and a shrunk Re-read, a rewind, a middle delete, a reload and a chat change.
import test from 'node:test';
import assert from 'node:assert/strict';
import { seedCrypto } from '../../../suite/qa/helpers/seeded.js';
import { installFakeDom } from '../../../helpers/ui-fake-dom.js';
import { mountSuite } from '../../../../ui/mount.js';
import { createSbPort } from '../../../../ui/port/sb-port.js';
import { buildSelectors } from '../../../../ui/select/build.js';
import { checkShape } from '../../../../ui/contract/shapes.js';
import { SCENE_SHAPE } from '../../../../ui/contract/interaction.js';
import { api, openFight, v1Host } from '../../../modules/rpg/board/v1.helpers.js';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const portOn = host => {
  const sdk = { interaction: new Proxy({}, { get: (_, verb) => (...args) => api(host)[verb](...args) }), query: name => (name === 'interaction.view' ? api(host).current() : null) };
  return createSbPort({ sdk, selectors: buildSelectors(() => null, sdk) });
};

test('the Fight tab plays a real fight and shows the same fight live, after a rebuild and after a reload, through swipe, Re-read, rewind, delete and chat change', async () => {
  const restore = seedCrypto(77);
  const { host } = await v1Host({ count: 5, level: 8 });
  const doc = installFakeDom();
  try {
    const port = portOn(host);
    assert.equal(port.view('fight'), null, 'no fight, no Fight tab');
    assert.equal(openFight(host).ok, true);
    const fight = port.view('fight');
    assert.deepEqual(checkShape(fight, SCENE_SHAPE), []);
    assert.equal(port.view('scene'), null, 'a fight is on the Fight tab, not the activity tab');
    assert.equal(port.view('chat').inlineRow.fightOpen, true);
    assert.deepEqual(port.view('now').needsYou.map(row => row.kind), ['fight'], 'Now asks for the open fight');

    const suite = mountSuite({ port, doc });
    suite.open();
    assert.ok(suite.tabHost.tabs().includes('fight'));
    suite.open('fight');
    const root = () => doc.body.querySelector('[data-renderer="fight"]');
    assert.ok(root(), 'the fight renderer draws the open fight');
    root().querySelector('[data-act="normal"]').click();
    root().querySelector('[data-target]').click();
    await flush();
    const staged = port.view('fight');
    assert.equal(staged.steps, 1, 'the pick was staged by the real engine');
    assert.equal(staged.view.state, 'after');
    assert.ok(staged.view.log.length > 0 && staged.view.log[0].rows.length > 0, 'the log holds the exchange\'s rolls');

    const viewOf = () => JSON.stringify(port.view('fight'));
    const same = async label => {
      const live = viewOf();
      host.store.rebuild();
      assert.equal(viewOf(), live, `${label}: live == rebuild`);
      await host.store.flush();
      const chat = structuredClone(host.ctx.chat), meta = structuredClone(host.ctx.chatMetadata);
      await host.st.loadChat(chat, `fight-tab-${label}`);
      host.ctx.chatMetadata = meta;
      assert.equal(viewOf(), live, `${label}: reload == live`);
    };
    await same('staged');

    await host.send('First.', 'One.');
    const afterSend = port.view('fight');
    assert.ok(afterSend, 'the fight carries on after its reply');
    await same('first reply');
    const logOf = () => JSON.stringify(port.view('fight')?.view.log ?? null);
    const before = logOf();
    await host.swipe('Told again.');
    assert.equal(logOf(), before, 'swipe: the dice are kept');
    await same('swipe');
    await host.st.swipeTo(2, 0);
    assert.equal(logOf(), before, 'swipe back: the dice are kept');
    const text = host.ctx.chat[2].mes;
    await host.st.editMessage(2, `${text}\nA gust blows.`);
    assert.equal((await host.sdk.reread(2)).ok, true);
    assert.equal(logOf(), before, 'Re-read grown: the dice are kept');
    await host.st.editMessage(2, text);
    assert.equal((await host.sdk.reread(2)).ok, true);
    assert.equal(logOf(), before, 'Re-read shrunk: the dice are kept');
    await same('re-read');

    const entry = host.store.receipts().filter(item => item.index === 2).find(item => item.receipt.type === 'interaction.settle');
    assert.ok(entry, 'the reply holds its settle');
    assert.equal((await host.sdk.rewind({ index: entry.index, beforeRev: entry.receipt.rev })).ok, true);
    await same('rewind');
    await host.st.deleteMessage(2);
    await host.st.deleteMessage(1);
    await same('middle delete');

    const kept = { chat: structuredClone(host.ctx.chat), meta: structuredClone(host.ctx.chatMetadata), view: viewOf() };
    host.ctx.chatMetadata = {};
    await host.st.loadChat([{ is_user: false, name: 'Narrator', mes: 'Another story.', extra: {} }], 'another-chat');
    assert.equal(port.view('fight'), null, 'another chat: no fight, so no Fight tab');
    host.ctx.chatMetadata = kept.meta;
    await host.st.loadChat(kept.chat, 'back');
    assert.equal(viewOf(), kept.view, 'switching back: the same fight');

    // the picks the tab holds do not carry across to another fight
    assert.equal((await port.command('interaction.discard', { id: port.view('fight').id })).ok, true);
    assert.equal(port.view('fight'), null, 'discarded: the tab goes');
    assert.equal(suite.tabHost.tabs().includes('fight'), false);
    suite.destroy();
  } finally { host.close(); restore(); }
});
