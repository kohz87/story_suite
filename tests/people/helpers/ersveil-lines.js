// A host for the S2PA tests: Story Block's testkit with the real Story Director (its cast reads the installed packs) and NPC State's real adapter in
// lines mode, with the shipped format 4 Ersveil pair (examples/packs/ersveil + ersveil-game) installed before the chat starts. No dossier is seeded:
// the pack people get theirs only as the story meets them. say / swipe add a reply with change lines (and the story text, so a name is shown).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHost } from '../../../testkit/index.js';
import { createModule } from '../../../modules/director/module.js';
import { MODULE_ID, createStorySuiteV2Adapter } from '../../../modules/people/storysuite-v2.js';
import { DEFAULT_RELATIONSHIP_CAPS } from '../../../modules/people/core/core.js';

const PAIR = ['examples/packs/ersveil/pack.json', 'examples/packs/ersveil-game/pack.json'].map(rel => readFileSync(new URL(`../../../${rel}`, import.meta.url), 'utf8'));
const block = lines => (lines.length ? `\n\n<Changes>\n${lines.join('\n')}\n</Changes>` : '');

/** `features`: feature switches by id (world events: 'story-director.world-events'). → { host, adapter, say(story, lines), swipe(story, lines), people(), person(name), bonds() } */
export async function ersveilLines({ features = {}, settings = {} } = {}) {
    const probe = await createHost({ settings: {} });
    for (const text of PAIR) {
        const done = await probe.packs.packs.install(text, { origin: 'pack.json' });
        if (!done.ok) throw new Error(`pack install failed: ${JSON.stringify(done.errors)}`);
    }
    const storySuite = structuredClone(probe.ctx.extensionSettings.storySuite);
    probe.close();
    let sdk = null;
    const sd = createModule({ host: { settings: id => sdk?.settings(id) ?? null, substitute: text => sdk?.substitute(text) ?? text } });
    storySuite.modules = { ...(storySuite.modules ?? {}), [MODULE_ID]: { ...settings } };
    storySuite.features = { ...(storySuite.features ?? {}), ...features };
    const host = await createHost({ settings: storySuite, modules: [sd] });
    sdk = host.sdk;
    const box = { ready: Promise.resolve(host.sdk), sdk: host.sdk };
    // NPC State's runtime holds the same dossiers as the store (its people sync): here it reads them from the head.
    const stored = () => host.head()?.domains?.people?.npcs ?? {};
    const api = {
        isEnabled: () => true, getNpc: id => (stored()[id] ? structuredClone(stored()[id]) : null),
        relationshipBaseline: () => ({ trust: 0, affection: 0, desire: 0, tension: 0 }), relationshipCaps: () => ({ ...DEFAULT_RELATIONSHIP_CAPS }),
        presentCastHtml: () => '', castEmptyReason: () => ({ text: '' }), fillPresentCast: () => {}, playerNames: () => [],
    };
    const adapter = createStorySuiteV2Adapter({
        suiteApi: { npcs: () => Object.values(stored()).map(({ id, name, aliases, present }) => ({ id, name, aliases, present })) }, delta: () => api, version: 'test', host: () => box, headReply: () => host.store.headIndex(),
        linesMode: () => true, levelOn: () => true,
        doc: { documentElement: { dataset: {} }, getElementById: () => null, addEventListener() {}, dispatchEvent() { return true; } },
        timers: { setTimeout: () => 0, clearTimeout() {}, setInterval: () => ({ unref() {} }), clearInterval() {} },
        logger: { warn() {} }, loadEmptyCast: async () => null,
    });
    adapter.start();
    assert.equal(await adapter.settled(), true);
    const say = async (story, lines = []) => { await host.send('And then?', `${story}${block(lines)}`); await adapter.ticked(); return host.store.headIndex(); };
    const swipe = async (story, lines = []) => { await host.swipe(`${story}${block(lines)}`); await adapter.ticked(); };
    const people = () => host.head().domains.people;
    const person = name => Object.values(people()?.npcs ?? {}).find(npc => npc?.name === name);
    const bonds = () => people()?.bonds?.npcs ?? {};
    return { host, adapter, say, swipe, people, person, bonds, close: () => { adapter.stop?.(); host.close(); } };
}
