import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCheckpoint, checkpointProblem, memoryVault } from '../../modules/people/legacy/storysuite-participant/index.js';
import { hashJson } from '../../modules/people/legacy/storysuite-participant/hash.js';
import { fileVault } from '../../modules/people/legacy/storysuite-participant/vault.js';
import { bytesOf, fileOf, filesServer, freshState, lined, saveRun, setup, stateAt } from './storysuite-participant.helpers.js';

test('the file vault writes SillyTavern\'s user files and reads them back; a checkpoint is written once', async () => {
    const files = new Map();
    const calls = [];
    const fetchFn = async (url, options = {}) => {
        calls.push(url);
        if (url === '/api/files/upload') {
            const { name, data } = JSON.parse(options.body);
            files.set(name, Buffer.from(data, 'base64').toString('utf8'));
            return { ok: true, status: 200, json: async () => ({ path: `/user/files/${name}` }) };
        }
        const name = url.split('/').pop();
        return files.has(name) ? { ok: true, status: 200, text: async () => files.get(name) } : { ok: false, status: 404 };
    };
    const vault = fileVault({ fetchFn, headers: { 'X-Test': '1' } });
    assert.equal(await vault.get('nk_00000001'), null);
    await vault.put('nk_00000001', { a: 1, é: '☃' });
    assert.deepEqual(await vault.get('nk_00000001'), { a: 1, é: '☃' });
    const uploads = calls.filter(url => url === '/api/files/upload').length;
    await vault.put('nk_00000001', { a: 1, é: '☃' });
    assert.equal(calls.filter(url => url === '/api/files/upload').length, uploads, 'not written twice');
    assert.equal(await vault.getIndex('chat:x'), null);
    await vault.putIndex('chat:x', { v: 1, n: 2 });
    assert.deepEqual(await vault.getIndex('chat:x'), { v: 1, n: 2 });
    assert.deepEqual([...files.keys()].filter(name => name.startsWith('npc-state-delta-')).length, 2);
    const refusing = fileVault({ fetchFn: async () => ({ ok: false, status: 500 }) });
    await assert.rejects(() => refusing.putIndex('chat:x', {}));
});

test('the file vault asks whether a file exists before a first write reads it: a new checkpoint or index makes no 404 request, what is stored is unchanged', async () => {
    const files = new Map();
    const calls = [];
    let verify = 'ok';
    const fetchFn = async (url, options = {}) => {
        calls.push({ url, method: options.method ?? 'GET', name: url === '/api/files/upload' ? JSON.parse(options.body).name : '' });
        if (url === '/api/files/verify') {
            if (verify === 'throw') throw new Error('offline');
            if (verify === 'missing') return { ok: false, status: 404, json: async () => ({}) };
            const { urls } = JSON.parse(options.body);
            return { ok: true, status: 200, json: async () => Object.fromEntries(urls.map(path => [path, files.has(path.split('/').pop())])) };
        }
        if (url === '/api/files/upload') {
            const { name, data } = JSON.parse(options.body);
            files.set(name, Buffer.from(data, 'base64').toString('utf8'));
            return { ok: true, status: 200, json: async () => ({ path: `/user/files/${name}` }) };
        }
        const name = url.split('/').pop();
        return files.has(name) ? { ok: true, status: 200, text: async () => files.get(name) } : { ok: false, status: 404 };
    };
    // The clean-up's registry file (vault.js) is a separate, unawaited write; the checks below are about the checkpoint and index files.
    const own = list => list.filter(call => !String(call.name || call.url).includes('registry'));
    const gets = () => own(calls.filter(call => call.method === 'GET')).map(call => call.url);
    const vault = fileVault({ fetchFn, headers: { 'X-Test': '1' } });
    const doc = { a: 1, é: '☃' };
    // A fresh chat's first writes: the index of a new lineage and its first checkpoint.
    assert.equal(await vault.getIndex('lg_aaaaaaaa'), null);
    await vault.put('nk_00000001', doc);
    await vault.putIndex('lg_aaaaaaaa', { v: 1 });
    assert.deepEqual(gets(), [], 'nothing was fetched that is not there: no 404');
    assert.deepEqual(JSON.parse(files.get('npc-state-delta-checkpoint-nk_00000001.json')), doc, 'stored as before');
    assert.deepEqual(own(calls.filter(call => call.url === '/api/files/upload')).length, 2);
    // What is there is read, and a checkpoint already kept is not written again.
    assert.deepEqual(await vault.getIndex('lg_aaaaaaaa'), { v: 1 });
    await vault.put('nk_00000001', doc);
    assert.equal(own(calls.filter(call => call.url === '/api/files/upload')).length, 2, 'not written twice');
    assert.equal(gets().length, 2, 'the existing index and checkpoint were read');
    // A save point is read straight (no verify): a checkpoint that is gone is still told by its 404.
    const before = calls.length;
    assert.equal(await vault.get('nk_0000ffff'), null);
    assert.deepEqual(calls.slice(before).map(call => call.url), ['/user/files/npc-state-delta-checkpoint-nk_0000ffff.json']);
    // A server that cannot say (no such route, an error): read as before, the write still happens.
    for (const mode of ['missing', 'throw']) {
        verify = mode;
        const id = `nk_${mode}`;
        const mark = calls.length;
        await vault.put(id, { mode });
        assert.deepEqual(gets().slice(-1), [`/user/files/npc-state-delta-checkpoint-${id}.json`], `${mode}: read first, as before`);
        assert.deepEqual(JSON.parse(files.get(`npc-state-delta-checkpoint-${id}.json`)), { mode }, `${mode}: written`);
        assert.ok(calls.length > mark);
    }
});

