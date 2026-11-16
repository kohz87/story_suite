import assert from 'node:assert/strict';
import { createHost } from '../../packages/story-block/testkit/index.js';
import { director, T1, T2 } from '../../packages/story-block/tests/v2/helpers/evidence.js';
import { nativeModule, rulesModule, seal, slice } from '../../packages/story-block/tests/v2/helpers/timeline.js';

export const reply = (text, lines = []) => (lines.length ? `${text}\n\n<Changes>\n${lines.join('\n')}\n</Changes>` : text);
export const cmd = (host, type, payload = {}) => host.sdk.command(type, payload).then(result => {
    assert.equal(result.ok, true, `${type}: ${result.message}`);
    return result;
});

// A story with a bit of everything on it, a manual save, and then more of the same: the dead timeline.
export async function story(t, { extra = [], options = {}, configure = null } = {}) {
    const native = nativeModule();
    configure?.(native);
    const host = await createHost({ modules: [rulesModule(), native.def, director(), ...extra], ...options });
    t.after(() => host.close());
    await host.send('Hello.', reply('The road.', ['+ coin 30', '+ item Torch | qty: 2', '~ place Bluewatch | kind: settlement', '+ present Tavi']));
    await cmd(host, 'tl.time', { minutes: 600 });
    await cmd(host, 'tl.xp', { amount: 40 });
    await cmd(host, 'tl.hurt', { amount: 4 });
    await cmd(host, 'tl.equip', { slot: 'hand', item: 'Sword' });
    await cmd(host, 'tl.fight', { id: 'fi_first001', round: 1 });
    await cmd(host, 'tl.train', { session: 'tr_one00001', paid: 10 });
    await cmd(host, 'tl.meter', { npc: 'tavi', value: 3 });
    await cmd(host, 'tl.claim', { key: 'early' });
    await cmd(host, 'sd.accept', { thread: T1, selection: 'Yes' });
    const saved = (await host.sdk.timeline.make({ kind: 'manual', name: 'Before the cave' })).snapshot;
    const atSave = slice(host.head());
    const proofsAtSave = host.sdk.query('story.evidence', {}).map(proof => proof.id);
    // The dead timeline: everything moves on.
    await host.send('Onward.', reply('The cave.', ['+ coin 50', '- item Torch | qty: 1', '+ item Rope', '~ place Cave | kind: dungeon', '- present Tavi', '+ present Orrin']));
    await cmd(host, 'tl.time', { minutes: 900 });
    await cmd(host, 'tl.xp', { amount: 100 });
    await cmd(host, 'tl.hurt', { amount: 15 });
    await cmd(host, 'tl.unequip', { slot: 'hand' });
    await cmd(host, 'tl.equip', { slot: 'head', item: 'Helm' });
    await cmd(host, 'tl.fight', { id: 'fi_second01', round: 4 });
    await cmd(host, 'tl.train', { session: 'tr_two00001', paid: 25 });
    await cmd(host, 'tl.meter', { npc: 'tavi', value: 5 });
    await cmd(host, 'tl.meter', { npc: 'orrin', value: 2 });
    await cmd(host, 'tl.claim', { key: 'late' });
    await cmd(host, 'sd.accept', { thread: T2, selection: 'Later' });
    native.native.edit(state => { state.dossiers.tavi.trust = 99; state.dossiers.orrin = { trust: 1 }; });
    await seal(host);   // the lethal batch is sealed on the dead timeline (the owner of the death domain holds the result)
    return { host, native, saved, atSave, proofsAtSave };
}
