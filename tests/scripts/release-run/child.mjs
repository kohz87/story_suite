// Runs the suite smoke on one build of the three packages and prints the result as JSON (the release-run test
// starts it once on the source and once on the bundles, and compares). The same steps as the suite harness
// (packages/story-block/tests/v2/break/helpers/suite.js): Story Block's testkit host, Story Director registered
// as a module, NPC State Delta connected through its adapter, the Ersveil pack installed. The host is wired as
// testkit/host.js wires it (that file picks the store and the command bus by a computed path, which a bundle cannot
// follow, so the pieces come from the kit file the test writes: the same file runs on the source and, bundled, on the bundle).
// argv: <kit.js> <story director module.js> <npc state delta storysuite-v2.js> <pack.json> <seeded.js>
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const [kitFile, sdFile, nsdFile, packFile, seededFile] = process.argv.slice(2);
const at = file => import(pathToFileURL(file).href);
const [kit, SD, NSD, seeded] = await Promise.all([at(kitFile), at(sdFile), at(nsdFile), at(seededFile)]);
const packText = fs.readFileSync(packFile, 'utf8');
const restoreCrypto = seeded.seedCrypto(1);
const result = { errors: [] };
const note = (name, fn) => Promise.resolve().then(fn).then(value => { result[name] = value; }, error => { result.errors.push(`${name}: ${error?.message ?? error}`); });
const quiet = { warn() {} };

let sdk = null;
const sd = SD.createModule({ host: { settings: id => sdk?.settings(id) ?? null, substitute: text => sdk?.substitute(text) } });
const adapter = NSD.createStorySuiteV2Adapter({ suiteApi: { npcs: () => [] }, delta: () => ({ isEnabled: () => true, getNpc: () => null }), host: () => globalThis.StoryBlock, doc: null, timers: {}, logger: quiet });
async function createHost({ settings = {}, modules = [], lazyRpg = false } = {}) {
  kit.setRpgLib(lazyRpg ? null : kit.leanRpg);
  const st = kit.createFakeContext({ extensionSettings: { storySuite: structuredClone(settings) } });
  const runtime = kit.createRuntime({ ctx: st.ctx, core: true, modules, createStore: kit.createStore, createCommandBus: kit.createCommandBus, callModel: null, timelineFaults: null, rpgLoad: undefined, onBlocked: null, notify: () => {} });
  runtime.turn.install({ globalName: null });
  st.interceptor = runtime.turn.interceptor;
  await runtime.turn.onChatChanged();
  runtime.markReady();
  return { st, ctx: st.ctx, sdk: runtime.sdk, packs: runtime.packs, features: runtime.features, rpgLoader: runtime.rpgLoader, send: (text, reply) => st.send(text, { reply, stopped: false }), close: () => runtime.turn.uninstall({ globalName: null }) };
}
const probe = await createHost();
const installed = await probe.packs.packs.install(packText, { origin: 'pack.json' });
result.packInstalled = installed.ok;
const storySuite = structuredClone(probe.ctx.extensionSettings.storySuite);
probe.close();
const host = await createHost({ settings: storySuite, modules: [sd] });
sdk = host.sdk;
globalThis.StoryBlock = { apiVersion: 2, ready: Promise.resolve(sdk), sdk };
adapter.start();
result.nsdRegistered = Boolean(await adapter.settled());

await note('modules', () => sdk.modules().map(entry => entry.id).sort());
const reply = (text, lines) => `${text}\n\n<Changes>\n${lines.join('\n')}\n</Changes>`;
await note('reply1', async () => (await host.send('We look around the guild office.', reply('Dust hangs in the lamplight.', ['~ you rank: unregistered | wearing: oilskin coat, boots | condition: rested', '+ item Bedroll | qty: 1', '+ present Sister Temiwa']))).error ?? 'ok');
await note('reply2', async () => (await host.send('I buy bread.', reply('Bread, hot and heavy.', ['+ coin 3 silver | from: Rika', '+ item Bread | qty: 2']))).error ?? 'ok');
await note('sbQueries', () => ({ wallet: sdk.query('inventory.wallet', { owner: 'party' }), items: sdk.query('inventory.items').map(item => `${item.name} x${item.qty}`).sort(), present: sdk.query('scene.present').map(entry => entry.name ?? entry) }));
await note('sdQueries', () => ({ time: sdk.query('director.time'), threads: sdk.query('director.threads') }));
await note('nsdQueries', () => ({ catchUp: sdk.query('npc.catchUp') }));
await note('prompt', () => JSON.stringify(host.st.lastPrompt ?? null).length > 2);
adapter.stop?.();
host.close();

// The RPG's library is fetched only when the feature is on (a real import() of a lazy module).
const lazy = await createHost({ settings: storySuite, lazyRpg: true });
await note('rpgBefore', () => lazy.rpgLoader.loaded());
await note('rpgLoad', async () => {
  lazy.features.set('story-block.rpg', true);
  await lazy.rpgLoader.ensure({ scan: false });
  return lazy.rpgLoader.loaded();
});
lazy.close();
restoreCrypto();
console.log(JSON.stringify(result));
