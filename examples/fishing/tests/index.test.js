import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createFakeSdk } from './helpers/fake-sdk.js';

test('the extension registers through StoryBlock.ready and nothing else', async () => {
    const fake = createFakeSdk();
    let resolve;
    globalThis.StoryBlock = { ready: new Promise(r => (resolve = r)) };
    const mod = await import('../index.js');
    assert.equal(typeof mod.renderFishing, 'function');
    assert.equal(fake.sdk.modules().some(m => m.id === 'fishing-activity'), false);
    resolve(fake.sdk);
    await new Promise(r => setTimeout(r, 0));
    assert.equal(fake.sdk.modules().some(m => m.id === 'fishing-activity'), true);
    delete globalThis.StoryBlock;
});

test('the manifest depends on Story Block and the code imports nothing outside the folder', () => {
    const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
    assert.deepEqual(manifest.dependencies, ['third-party/Story_block']);
    assert.equal(manifest.js, 'index.js');
    const parts = ['module-parts', 'rules-parts'].flatMap(dir => readdirSync(new URL(`../src/${dir}/`, import.meta.url)).map(name => `../src/${dir}/${name}`));
    for (const file of ['../index.js', '../src/module.js', '../src/widget.js', '../src/rules.js', ...parts]) {
        const source = readFileSync(new URL(file, import.meta.url), 'utf8');
        for (const [, from] of source.matchAll(/\bfrom\s+'([^']+)'/g)) {
            assert.match(from, /^\.{1,2}\/(?:[\w-]+\/)*[\w-]+\.js$/, `${file} imports ${from}`);
            assert.ok(new URL(from, new URL(file, import.meta.url)).href.startsWith(new URL('../', import.meta.url).href), `${file} imports ${from} from outside the folder`);
        }
        assert.doesNotMatch(source, /Math\.random|generateRaw|generateQuiet/, `${file} uses no Math.random and no model calls`);
    }
});
