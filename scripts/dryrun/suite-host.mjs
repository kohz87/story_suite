// The suite host the way the page has it: the testkit's host with Story Director and NPC State Delta, but NPC State Delta
// gets a runtime (chat key, loaded state, install, save), as the page's Delta has. The package's own
// suiteHost hands Delta an empty stub, so its timeline part sees "no open chat" and holds every Re-read and prompt back.
import { suiteAt } from './suite-at.mjs';

function deltaRuntime(chatKeyOf) {
  const live = { state: { npcs: [] } };
  return {
    isEnabled: () => true,
    getNpc: () => null,
    chatKey: () => chatKeyOf(),
    dossierRevision: () => `${chatKeyOf()}|1`,
    dossiersReady: () => true,
    getState: () => live.state,
    timelineStarted: () => true,
    timelineReady: () => true,
    stateReady: () => true,
    stateLoading: () => false,
    stateFailed: () => false,
    ensureFresh: () => Promise.resolve(),
    installState: async next => { live.state = structuredClone(next); },
    writeTimeline: async block => { live.state = { ...live.state, timeline: structuredClone(block) }; },
    scanActive: () => false,
    scanIdle: () => Promise.resolve(true),
  };
}

export async function pageSuiteHost(loaded, { seed = 1, settings = null, nsdNpcs = [] } = {}) {
  const restoreCrypto = (await suiteAt(loaded, 'tests/v2/qa/helpers/seeded.js')).seedCrypto(seed);
  let sdk = null;
  let host = null;
  const runtime = deltaRuntime(() => String(host?.ctx?.chatId ?? ''));
  const sd = loaded.SD.createModule({ host: { settings: id => sdk?.settings(id) ?? null, substitute: text => sdk?.substitute(text) } });
  const adapter = loaded.NSD.createStorySuiteV2Adapter({
    suiteApi: { npcs: () => nsdNpcs }, delta: () => runtime, host: () => globalThis.StoryBlock, doc: null, timers: {}, logger: { warn() {} },
  });
  const probe = await loaded.createHost({ settings: settings ?? {} });
  const done = await probe.packs.packs.install(loaded.packText, { origin: 'pack.json' });
  if (!done.ok) throw new Error('pack install failed: ' + JSON.stringify(done.errors));
  const storySuite = structuredClone(probe.ctx.extensionSettings.storySuite);
  probe.close();
  host = await loaded.createHost({ settings: storySuite, modules: [sd] });
  sdk = host.sdk;
  const standIn = sdk;
  const savedSB = globalThis.StoryBlock;
  globalThis.StoryBlock = { apiVersion: 2, ready: Promise.resolve(standIn), sdk: standIn };
  adapter.start();
  if (!(await adapter.settled())) throw new Error('NPC State Delta did not register with the host');
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