test('the file vault gives up on a request that gets no answer', async () => {
    const vault = fileVault({ fetchFn: (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')))), timeoutMs: 20 });
    await assert.rejects(() => vault.get('nk_00000001'), /did not answer in 20 ms/);
    await assert.rejects(() => vault.putIndex('lg_aaaaaaaa', {}), /did not answer/);
});

test('a checkpoint file is written packed and read back as the very document that was hashed; old plain files and unusable checkpoint lists stay as they are', async () => {
    const server = filesServer();
    const vault = fileVault({ fetchFn: server.fetchFn });
    const built = buildCheckpoint({ lineage: 'lg_aaaaaaaa', state: { ...stateAt(40), timeline: { v: 1, lineage: 'lg_aaaaaaaa' } }, cursor: { sid: 'sr_1' }, headHash: 'a'.repeat(64) });
    await vault.put(built.id, built.doc);
    await vault.put(built.id, built.doc);
    const stored = JSON.parse(server.files.get(`npc-state-delta-checkpoint-${built.id}.json`));
    assert.equal(stored.kind, 'npc-state-delta-native-packed');
    assert.equal(stored.packing.scheme, 'chain-rfc6902');
    assert.ok(server.files.get(`npc-state-delta-checkpoint-${built.id}.json`).length * 1.5 < JSON.stringify(built.doc).length, 'much less than the plain bytes');
    const back = await vault.get(built.id);
    assert.deepEqual(back, built.doc);
    assert.equal(hashJson(back), built.hash, 'the hash (and so the id) is the plain document\'s');
    assert.equal(checkpointProblem(back, built.hash), '');
    // An old build's plain file is read as it is, and so is a plain write (no checkpoint list, or an empty one).
    const old = buildCheckpoint({ lineage: 'lg_aaaaaaaa', state: freshState() });
    server.files.set(`npc-state-delta-checkpoint-${old.id}.json`, JSON.stringify(old.doc));
    assert.deepEqual(await vault.get(old.id), old.doc);
    for (const [lineage, state] of [['lg_bbbbbbbb', { npcs: [], timeline: {} }], ['lg_cccccccc', { npcs: [], checkpoints: [], timeline: {} }]]) {
        const plainOne = buildCheckpoint({ lineage, state, headHash: 'c'.repeat(64) });
        await vault.put(plainOne.id, plainOne.doc);
        assert.equal(JSON.parse(server.files.get(`npc-state-delta-checkpoint-${plainOne.id}.json`)).kind, plainOne.doc.kind);
        assert.deepEqual(await vault.get(plainOne.id), plainOne.doc);
    }
    // A packed file that cannot be rebuilt is a file that is not there (never a partial state).
    const broken = JSON.parse(server.files.get(`npc-state-delta-checkpoint-${built.id}.json`));
    broken.doc.state.checkpoints.find(entry => entry.packed).packed.base = 999;
    server.files.set(`npc-state-delta-checkpoint-${built.id}.json`, JSON.stringify(broken));
    assert.equal(await vault.get(built.id), null);
});

test('60 replies on the file vault: the same restores as the plain memory vault, one file per save and a fraction of the bytes ', async () => {
    const server = filesServer();
    const plainVault = memoryVault();
    const runs = [];
    for (const vault of [fileVault({ fetchFn: server.fetchFn }), plainVault]) {
        const run = setup({ state: stateAt(1), vault });
        await run.hydrate();
        const saves = [];
        for (let turn = 1; turn <= 60; turn += 1) {
            run.live.state = { ...stateAt(turn), timeline: run.live.state.timeline };
            saves.push(await run.participant.checkpoint({ cursor: { sid: `sr_${turn}` }, headHash: hashJson({ turn }) }));
        }
        assert.ok(saves.every(save => save.ok), 'every save succeeds');
        // Rollback / swipe / delete / re-read / reload all come down to prepare + activate of an earlier reply's checkpoint: the installed state.
        const installed = [];
        for (const turn of [59, 41, 30, 3, 60, 1]) {
            const save = saves[turn - 1];
            const prepared = await run.participant.prepare({ return: `rt_${turn}x${installed.length}`, checkpoint: save.checkpoint, hash: save.hash });
            assert.equal(prepared.ok, true, prepared.message);
            const activated = await run.participant.activate({ return: `rt_${turn}x${installed.length}`, prepared: prepared.prepared });
            assert.equal(activated.ok, true, activated.message);
            installed.push(structuredClone(run.live.state));
        }
        runs.push({ saves, installed });
    }
    // Each run mints its own story line (its ids and the np_ map seeded by it), so those differ; what a restore installs must not.
    const unlined = states => states.map(({ timeline, ...state }) => state);
    assert.deepEqual(unlined(runs[0].installed), unlined(runs[1].installed), 'the same state after each restore');
    const names = server.checkpointNames();
    assert.equal(names.length, 61, 'one file per save (and the baseline), none lost, none extra');
    const plainBytes = [...plainVault.docs.values()].reduce((sum, text) => sum + text.length, 0);
    const packedBytes = bytesOf(server, names);
    assert.ok(packedBytes * 2.5 < plainBytes, `packed ${packedBytes} bytes against ${plainBytes} plain`);
});

test('every checkpoint file is read on its own: a fresh vault with only that one file reads it whole, in any order', async () => {
    const server = filesServer();
    const built = await saveRun(fileVault({ fetchFn: server.fetchFn }), 1, 30);
    for (const item of built) assert.equal(fileOf(server, item.id).kind, 'npc-state-delta-native-packed', 'every file is a full packed file, never a patch');
    for (const item of [...built].reverse()) {
        const alone = filesServer();
        alone.files.set(`npc-state-delta-checkpoint-${item.id}.json`, server.files.get(`npc-state-delta-checkpoint-${item.id}.json`));
        assert.deepEqual(await fileVault({ fetchFn: alone.fetchFn }).get(item.id), item.doc, `${item.id} reads with no other file there`);
    }
});

test('the Storage clean-up never makes a remaining file unreadable: any subset of files may go and every file left reads whole', async () => {
    const server = filesServer();
    const vault = fileVault({ fetchFn: server.fetchFn });
    const built = await saveRun(vault, 1, 24);
    // Remove every third, then the oldest ten, through the vault's own remove (what the clean-up calls).
    const gone = new Set(built.filter((_, i) => i % 3 === 0 || i < 10).map(item => item.id));
    for (const id of gone) assert.equal(await vault.remove(id, { referenced: [] }), true);
    const sweeper = fileVault({ fetchFn: server.fetchFn });
    for (const item of built) {
        if (gone.has(item.id)) assert.equal(await sweeper.get(item.id), null);
        else assert.deepEqual(await sweeper.get(item.id), item.doc, `${item.id} still reads whole`);
    }
    assert.equal(server.checkpointNames().length, built.length - gone.size);
});

test('an old chat with many plain (v1, unpacked) files: they stay readable and untouched next to the packed ones', async () => {
    const server = filesServer();
    const olds = Array.from({ length: 40 }, (_, i) => buildCheckpoint({ lineage: 'lg_aaaaaaaa', state: lined(i + 1), cursor: { sid: `sr_${i + 1}` }, headHash: hashJson({ turn: i + 1 }) }));
    for (const item of olds) server.files.set(`npc-state-delta-checkpoint-${item.id}.json`, JSON.stringify(item.doc));
    const before = new Map(server.files);
    const vault = fileVault({ fetchFn: server.fetchFn });
    for (const item of olds) assert.deepEqual(await vault.get(item.id), item.doc);
    const [fresh] = await saveRun(vault, 41, 41);
    assert.equal(fileOf(server, fresh.id).kind, 'npc-state-delta-native-packed');
    for (const [name, text] of before) assert.equal(server.files.get(name), text, 'an old file is not rewritten');
    assert.deepEqual(await vault.get(fresh.id), fresh.doc);
});

test('this change never deletes a checkpoint file: a long run, a thrown-away save and a reload send no delete and leave every file', async () => {
    const server = filesServer();
    const sent = [];
    const spy = async (url, options = {}) => { if (/delete/.test(url)) sent.push(url); return server.fetchFn(url, options); };
    const vault = fileVault({ fetchFn: spy });
    const built = await saveRun(vault, 1, 40);
    const run = setup({ vault });
    await run.hydrate();
    let once = true;
    run.port.busy = () => { const now = once; once = false; return now; };
    run.live.state.npcs[0].trust = 6;
    assert.equal((await run.participant.checkpoint({ cursor: { sid: 'sr_1' }, headHash: 'a'.repeat(64) })).ok, true);
    assert.deepEqual(sent, [], 'no delete request');
    assert.ok(server.checkpointNames().length >= 41, 'every file written is still there, the thrown-away one included');
    for (const item of built) assert.deepEqual(await vault.get(item.id), item.doc);
});
