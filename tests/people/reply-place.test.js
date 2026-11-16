// The "replaced reply" rule reads the reply's real place in the story (its index in the host's history), never the block ordinal inside a reply, with the REAL testkit host.
// A plain new reply calls no rescan; a last delete (and the reply after it) does not re-read what was read; a swipe is seen as the same place replaced.
import test from 'node:test';
import assert from 'node:assert/strict';
import { peopleRig } from './helpers/people-rig.js';

test('a plain new reply calls no rescan (every reply has block ordinal 0 in the real host)', async t => {
    const rig = await peopleRig(t);
    for (let n = 1; n <= 4; n++) assert.equal(await rig.reply(`Turn ${n}.`, state => { state.npcs[0].trust = n; }), true);
    assert.equal((await rig.host.sdk.timeline.head({})).source.ordinal, 0, 'the block ordinal is not a reply position');
    assert.equal(rig.rescans.length, 0);
});

test('a last delete then a new reply rescans nothing the cache already stood on: only the new reply is read', async t => {
    const rig = await peopleRig(t);
    await rig.reply('One.', state => { state.npcs[0].trust = 1; });
    await rig.reply('Two.', state => { state.npcs[0].trust = 2; });
    await rig.host.st.deleteMessage(rig.host.ctx.chat.length - 1);
    assert.equal(await rig.settle(), true);
    assert.equal(rig.rescans.length, 0, 'a delete reads nothing again');
    await rig.reply('Three.', state => { state.npcs[0].trust = 3; });
    assert.equal(rig.rescans.length, 0, 'the clamp holds the marker; the new reply is read by the ordinary scan');
});

test('a swipe is seen as a replaced reply', async t => {
    const rig = await peopleRig(t);
    await rig.reply('One.', state => { state.npcs[0].trust = 1; });
    await rig.reply('Two.', state => { state.npcs[0].trust = 2; });
    const before = rig.rescans.length;
    await rig.host.swipe('Another take, with more in it.');
    for (let i = 0; i < 100 && rig.rescans.length === before; i += 1) await new Promise(resolve => setTimeout(resolve, 10));
    assert.ok(rig.rescans.length > before, 'the swipe at the same place asked for a re-read');
});
