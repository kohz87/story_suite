// The head moves between NPC State Delta's publication and its mirror (J07 step 5): the host answers `STALE`, nothing lands on the wrong carrier,
// the mirror owes the change and the head event heals it. The race is made by a reply committed just before `people.mirror` reaches the host.
import test from 'node:test';
import assert from 'node:assert/strict';
import { peopleRig, idOf } from './helpers/people-rig.js';
import { hashJson } from '../../packages/npc-state-delta/src/storysuite-participant/hash.js';

const trustAt = (rig, index) => rig.host.store.at(index).domains.people?.npcs[idOf('mira')]?.trust ?? null;

// A rig whose first `people.mirror` waits for `race()` (a reply that commits in between); the hook is used once per arming.
async function racing(t) {
    const box = { race: null };
    const rig = await peopleRig(t, {
        wrapSdk: sdk => ({ ...sdk, command: async (name, ...rest) => { if (name === 'people.mirror' && box.race) { const race = box.race; box.race = null; await race(); } return sdk.command(name, ...rest); } }),
    });
    return { rig, box };
}

test('a reply commits between the publication and the mirror: STALE, nothing on the old carrier, healed at the new head', async t => {
    const { rig, box } = await racing(t);
    await rig.reply('One.', state => { state.npcs[0].trust = 1; });
    const old = rig.host.store.headIndex();
    box.race = () => rig.host.send('Race.', 'Race reply.');
    await rig.publish(state => { state.npcs[0].trust = 50; }, 3000);
    const head = rig.host.store.headIndex();
    assert.ok(head > old, 'the race moved the head');
    assert.ok(rig.sends.includes('STALE'), `the host refused the old source: ${rig.sends}`);
    assert.equal(trustAt(rig, old), 1, 'the old carrier keeps its own people');
    assert.equal(hashJson(rig.host.head().domains.people), hashJson(rig.expected()), 'the head equals the view of Delta\'s state');
    assert.equal(trustAt(rig, head), 50, 'the heal wrote at the new head');
    assert.deepEqual(rig.warnings, [], 'a stale send is not a problem to the reader');
});

test('a race on a swipe: the new swipe\'s carrier and the first one each keep their own people', async t => {
    const { rig, box } = await racing(t);
    await rig.reply('One.', state => { state.npcs[0].trust = 1; });
    const index = rig.host.store.headIndex();
    await rig.host.swipe('Another.');
    box.race = () => rig.host.st.swipeTo(index, 0);
    await rig.publish(state => { state.npcs[0].trust = 60; }, 1500);
    await new Promise(resolve => setTimeout(resolve, 300));
    assert.ok(rig.sends.includes('STALE'), `refused: ${rig.sends}`);
    assert.equal(trustAt(rig, index), 1, 'the first swipe was not written to');
    assert.equal(await rig.settle(3000), true, 'the head equals the view of Delta\'s state after the heal');
});

test('three races in a row: every send that was refused is owed and the last head is whole', async t => {
    const { rig, box } = await racing(t);
    await rig.reply('One.', state => { state.npcs[0].trust = 1; });
    for (let n = 2; n <= 4; n++) {
        box.race = () => rig.host.send(`Race ${n}.`, `Race reply ${n}.`);
        await rig.publish(state => { state.npcs[0].trust = n * 10; }, 3000);
    }
    assert.equal(rig.sends.filter(code => code === 'STALE').length, 3);
    assert.equal(hashJson(rig.host.head().domains.people), hashJson(rig.expected()));
    assert.equal(trustAt(rig, rig.host.store.headIndex()), 40);
});
