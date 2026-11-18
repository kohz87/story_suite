// Pack format 4, F2, on the real store: a waiting pack link is named from the head's people alone (people.dossier), so a swipe of the reply that met
// the other person hides it again, a swipe back shows it, and a middle delete, a rewind and a reload show what the head holds. The stored record never changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { peopleRig, record } from './helpers/people-rig.js';

const settleSync = () => new Promise(resolve => setTimeout(resolve, 30));
const LINE = 'ORRIN — her late husband\'s brother';
const fenna = record('fenna', {
    name: 'Fenna',
    castFrom: { key: 'ersveil:fenna', pack: 'ersveil', id: 'fenna', links: { keyRelationships: [{ id: 'orrin', text: 'her late husband\'s brother' }], ties: [{ id: 'orrin', tag: 'kin' }] } },
});
const orrin = record('orrin', { castFrom: { key: 'ersveil:orrin', pack: 'ersveil', id: 'orrin' } });
const bonds = rig => rig.host.sdk.query('people.dossier', { name: 'Fenna' })?.keyRelationships ?? [];
const storedFenna = rig => JSON.stringify(rig.host.head().domains.people.npcs.npc_fenna);

test('a waiting link follows the head: named once the other person is stored; a swipe, a swipe back, a middle delete, a rewind and a reload agree with the head', async t => {
    const rig = await peopleRig(t);
    await rig.reply('Fenna at the ferry.', state => { state.npcs.push(structuredClone(fenna)); });
    assert.deepEqual(bonds(rig), [], 'Orrin not met: nothing of him');
    assert.doesNotMatch(JSON.stringify(rig.host.sdk.query('people.dossier', { name: 'Fenna' })), /orrin|ORRIN/);
    const stored = storedFenna(rig);
    await rig.reply('Orrin walks up the quay.', state => { state.npcs.push(structuredClone(orrin)); });
    const metAt = rig.host.store.headIndex();
    assert.deepEqual(bonds(rig), [LINE], 'met: named');
    assert.equal(storedFenna(rig), stored, 'Fenna\'s stored record is unchanged');

    await rig.host.swipe('The quay is empty.');
    await settleSync();
    assert.equal(await rig.settle(), true);
    assert.equal(rig.host.head().domains.people.npcs.npc_orrin, undefined, 'the swipe took Orrin\'s meeting back');
    assert.deepEqual(bonds(rig), [], 'after a swipe: hidden again');

    await rig.host.st.swipeTo(metAt, 0);
    await settleSync();
    await rig.settle();
    assert.ok(rig.host.head().domains.people.npcs.npc_orrin, 'the swipe back brings Orrin\'s meeting back');
    assert.deepEqual(bonds(rig), [LINE], 'after a swipe back: named again');

    await rig.host.send('On.', 'Later.');
    await settleSync();
    await rig.publish(() => {});
    await rig.host.st.deleteMessage(rig.host.store.headIndex() - 1);
    await settleSync();
    assert.equal(await rig.settle(), true);
    assert.deepEqual(bonds(rig), [LINE], 'after a middle delete (Orrin\'s meeting stays): still named');
    const keep = await rig.reload();
    assert.equal(await keep.settle(), true);
    assert.deepEqual(bonds(keep), [LINE], 'after a reload: the same');
    assert.equal(storedFenna(keep), stored);

    // A rewind to before Orrin's meeting: the replies from it on are deleted.
    while (rig.host.store.headIndex() >= metAt) { await rig.host.st.deleteMessage(rig.host.ctx.chat.length - 1); await settleSync(); }
    assert.equal(await rig.settle(), true);
    assert.equal(rig.host.head().domains.people.npcs.npc_orrin, undefined, 'the rewind took Orrin\'s meeting back');
    assert.deepEqual(bonds(rig), [], 'after a rewind: hidden again');
    await rig.host.ctx.saveChat();   // ST saves the chat after a delete
    const again = await rig.reload();
    assert.equal(await again.settle(), true);
    assert.deepEqual(bonds(again), [], 'after a reload of the rewound chat: still hidden');
    assert.equal(storedFenna(again), stored, 'and the stored record is still as made');
});
