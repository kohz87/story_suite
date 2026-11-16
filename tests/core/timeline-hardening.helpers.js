import assert from 'node:assert/strict';
import { createHost } from '../../packages/story-block/testkit/index.js';
import { BATCH, DEATH, nativeModule, rulesModule, seal, track } from './helpers/timeline.js';

export const reply = (text, lines = []) => (lines.length ? `${text}\n\n<Changes>\n${lines.join('\n')}\n</Changes>` : text);
export const cmd = async (host, type, payload = {}) => assert.equal((await host.sdk.command(type, payload)).ok, true, type);

// A story with a save, a dead timeline on top of it (xp 140, the dossier changed, the batch sealed) and a restore prepared.
export async function world(t, { modules = [], native = nativeModule(), prepare = true } = {}) {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    t.mock.method(console, 'warn', () => {});
    const hook = { at: async phase => { await hook.on?.(phase); } };
    const host = await createHost({ modules: [rulesModule(), native.def, ...modules], timelineFaults: hook });
    t.after(() => host.close());
    await host.send('Go.', reply('A.', ['+ coin 10']));
    await cmd(host, 'tl.xp', { amount: 40 });
    const saved = (await host.sdk.timeline.make({ kind: 'manual', name: 'Save' })).snapshot;
    const disk = track(host);
    await cmd(host, 'tl.xp', { amount: 100 });
    native.native.edit(state => { state.dossiers.tavi.trust = 99; });
    await seal(host);
    const head = await host.sdk.timeline.head();
    const prepared = prepare ? await host.timeline.host.prepare({ snapshot: saved.id, deathEvents: DEATH, batchResult: BATCH, expectedHead: head.headHash }) : null;
    if (prepare) assert.equal(prepared.ok, true, prepared.message);
    const activate = () => host.timeline.host.activate({ prepared: prepared.prepared, expectedHead: head.headHash });
    return { host, native, hook, saved, disk, head, prepared, activate, modules: () => [rulesModule(), native.def, ...modules] };
}
export const hasReceipt = (image, type) => JSON.stringify(image.chat).includes(`"type":"${type}"`);
export const restoreFrom = async (host, saved) => {
    await seal(host);
    const head = await host.sdk.timeline.head();
    return host.timeline.host.prepare({ snapshot: saved.id, deathEvents: DEATH, batchResult: BATCH, expectedHead: head.headHash });
};
