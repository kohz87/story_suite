// Pack format 4, job S1: the rank label the reader types in Settings › Start is the Rank's word; its `~ you rank:` lines replay as a pack's do (swipe, swipe back, edited Re-read, reload).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../../testkit/index.js';
import { block, look, tailText } from './you.helpers.js';

const REQ = { suite: '^0.1' };
const world = { id: 'w1', format: 4, kind: 'world', version: '1.0.0', name: 'W', requires: REQ, content: { places: [{ id: 'dock', name: 'The Dock', x: 1, y: 1 }] } };
const game = { id: 'g1', format: 4, kind: 'game', version: '1.0.0', name: 'G', requires: REQ, content: { calendar: { months: [{ name: 'Frost', days: 30 }] } } };
const reread = async (host, index, text) => {
    await host.st.editMessage(index, text);
    const result = await host.sdk.reread(index);
    assert.equal(result.ok, true, result.message);
};

async function ownHost(t, label = 'Standing') {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost();
    t.after(() => host.close());
    for (const pack of [world, game]) assert.equal((await host.packs.packs.install(pack)).ok, true);
    if (label) await host.packs.packs.setOwn('rankLabel', label);
    return host;
}

test('with no game rank, the reader\'s label gives the story a Rank: the label is asked for, and the rank line is kept', async t => {
    const host = await ownHost(t);
    assert.deepEqual(host.sdk.query('packs.youRank'), { pack: null, label: 'Standing' });
    await host.send('We walk.', block('Rain.', ['~ you rank: Veteran | wearing: a coat']));
    assert.deepEqual(look(host), { rank: 'Veteran', wearing: 'a coat', condition: '' });
    assert.equal(host.sdk.query('scene.you').rankLabel, 'Standing');
    await host.send('On.', block('Fog.', ['~ you condition: chilled']));
    assert.match(tailText(host), /Standing/);
});

test('swipe, swipe back, an edited Re-read (grown and shrunk) and a reload keep the rank line', async t => {
    const host = await ownHost(t);
    await host.send('We walk.', block('Rain.', ['~ you rank: Veteran | wearing: a coat']));
    const first = host.ctx.chat.length - 1;
    await host.swipe(block('Rain again.', ['~ you rank: Recruit']));
    assert.equal(look(host).rank, 'Recruit');
    await host.st.swipeTo(first, 0);
    assert.equal(look(host).rank, 'Veteran');
    await reread(host, first, block('A longer reply that goes on and on.', ['~ you rank: Captain | wearing: a long coat | condition: wet']));
    assert.deepEqual(look(host), { rank: 'Captain', wearing: 'a long coat', condition: 'wet' });
    await reread(host, first, block('Short.', ['~ you rank: Veteran']));
    assert.equal(look(host).rank, 'Veteran');
    const live = look(host);
    host.store.rebuild();
    assert.deepEqual(look(host), live);
});

test('clearing the label (and no game rank) leaves the story with no Rank again, and the label the reader typed is not a pack\'s', async t => {
    const host = await ownHost(t);
    await host.packs.packs.setOwn('rankLabel', '');
    assert.equal(host.sdk.query('packs.youRank'), null);
    const none = await ownHost(t, '');
    assert.equal(none.sdk.query('packs.youRank'), null);
});
