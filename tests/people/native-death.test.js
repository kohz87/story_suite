// A death the host confirmed reaches NPC State with no timeline participant: the dossier is deceased in npc.dossier and in the store, the refusals hold, and a delete of the lethal reply brings the person back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { peopleRig } from './helpers/people-rig.js';

const headOf = async rig => (await rig.host.sdk.timeline.head({})).headHash;
const identityOf = (rig, name) => rig.host.sdk.query('npc.identity', { name });

test('a confirmed death is deceased in npc.dossier and in the store, and the lethal reply\'s delete brings the person back', async t => {
    const rig = await peopleRig(t);
    await rig.reply('Mira is here.');
    const who = identityOf(rig, 'MIRA');
    assert.match(who.id, /^np_/);
    assert.equal(rig.host.sdk.query('npc.dossier', { id: who.id }).lifeState, 'alive');
    await rig.host.send('Go on.', 'The lethal reply.');
    const out = await rig.adapter.confirmDeath({ event: 'de_death001', npc: who.id, expectedHead: await headOf(rig) });
    assert.equal(out.ok, true, out.message);
    assert.equal(rig.host.sdk.query('npc.dossier', { id: who.id }).lifeState, 'deceased');
    assert.equal(rig.host.head().domains.people.npcs.npc_mira.lifeState, 'deceased', 'the store holds the death');
    assert.equal(rig.host.sdk.query('npc.dossier', { name: 'MIRA' }), null, 'a dead person is not found by name');
    assert.equal((await rig.adapter.confirmDeath({ event: 'de_death001', npc: who.id, expectedHead: await headOf(rig) })).ack, true, 'the same event again is acknowledged');
    assert.equal((await rig.adapter.confirmDeath({ event: 'de_death001', npc: identityOf(rig, 'TOM').id, expectedHead: await headOf(rig) })).code, 'CONFLICT');
    assert.equal(await rig.settle(), true);
    await rig.host.st.deleteMessage(rig.host.ctx.chat.length - 1);
    assert.equal(await rig.settle(), true, 'the cache and the store agree again');
    assert.equal(rig.host.sdk.query('npc.dossier', { id: who.id })?.lifeState, 'alive', 'deleting the lethal reply brings the person back');
    assert.equal(rig.host.head().domains.people.npcs.npc_mira.lifeState, 'alive');
    assert.deepEqual(rig.host.store.problems(), []);
});

test('a death is refused for an unknown id (never a name), a head that moved and a bad call; nothing is stored', async t => {
    const rig = await peopleRig(t);
    await rig.reply('Mira is here.');
    const head = await headOf(rig);
    assert.equal((await rig.adapter.confirmDeath({ event: 'de_a', npc: 'np_missing0', expectedHead: head })).code, 'REFUSED');
    assert.equal((await rig.adapter.confirmDeath({ event: 'de_a', npc: 'Old Tom', expectedHead: head })).code, 'REFUSED');
    assert.equal((await rig.adapter.confirmDeath({ event: 'de_a', npc: '', expectedHead: head })).code, 'INVALID');
    const who = identityOf(rig, 'MIRA');
    assert.equal((await rig.adapter.confirmDeath({ event: 'de_b', npc: who.id, expectedHead: 'f'.repeat(64) })).code, 'STALE');
    assert.equal(rig.host.head().domains.people.npcs.npc_mira.lifeState, 'alive');
});

test('a death the store refuses leaves the cache as the store says; the retry checks the store before it answers ok', async t => {
    const box = { fail: false };
    const rig = await peopleRig(t, {
        wrapSdk: sdk => ({ ...sdk, command: async (name, ...rest) => { if (name === 'people.write' && box.fail) { box.fail = false; return { ok: false, code: 'FAILED', message: 'probe' }; } return sdk.command(name, ...rest); } }),
    });
    await rig.reply('Mira is here.');
    const who = identityOf(rig, 'MIRA');
    const input = { event: 'de_retry01', npc: who.id, expectedHead: await headOf(rig) };
    box.fail = true;
    const first = await rig.adapter.confirmDeath(input);
    assert.equal(first.ok, false);
    assert.equal(first.code, 'FAILED');
    assert.equal(rig.host.head().domains.people.npcs.npc_mira.lifeState, 'alive', 'the store never got the death');
    assert.equal(rig.host.sdk.query('npc.dossier', { id: who.id }).lifeState, 'alive', 'the cache stays as the store says');
    const retry = await rig.adapter.confirmDeath({ ...input, expectedHead: await headOf(rig) });
    assert.equal(retry.ok, true, retry.message);
    assert.equal(rig.host.head().domains.people.npcs.npc_mira.lifeState, 'deceased', 'ok only once the store holds the death');
    assert.equal(rig.host.sdk.query('npc.dossier', { id: who.id }).lifeState, 'deceased');
    assert.deepEqual(rig.host.store.problems(), []);
});
