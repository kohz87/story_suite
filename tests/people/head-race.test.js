// The head moves between NPC State Delta's change and its `people.write` (P3): the cache stands on the reply it was hydrated for, the host answers `STALE`, nothing
// lands on the wrong carrier, the work is discarded (it belonged to a reply that is gone) and the cache hydrates again from the store: no later publication is needed.
// The race is made by a reply committed just before `people.write` reaches the host.
import test from 'node:test';
import assert from 'node:assert/strict';
import { peopleRig, idOf } from './helpers/people-rig.js';
import { proveHead } from './helpers/proofs.js';

const trustAt = (rig, index) => rig.host.store.at(index).domains.people?.npcs[idOf('mira')]?.trust ?? null;

// A rig whose first `people.write` waits for `race()` (a reply that commits in between); the hook is used once per arming.
async function racing(t) {
    const box = { race: null };
    const rig = await peopleRig(t, {
        wrapSdk: sdk => ({ ...sdk, command: async (name, ...rest) => { if (name === 'people.write' && box.race) { const race = box.race; box.race = null; await race(); } return sdk.command(name, ...rest); } }),
    });
    return { rig, box };
}

test('a reply commits between the change and the write: STALE, nothing on any carrier, the cache hydrates from the store', async t => {
    const { rig, box } = await racing(t);
    await rig.reply('One.', state => { state.npcs[0].trust = 1; });
    const old = rig.host.store.headIndex();
    box.race = () => rig.host.send('Race.', 'Race reply.');
    await rig.publish(state => { state.npcs[0].trust = 50; }, 200);
    const head = rig.host.store.headIndex();
    assert.ok(head > old, 'the race moved the head');
    assert.ok(rig.sends.includes('STALE'), `the host refused the old source: ${rig.sends}`);
    assert.equal(trustAt(rig, old), 1, 'the old carrier keeps its own people');
    assert.equal(trustAt(rig, head), 1, 'the discarded change is nowhere (the new reply carries the people of before it)');
    await proveHead(rig, 'after the race');
    assert.equal(rig.live.state.npcs[0].trust, 1, 'the cache took the store\'s people back');
    assert.deepEqual(rig.warnings, [], 'a stale send is not a problem to the reader');
    assert.equal(await rig.publish(state => { state.npcs[0].trust = 2; }), true, 'the next change stores at the new head');
    assert.equal(trustAt(rig, head), 2);
});

test('a race on a swipe: each swipe\'s carrier keeps its own people', async t => {
    const { rig, box } = await racing(t);
    await rig.reply('One.', state => { state.npcs[0].trust = 1; });
    const index = rig.host.store.headIndex();
    await rig.host.swipe('Another.');
    box.race = () => rig.host.st.swipeTo(index, 0);
    await rig.publish(state => { state.npcs[0].trust = 60; }, 300);
    assert.ok(rig.sends.includes('STALE'), `refused: ${rig.sends}`);
    assert.equal(trustAt(rig, index), 1, 'the first swipe was not written to');
    await proveHead(rig, 'after the swipe race');
});

test('three races in a row: every refused change is discarded and the cache stays equal to the store', async t => {
    const { rig, box } = await racing(t);
    await rig.reply('One.', state => { state.npcs[0].trust = 1; });
    for (let n = 2; n <= 4; n++) {
        box.race = () => rig.host.send(`Race ${n}.`, `Race reply ${n}.`);
        await rig.publish(state => { state.npcs[0].trust = n * 10; }, 200);
        await proveHead(rig, `race ${n}`);
    }
    assert.equal(rig.sends.filter(code => code === 'STALE').length, 3);
    assert.equal(trustAt(rig, rig.host.store.headIndex()), 1);
});
