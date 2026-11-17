// Suite harness: Story Block's real testkit host with Story Director and NPC State Delta registered beside it and the
// Ersveil example pack installed (Lean RPG is Story Block's own part now, so the suite is three repos).
// Where the checkouts come from: SUITE_SB / SUITE_SD / SUITE_NSD (a folder each) win; else STORY_SUITE_ROOT
// (<root>/Story_director, <root>/npc_state_delta); else the tool folders of this repo. Story Block is this repo.
// No folder found: loadSuite() answers { skip } and the test skips.
import { existsSync, readFileSync } from 'node:fs';
import { makeFarm } from '../../../../scripts/ci/farm.mjs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { tempDir } from '../../../../scripts/temp-dir.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, '../../../..');
const SB = process.env.SUITE_SB ?? REPO;
const ROOTS = [process.env.STORY_SUITE_ROOT].filter(Boolean);
// Story Director's module: in a folder shaped like the old package (src/v2/module.js: the farm's Story_director), else at ui/legacy/director/ of the repo.
const SD_MODULE = 'src/v2/module.js';
const SD_MOVED = 'ui/legacy/director/module.js';
export const sdModuleAt = dir => (existsSync(path.join(dir, SD_MODULE)) ? path.join(dir, SD_MODULE) : path.join(dir, SD_MOVED));
const find = (env, name, rel, own) => [env, ...ROOTS.map(root => path.join(root, name)), own].filter(Boolean).find(dir => existsSync(path.join(dir, rel)) || (rel === SD_MODULE && existsSync(sdModuleAt(dir))));

// No farm given: the repo's own folders in the old shape, built once in a temporary folder.
let farm = null;
const fallbackFarm = name => path.join(farm ??= makeFarm(REPO, tempDir('suite-farm-')), name);

export const roots = () => ({
    sb: SB,
    sd: find(process.env.SUITE_SD, 'Story_director', 'src/v2/module.js', REPO),
    nsd: find(process.env.SUITE_NSD, 'npc_state_delta', 'src/storysuite-v2.js', fallbackFarm('npc_state_delta')),
});

export async function loadSuite() {
    const r = roots();
    if (!r.sd || !r.nsd) return { skip: 'no Story_director / npc_state_delta checkout beside this one (STORY_SUITE_ROOT, SUITE_SD, SUITE_NSD)', roots: r };
    // The playthrough needs NPC State Delta's notes kinds (taste / know / lie, the via discount): a checkout from before the NSD batch
    // lacks them, and the test would fail on that instead of on Story Block. Skip, and say what to update.
    if (!existsSync(path.join(r.nsd, 'src/npc-notes-kinds.js'))) return { skip: `the npc_state_delta checkout at ${r.nsd} is older than its notes batch (no src/npc-notes-kinds.js): update it, or point SUITE_NSD at a current one`, roots: r };
    const at = (dir, rel) => import(pathToFileURL(path.join(dir, rel)).href);
    const [kit, SD, NSD] = await Promise.all([at(r.sb, 'testkit/index.js'), import(pathToFileURL(sdModuleAt(r.sd)).href), at(r.nsd, 'src/storysuite-v2.js')]);
    return { roots: r, createHost: kit.createHost, SD, NSD, at: rel => at(r.sb, rel), packText: readFileSync(path.join(r.sb, 'examples/packs/ersveil/pack.json'), 'utf8') };
}

/** A host with the two modules and the Ersveil pack installed before the chat starts. crypto is seeded while it lives. */
export async function suiteHost(loaded, { seed = 1, settings = null, nsdNpcs = [] } = {}) {
    // Receipt ids, seeds and reply ids follow the seed (the QA helper; its ids differ from the first character, unlike a counter's).
    const restoreCrypto = (await loaded.at('tests/suite/qa/helpers/seeded.js')).seedCrypto(seed);
    let sdk = null;
    const sd = loaded.SD.createModule({ host: { settings: id => sdk?.settings(id) ?? null, substitute: text => sdk?.substitute(text) } });
    // NPC State Delta connects the way the page does (adapter.start(): it registers itself with the host and learns the sdk it
    // reads Story Director's clock through); handing its bare definition to the host would leave its story day unknown.
    const adapter = loaded.NSD.createStorySuiteV2Adapter({ suiteApi: { npcs: () => nsdNpcs }, delta: () => ({ isEnabled: () => true, getNpc: () => null }), host: () => globalThis.StoryBlock, doc: null, timers: {}, logger: { warn() {} } });
    const probe = await loaded.createHost({ settings: settings ?? {} });
    const done = await probe.packs.packs.install(loaded.packText, { origin: 'pack.json' });
    if (!done.ok) throw new Error('pack install failed: ' + JSON.stringify(done.errors));
    const storySuite = structuredClone(probe.ctx.extensionSettings.storySuite);
    probe.close();
    const host = await loaded.createHost({ settings: storySuite, modules: [sd] });
    sdk = host.sdk;
    const savedSB = globalThis.StoryBlock;
    globalThis.StoryBlock = { apiVersion: 2, ready: Promise.resolve(sdk), sdk };
    adapter.start();
    const hosted = await adapter.settled();
    if (!hosted) throw new Error('NPC State Delta did not register with the host');
    const close = host.close;
    host.close = () => {
        adapter.stop?.();
        close();
        if (savedSB === undefined) delete globalThis.StoryBlock; else globalThis.StoryBlock = savedSB;
        restoreCrypto();
    };
    host.q = (name, args) => sdk.query(name, args);
    host.cmd = (type, payload = {}, opts) => sdk.command(type, payload, opts);
    host.reply = (text, lines = []) => (lines.length ? `${text}\n\n<Changes>\n${lines.join('\n')}\n</Changes>` : text);
    return host;
}
