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

test('a change NPC State makes while the death is being stored is kept, and so is the scan bookkeeping (no lost update, no whole-state hydrate)', async t => {
    const box = { during: null };
    const rig = await peopleRig(t, {
        wrapSdk: sdk => ({ ...sdk, command: async (name, ...rest) => { const out = await sdk.command(name, ...rest); if (name === 'people.write' && box.during) { const run = box.during; box.during = null; run(); } return out; } }),
    });
    await rig.reply('Mira is here.');
    const who = identityOf(rig, 'MIRA');
    const hydrations = rig.hydrations.length;
    rig.live.state.pendingBackfills = [{ id: 'bf1' }];
    rig.live.state.readAhead = [3];
    // While the death's write is awaited, a scan adds Wren and moves Mira's mood (its own announcement may come later; the death's last commit stores the cache as it is).
    box.during = () => {
        rig.live.state.npcs.push({ id: 'npc_wren', name: 'WREN', aliases: [], present: true, lifeState: 'alive' });
        rig.live.state.npcs.find(item => item.id === 'npc_mira').mood = 'shaken';
    };
    const out = await rig.adapter.confirmDeath({ event: 'de_r2', npc: who.id, expectedHead: await headOf(rig) });
    assert.equal(out.ok, true, out.message);
    const mira = rig.live.state.npcs.find(item => item.id === 'npc_mira');
    assert.equal(mira.lifeState, 'deceased', 'the death is on the cache');
    assert.equal(mira.mood, 'shaken', 'the change made during the commit is on the dead person\'s record too');
    assert.ok(rig.live.state.npcs.some(item => item.id === 'npc_wren'), 'the person made during the commit is kept');
    assert.deepEqual(rig.live.state.pendingBackfills, [{ id: 'bf1' }], 'pending backfills stay');
    assert.deepEqual(rig.live.state.readAhead, [3], 'read-ahead stays');
    assert.equal(rig.hydrations.length, hydrations, 'no whole-state hydrate');
    assert.equal(await rig.settle(), true, 'the store gets the cache as it is now');
    assert.equal(rig.host.head().domains.people.npcs.npc_mira.lifeState, 'deceased');
    assert.equal(rig.host.head().domains.people.npcs.npc_wren.name, 'WREN');
});
