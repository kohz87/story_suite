import assert from 'node:assert/strict';
import { createParticipant, memoryVault } from '../../modules/people/legacy/storysuite-participant/index.js';
import { freshState } from './helpers/participant-rig.js';

export const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
};

export function participantRig(options = {}) {
    const live = { state: freshState(), chatKey: 'chat:avatar.png:one' };
    const vault = memoryVault();
    const port = {
        chatKey: () => live.chatKey,
        readState: () => structuredClone(live.state),
        writeTimeline: async block => { live.state.timeline = structuredClone(block); },
    };
    const delta = createParticipant({ port, vault, boundMs: 120, ...options });
    return { live, vault, port, delta };
}

export async function leaveIndexRepair(r) {
    const entered = deferred();
    const release = deferred();
    const putIndex = r.vault.putIndex.bind(r.vault);
    let calls = 0;
    r.vault.putIndex = async (lineage, index) => {
        calls += 1;
        if (calls === 1) { entered.resolve(); await release.promise; }
        if (calls === 2) throw new Error('index temporarily unavailable');
        return putIndex(lineage, index);
    };
    const slow = r.delta.participant.checkpoint({ headHash: 'e'.repeat(64) });
    await entered.promise;
    assert.equal((await slow).code, 'STALE');
    release.resolve();
    await new Promise(resolve => setImmediate(resolve));
}
