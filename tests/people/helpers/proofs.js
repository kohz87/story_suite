// The proofs of the one timeline (PEOPLE-PLAN P3), checked at the head with no publication in between: NPC State's cache equals the store's slice, the slice
// equals an independent rebuild of the chat at the head (the oracle), and the Delta queries answer the same people as the store.
import assert from 'node:assert/strict';
import { rebuildAt } from '../../suite/qa/helpers/oracle.js';
import { hashJson } from '../../../modules/people/adapter/hash.js';

/** Waits until the cache equals the store at the head (hydrate has run), then asserts the three equalities. `label` names the step. */
export async function proveHead(rig, label) {
    assert.equal(await rig.settle(), true, `${label}: the cache and the store agree`);
    const head = rig.host.head().domains.people ?? { v: 1, order: [], npcs: {} };
    assert.equal(hashJson(rig.stored()), hashJson(rig.expected()), `${label}: cache == store slice`);
    const oracle = rebuildAt(rig.host.ctx.chat, rig.host.store.headIndex()).state?.domains?.people;
    if (oracle !== undefined) assert.deepEqual(head, oracle, `${label}: store slice == oracle rebuild`);
    const stored = head.order.map(id => head.npcs[id]).filter(record => !(record.lifeState === 'deceased' && record.lifeStateCertainty === 'explicit'));
    const known = rig.host.sdk.query('npc.known', {});
    assert.deepEqual([...known].sort(), stored.map(record => record.name).sort(), `${label}: npc.known lists the store's people`);
    for (const record of stored) {
        const dossier = rig.host.sdk.query('npc.dossier', { name: record.name });
        assert.equal(dossier?.name, record.name, `${label}: npc.dossier answers ${record.name}`);
    }
    for (const id of head.order) {
        const ident = rig.host.sdk.query('npc.identity', { name: head.npcs[id].name });
        assert.equal(ident?.nativeKey, id, `${label}: npc.identity names ${id}`);
    }
}
