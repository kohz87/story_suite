// The cast-remake gap (P3 review, P4): a dossier made for a reply (the cast meeting), a swipe that removes it, then the same person made again on the new
// swipe: the store, NPC State's cache, npc.cast and npc.dossier hold her once, never twice and never not at all; swiping back keeps one record too.
import test from 'node:test';
import assert from 'node:assert/strict';
import { peopleRig, record } from './helpers/people-rig.js';

const settleSync = () => new Promise(resolve => setTimeout(resolve, 30));
const wren = () => record('wren', { castFrom: { pack: 'ersveil', id: 'wren' } });
const count = (list, id) => list.filter(item => item?.id === id).length;

test('made, swiped away, made again: one Wren in the store, the cache, npc.cast and npc.dossier', async t => {
    const rig = await peopleRig(t);
    await rig.reply('Mira is here.');
    await rig.host.send('On.', 'Wren steps out of the crowd.');
    await settleSync();
    assert.equal(await rig.publish(state => { state.npcs.push(wren()); }), true);
    assert.ok(rig.host.head().domains.people.npcs.npc_wren, 'made for the reply');
    await rig.host.swipe('Nobody steps out.');
    await settleSync();
    assert.equal(await rig.settle(), true);
    assert.equal(rig.host.head().domains.people.npcs.npc_wren, undefined, 'the swipe took her away');
    assert.equal(count(rig.live.state.npcs, 'npc_wren'), 0, 'and from the cache');
    await rig.host.swipe('Wren steps out after all.');
    await settleSync();
    assert.equal(await rig.publish(state => { if (!state.npcs.some(item => item.id === 'npc_wren')) state.npcs.push(wren()); }), true);
    assert.equal(rig.host.head().domains.people.order.filter(id => id === 'npc_wren').length, 1, 'once in the store');
    assert.equal(count(rig.live.state.npcs, 'npc_wren'), 1, 'once in the cache');
    assert.equal(rig.host.sdk.query('npc.cast', {}).filter(entry => entry.name === 'WREN').length, 1, 'once in the cast');
    assert.equal(rig.host.sdk.query('npc.dossier', { name: 'WREN' })?.name, 'WREN', 'her dossier answers');
    await rig.host.st.swipeTo(rig.host.store.headIndex(), 0);
    await settleSync();
    assert.equal(await rig.settle(), true);
    assert.equal(rig.host.head().domains.people.order.filter(id => id === 'npc_wren').length, 1, 'swiping back to the first swipe: once');
    assert.equal(count(rig.live.state.npcs, 'npc_wren'), 1);
    assert.deepEqual(rig.host.store.problems(), []);
});
