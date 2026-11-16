// The people domain is deferred: state.domains.people is ABSENT until the first people.write. Absent means no people, never an error;
// the first write that creates it goes through (hash before = null); deleting the reply that first added it empties NPC State's cache.
import test from 'node:test';
import assert from 'node:assert/strict';
import { peopleRig } from './helpers/people-rig.js';

test('an absent people slice hydrates as no people and sends nothing for an empty cache', async t => {
    const rig = await peopleRig(t);
    await rig.host.send('Hello.', 'Nobody yet.');
    assert.equal(rig.host.head().domains.people, undefined, 'no slice before the first person');
    assert.equal(rig.host.sdk.query('people.hash', {}), null);
    await rig.host.send('Again.', 'Still nobody.');
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(rig.host.head().domains.people, undefined, 'an empty cache wrote nothing');
    assert.deepEqual(rig.sends, [], 'no people.write for nobody');
    assert.deepEqual(rig.warnings.filter(text => /could not (read|store)/.test(text)), [], 'absent is not an error');
    assert.deepEqual(rig.host.store.problems(), []);
});

test('the first people.write that creates the slice is stored (hash before is null)', async t => {
    const rig = await peopleRig(t);
    await rig.host.send('Hello.', 'Nobody yet.');
    assert.equal(rig.host.sdk.query('people.hash', {}), null);
    assert.equal(await rig.publish(() => {}), true);
    assert.deepEqual(rig.sends.slice(-1), ['ok']);
    assert.deepEqual(rig.host.head().domains.people.order, ['npc_mira', 'npc_tom']);
    assert.notEqual(rig.host.sdk.query('people.hash', {}), null);
    assert.deepEqual(rig.host.store.problems(), []);
});

test('deleting the reply that first added the people domain empties NPC State\'s cache', async t => {
    const rig = await peopleRig(t);
    await rig.reply('Mira is here.');
    assert.ok(rig.host.head().domains.people, 'the slice exists');
    const count = rig.hydrations.length;
    await rig.host.st.deleteMessage(rig.host.ctx.chat.length - 1);
    for (let i = 0; i < 100 && rig.live.state.npcs.length; i += 1) await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(rig.host.head().domains.people, undefined, 'the slice is gone with its reply');
    assert.equal(rig.live.state.npcs.length, 0, 'the cache holds nobody');
    assert.ok(rig.hydrations.length > count, 'the cache hydrated from the absent slice');
    assert.deepEqual(rig.host.store.problems(), []);
});

// A chat that never has people stays peopleless through every operation: no slice, an empty cache, no people.write, no warning, no store problem.
test('a chat with no people stays peopleless through two swipes, middle delete, Re-read, reload, a reply after it and a branch', async t => {
    let rig = await peopleRig(t);
    const quiet = async step => {
        await new Promise(resolve => setTimeout(resolve, 60));
        assert.equal(rig.host.head().domains.people, undefined, `${step}: no slice`);
        assert.equal(rig.live.state.npcs.length, 0, `${step}: the cache holds nobody`);
        assert.deepEqual(rig.sends, [], `${step}: no people.write`);
        assert.deepEqual(rig.warnings.filter(text => /could not (read|store)/.test(text)), [], `${step}: no warning`);
        assert.deepEqual(rig.host.store.problems(), [], `${step}: no store problem`);
    };
    for (let n = 1; n <= 4; n++) await rig.host.send(`Turn ${n}.`, `Nobody ${n}.`);
    await quiet('replies');
    await rig.host.swipe('Another nobody.');
    await quiet('swipe');
    await rig.host.swipe('Yet another.');
    await quiet('another swipe');
    await rig.host.st.deleteMessage(3);
    await quiet('middle delete');
    await rig.host.turn.reread(rig.host.store.headIndex());
    await quiet('Re-read');
    rig = await rig.reload();
    await quiet('reload');
    await rig.host.send('After the reload.', 'Still nobody.');
    await quiet('a reply after the reload');
    await rig.host.ctx.branchChat(rig.host.ctx.chat.length - 3);
    await quiet('branch');
});
