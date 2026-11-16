// J10-5 (suite): with suite.isolatedApply on, a throw injected into one of Story Block (a core hook), Story Director (its afterCapture) or NPC State
// (its tick after the turn) leaves the other two applying, and the reply's list of failed modules (what the card's "could not finish" row and the
// Inspector read) names only the failing one. (The flag gates what the card and the Inspector show; the SB host test covers the flag-off card.) Real Story Block + Story Director + the NPC State adapter.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const findDir = (env, suiteName, pkgName, rel) => [env, process.env.STORY_SUITE_ROOT && path.join(process.env.STORY_SUITE_ROOT, suiteName), path.join(repoRoot, 'packages', pkgName)]
    .filter(Boolean).find(dir => existsSync(path.join(dir, rel)));
const sbDir = findDir(process.env.SUITE_SB, 'Story_block', 'story-block', 'testkit/index.js');
const sdDir = findDir(process.env.SUITE_SD, 'Story_director', 'story-director', 'src/v2/module.js');
const nsdDir = findDir(process.env.SUITE_NSD ?? process.env.NPC_STATE_DELTA_PATH, 'npc_state_delta', 'npc-state-delta', 'src/storysuite-v2.js');
const skip = (!sbDir || !sdDir || !nsdDir) ? 'Story Block, Story Director and NPC State Delta checkouts are required' : false;

const flush = () => new Promise(resolve => setImmediate(resolve));
const REPLY = 'Fenna enters the tavern.\n\n<Changes>\n+ place Tavern\n+ present Fenna\n~ npc Fenna | trust: +1\n~ time June 5, 1200, 08:00 am\n</Changes>';
const SETUP = 'Fenna is here.\n\n<Changes>\n+ place Cellar\n+ present Fenna\n~ time June 4, 1200, 08:00 am\n</Changes>';

async function run(t, { flag, fail }) {
    t.mock.method(console, 'warn', () => {});
    const at = (dir, rel) => import(pathToFileURL(path.join(dir, rel)).href);
    const [kit, { setupDom }, SD, NSD, { moduleFailures }, { readRecord }] = await Promise.all([
        at(sbDir, 'testkit/index.js'), at(sbDir, 'tests/v2/view/mounts/helpers.js'), at(sdDir, 'src/v2/module.js'), at(nsdDir, 'src/storysuite-v2.js'),
        at(sbDir, 'src/v2/turn/apply-report.js'), at(sbDir, 'src/v2/persist.js'),
    ]);
    const doc = setupDom();
    let sdk = null;
    const sd = SD.createModule({ host: { settings: id => sdk?.settings(id) ?? null, substitute: text => sdk?.substitute(text) } });
    if (fail === 'story-director') {
        const real = sd.hooks.afterCapture;
        sd.hooks.afterCapture = (...args) => { if (injecting) throw new Error('director part torn'); return real(...args); };
    }
    let injecting = false;
    const deltaApi = { isEnabled: () => true, getNpc: () => null, presentCastHtml: () => '<div></div>', fillPresentCast() {}, castEmptyReason: () => ({ text: 'No NPC is present.' }) };
    const adapter = NSD.createStorySuiteV2Adapter({
        suiteApi: { npcs: () => [{ id: '1', name: 'Fenna', aliases: [], present: true }] }, delta: () => deltaApi, host: () => globalThis.StoryBlock, doc, timers: {}, logger: { warn() {} },
    });
    const host = await kit.createHost({ settings: flag ? { flags: { 'suite.isolatedApply': true } } : {}, modules: [sd], callModel: async () => 'none' });
    sdk = host.sdk;
    const ticks = { kept: 0 };
    const spy = { ...sdk, command: async (type, ...rest) => {
        if (type === 'npc.tick' && injecting && fail === 'npc-state-delta') return { ok: false, code: 'FAILED', message: 'tick torn' };
        const out = await sdk.command(type, ...rest);
        if (type === 'npc.tick' && out?.ok) ticks.kept += 1;
        return out;
    } };
    host.features.set('npc-state-delta.mood-pull', true);
    const saved = globalThis.StoryBlock;
    globalThis.StoryBlock = { apiVersion: 2, ready: Promise.resolve(spy), sdk: spy };
    if (fail === 'story-block') {
        const real = host.registry.hookEntries.bind(host.registry);
        host.registry.hookEntries = name => real(name).map(entry => (entry.moduleId === 'story-block' && name === 'afterCapture' && injecting ? { ...entry, fn: () => { throw new Error('core part torn'); } } : entry));
    }
    try {
        adapter.start();
        await adapter.settled();
        await host.send('Setup.', SETUP);
        await flush();
        ticks.kept = 0;
        injecting = true;
        await host.send('Fenna enters.', REPLY);
        for (let n = 0; n < 20; n += 1) await flush();
        const index = host.store.headIndex();
        const receipts = readRecord(host.ctx.chat[index])?.receipts ?? [];
        const failed = moduleFailures(host.turn.problems(), index).map(item => item.module);
        return { place: host.api.get('scene.place'), failed, ticks: ticks.kept, directorReceipts: receipts.filter(item => item.module === 'story-director').length, coreReceipts: receipts.filter(item => item.module === 'story-block').length };
    } finally {
        adapter.stop?.();
        host.close();
        if (saved === undefined) delete globalThis.StoryBlock; else globalThis.StoryBlock = saved;
    }
}

for (const fail of ['story-block', 'story-director', 'npc-state-delta']) {
    test(`isolation each module: a throw in ${fail} is named; the other two still apply`, { skip, timeout: 60000 }, async t => {
        const base = await run(t, { flag: true, fail: null });
        assert.deepEqual(base.failed, [], 'no injection: nobody failed');
        assert.equal(base.place, 'Tavern');
        const out = await run(t, { flag: true, fail });
        assert.deepEqual(out.failed, [fail], 'only the failing module is named');
        assert.equal(out.place, 'Tavern', 'the reply\'s lines still apply');
        if (fail !== 'story-director') assert.ok(out.directorReceipts > 0, 'Story Director still applied its steps');
        if (fail !== 'story-block') assert.ok(out.coreReceipts > 0, 'Story Block still applied');
        if (fail !== 'npc-state-delta') assert.equal(out.ticks, base.ticks, 'NPC State\'s tick was still kept');
    });
}
