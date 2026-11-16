// npc.cast is the store's people (P4): every stored, not archived dossier once, with the meters the change lines keep in the people domain's bonds; someone a
// line names with no stored dossier (the reader's own persona, a passer-by) has meters in the bonds but is not in the cast; archived people stay out
// (as in npc.known) until the record shape cleanup replaces archiving. The same after a swipe, a middle delete and a reload.
import test from 'node:test';
import assert from 'node:assert/strict';
import { peopleRig, record } from './helpers/people-rig.js';

const settleSync = () => new Promise(resolve => setTimeout(resolve, 30));
const castNames = rig => rig.host.sdk.query('npc.cast', {}).map(entry => entry.name).sort();
const activeNames = rig => { const people = rig.host.head().domains.people; return people.order.map(id => people.npcs[id]).filter(person => person.archived !== true).map(person => person.name).sort(); };

test('the cast equals the store\'s active people: a persona line keeps bonds only, an archived person is out, and so after swipe, delete and reload', async t => {
    const rig = await peopleRig(t);
    await rig.reply('Mira is here.');
    await rig.host.send('Go.', 'Astra laughs with Mira.\n\n<Changes>\n~ npc Astra | trust: +3\n~ npc MIRA | trust: +2\n</Changes>');
    await settleSync();
    assert.equal(await rig.publish(state => { state.npcs.push(record('sel', { archived: true })); }), true);
    const bonds = rig.host.head().domains.people.bonds.npcs;
    assert.ok(bonds.npc_astra, 'the persona line keeps meters under an npc_ id');
    assert.ok(bonds.npc_mira, 'Mira\'s meters are under her dossier id');
    assert.deepEqual(castNames(rig), activeNames(rig));
    assert.deepEqual(castNames(rig), ['MIRA', 'TOM']);
    assert.equal(rig.host.sdk.query('npc.cast', {}).find(entry => entry.name === 'MIRA').key, 'npc_mira');
    await rig.host.swipe('Nobody laughs.');
    await settleSync();
    assert.equal(await rig.settle(), true);
    assert.deepEqual(castNames(rig), activeNames(rig), 'after a swipe');
    await rig.host.send('On.', 'Later.');
    await settleSync();
    await rig.publish(() => {});
    await rig.host.st.deleteMessage(rig.host.store.headIndex() - 2);
    await settleSync();
    assert.equal(await rig.settle(), true);
    assert.deepEqual(castNames(rig), activeNames(rig), 'after a middle delete');
    const again = await rig.reload();
    assert.equal(await again.settle(), true);
    assert.deepEqual(castNames(again), activeNames(again), 'after a reload');
});
