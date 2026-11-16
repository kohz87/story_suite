// The publication tells the people mirror after an ok native change, but waits at most `mirrorMs` for it: a mirror that never answers must not stall publication.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createParticipant, memoryVault } from '../src/storysuite-participant/index.js';

const npc = (id, name) => ({ id, name, aliases: [], archived: false, present: true, lifeState: 'alive', trust: 3 });

async function rig(onPublished, mirrorMs) {
    const live = { state: { npcs: [npc('npc_ann', 'Ann')], lineage: ['m0', 'm1'], lastScannedMessageId: 1 } };
    const port = {
        chatKey: () => 'chat:k:one', readState: () => structuredClone(live.state), chatLineage: () => ['m0', 'm1'], enabled: () => true,
        installState: async state => { live.state = structuredClone(state); },
        writeTimeline: async block => { live.state = { ...live.state, timeline: structuredClone(block) }; },
        warn: () => {},
    };
    const made = createParticipant({ port, vault: memoryVault(), now: () => 1000, random: () => 0.5, onPublished, mirrorMs });
    await made.hydrate();
    assert.equal((await made.participant.checkpoint({ cursor: { sid: 'sr_1' }, headHash: '1'.repeat(64) })).ok, true);
    made.participant.attach({
        head: async () => ({ ok: true, headHash: 'a'.repeat(64) }),
        nativeMutation: async ({ prepare }) => { try { await prepare(); return { ok: true }; } catch (error) { return { ok: false, message: error.message }; } },
    });
    return { made, live };
}

test('a mirror that never answers does not stall the publication', async () => {
    let asked = 0;
    const { made } = await rig(() => { asked += 1; return new Promise(() => {}); }, 30);
    const started = Date.now();
    const out = await made.nativeChange({ source: { sid: 'a' }, edit: state => { state.npcs.push(npc('npc_bo', 'Bo')); } });
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.equal(asked, 1, 'the mirror was told once');
    assert.ok(Date.now() - started < 3000, 'the publication came back');
});

test('a mirror that answers in time gets the published state; one that throws does not fail the publication', async () => {
    const told = [];
    const quick = await rig(async published => { told.push(published.state.npcs.map(item => item.id)); }, 1000);
    assert.equal((await quick.made.nativeChange({ source: { sid: 'a' }, edit: state => { state.npcs.push(npc('npc_bo', 'Bo')); } })).ok, true);
    assert.deepEqual(told, [['npc_ann', 'npc_bo']]);
    const broken = await rig(() => { throw new Error('mirror down'); }, 1000);
    assert.equal((await broken.made.nativeChange({ source: { sid: 'a' }, edit: () => {} })).ok, true);
});
