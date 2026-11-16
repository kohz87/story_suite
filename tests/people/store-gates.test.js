// P3 gates: portrait bytes never make a write INVALID; a rewind over a people block that no longer applies refuses like every other domain; the window before the host
// accepts the module holds back the sidecar (the persist side of it is proved in packages/npc-state-delta/tests/settings-debounce.test.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { createStorySuiteV2Adapter } from '../../modules/people/storysuite-v2.js';
import { peopleRig, record, idOf } from './helpers/people-rig.js';
import { proveHead } from './helpers/proofs.js';

const BYTES = 'data:image/png;base64,iVBORw0KGgo=';

test('portrait records that hold image bytes (a failed portrait file write) are stored as nothing, never INVALID', async t => {
    const rig = await peopleRig(t);
    // The shapes NPC State makes when savePortraitFile fails: `npc.portrait = { dataUrl, … }` (cast-dossier-parts/apply-entry.js) and the same record under portraitAssets
    // (runtime-hydration-state.js, runtime-mutations.js), next to a portrait that did reach a file.
    const ok = await rig.reply('One.', state => {
        state.npcs[0].portrait = { dataUrl: BYTES, type: 'image/png', hash: 'h1' };
        state.npcs[1].portrait = { path: '/user/files/npc-state-delta-portrait-abc.png', type: 'image/png', hash: 'abc' };
        state.npcs[1].lookNote = BYTES;
        state.portraitAssets = { [state.npcs[0].id]: { ...state.npcs[0].portrait }, [state.npcs[1].id]: { ...state.npcs[1].portrait } };
    });
    assert.equal(ok, true, `the write was accepted: ${rig.sends} ${rig.warnings}`);
    assert.equal(rig.sends.includes('INVALID'), false);
    const head = rig.host.head().domains.people;
    assert.equal(JSON.stringify(head).includes('base64'), false, 'no bytes in the store');
    assert.deepEqual(Object.keys(head.portraitAssets), [idOf('tom')], 'only the file reference is kept');
    assert.deepEqual(head.npcs[idOf('tom')].portrait, { path: '/user/files/npc-state-delta-portrait-abc.png', type: 'image/png', hash: 'abc' });
    // a later write on top of it is not refused either
    assert.equal(await rig.publish(state => { state.npcs[0].seenCount = 9; }), true);
    assert.equal(rig.sends.every(code => code === 'ok'), true, `${rig.sends}`);
    await proveHead(rig, 'with portraits');
});

// A rewind keeps the blocks of the reply up to a receipt; a kept block that no longer applies after a middle delete refuses it (store/write/records.js truncate).
// That is the one rule of the store: the inventory refuses the same way (control below), so the people follow it, and this test pins it as intended.
test('a rewind over a people block that no longer applies refuses, as the inventory does; a rewind that applies keeps cache and store equal', async t => {
    const rig = await peopleRig(t);
    for (let n = 1; n <= 5; n++) await rig.reply(`Turn ${n}.`, s => { s.turn = n; if (n === 2) s.npcs.push(record('vale')); if (n > 2) s.npcs.find(x => x.id === 'npc_vale').seenCount = n; });
    await rig.host.st.deleteMessage(4);   // the reply that added Vale
    await proveHead(rig, 'after the delete');
    await rig.publish(s => { s.npcs[0].seenCount = 77; });
    const index = rig.host.store.headIndex();
    const writes = rig.host.sdk.receipts().filter(entry => entry.index === index && entry.receipt.type === 'people.write');
    assert.ok(writes.length >= 2, 'two blocks on the head reply');
    const refused = await rig.host.sdk.rewind({ index, beforeRev: writes.at(-1).receipt.rev });
    assert.equal(refused.ok, false);
    assert.equal(refused.code, 'FAILED');
    assert.match(refused.message, /does not exist/);
    // control: the same shape with the inventory
    const inv = await createHost();
    t.after(() => inv.close());
    await inv.send('a', 'ok\n<Changes>\n+ item Rope\n</Changes>');
    await inv.send('b', 'ok2');
    await inv.send('c', 'ok3\n<Changes>\n- item Rope\n</Changes>');
    await inv.st.deleteMessage(2);
    await new Promise(resolve => setTimeout(resolve, 300));
    await inv.sdk.command('scene.place', { name: 'Hall' });
    const last = inv.sdk.receipts().at(-1);
    const same = await inv.sdk.rewind({ index: last.index, beforeRev: last.receipt.rev });
    assert.equal(same.ok, false, 'the inventory refuses too');
    assert.match(same.message, /does not exist/);
    // a rewind that applies (the head's own last block dropped) opens the branch; the cache follows the store
    const good = rig.host.sdk.receipts().filter(entry => entry.index === index && entry.receipt.type === 'people.write');
    const done = await rig.host.sdk.rewind({ index, beforeRev: good[0].receipt.rev });
    assert.equal(done.ok, true, done.message);
    await proveHead(rig, 'after a rewind');
});

test('before the host accepts the module the adapter holds the sidecar back; a refusal gives it back', async t => {
    const gates = [];
    const make = () => {
        const gate = {};
        gate.promise = new Promise((resolve, reject) => { gate.resolve = resolve; gate.reject = reject; });
        gates.push(gate);
        const sdk = { registerModule: () => gate.promise };
        const box = { ready: Promise.resolve(sdk), sdk };
        const adapter = createStorySuiteV2Adapter({
            host: () => box, doc: { documentElement: { dataset: {} }, getElementById: () => null, addEventListener() {}, dispatchEvent() { return true; } },
            delta: () => ({ isEnabled: () => true, chatKey: () => 'chat:x' }), loadEmptyCast: async () => null, logger: { warn() {} },
            timers: { setTimeout: (fn, ms) => { const id = setTimeout(fn, ms); id.unref?.(); return id; }, clearTimeout, setInterval: () => ({ unref() {} }), clearInterval() {} },
        });
        t.after(() => adapter.stop());
        return { adapter, gate };
    };
    t.mock.method(console, 'warn', () => {});
    assert.equal(createStorySuiteV2Adapter({ host: () => null, loadEmptyCast: async () => null }).storeOwns(), false, 'no host: nothing is held back');
    const a = make();
    a.adapter.start();
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(a.adapter.hosted(), false);
    assert.equal(a.adapter.storeOwns(), 'pending', 'a host is there and has not accepted: no sidecar');
    a.gate.resolve();
    assert.equal(await a.adapter.settled(), true);
    assert.equal(a.adapter.storeOwns(), 'hosted');
    const b = make();
    b.adapter.start();
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(b.adapter.storeOwns(), 'pending');
    b.gate.reject(new Error('refused'));
    assert.equal(await b.adapter.settled(), false);
    assert.equal(b.adapter.storeOwns(), false, 'refused: the sidecar is given back');
});
