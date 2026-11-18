import test from 'node:test';
import assert from 'node:assert/strict';
import { portraitAsFile } from '../../modules/people/runtime/portrait-as-file.js';
import { isPortraitFileRecord } from '../../modules/people/portrait/portrait-file.js';
import { peopleView, peopleState } from '../../modules/people/view.js';

// A one-pixel PNG.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const upload = () => ({ dataUrl: PNG, mime: 'image/png', sourceName: 'm.png', width: 1, height: 1, updatedAt: 5 });

function withFetch(handler, run) {
    const real = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url, init) => { calls.push(url); return handler(url, init); };
    return run(calls).finally(() => { globalThis.fetch = real; });
}

test('a device upload is filed once and the record keeps only the file reference', () => withFetch(
    async url => (url === '/api/files/verify' ? { ok: true, json: async () => ({}) } : { ok: true }),
    async calls => {
        const record = await portraitAsFile(upload(), { 'Content-Type': 'application/json' });
        assert.equal(isPortraitFileRecord(record), true);
        assert.equal(record.dataUrl, undefined);
        assert.equal(record.mime, undefined);
        assert.deepEqual([record.sourceName, record.width, record.height, record.updatedAt], ['m.png', 1, 1, 5]);
        assert.ok(calls.includes('/api/files/upload'));
        // The store takes it and a reload brings it back.
        const view = peopleView({ npcs: [{ id: 'npc_marrit', name: 'Marrit', portrait: record }], portraitAssets: {} });
        assert.equal(view.npcs.npc_marrit.portrait.path, record.path);
        assert.equal(peopleState(view).npcs[0].portrait.path, record.path);
    },
));

test('a file that cannot be written leaves the picture in the record as before', () => withFetch(
    async url => (url === '/api/files/verify' ? { ok: true, json: async () => ({}) } : { ok: false }),
    async () => {
        const record = await portraitAsFile(upload(), { 'Content-Type': 'application/json' });
        assert.equal(record.dataUrl, PNG);
    },
));

test('the setPortrait path files the picture and drops a stale byte copy', async () => {
    const { readFile } = await import('node:fs/promises');
    const source = await readFile(new URL('../../modules/people/runtime/runtime-mutations.js', import.meta.url), 'utf8');
    assert.match(source, /form \? picked : portraitAsFile\(picked, requestHeaders\(\)\)/);
    assert.match(source, /if \(portrait\.dataUrl\) getChatState\(chatKey\)\.portraitAssets\[live\.id\] = structuredClone\(portrait\); else delete/);
});
