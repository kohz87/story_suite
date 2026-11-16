// J11-0 baseline benchmark (suite): pins today's tab-pane redraw and NSD renderCast counts per reply
// with real Story Block + Story Director + the real NPC State Delta adapter and the World tab open (flag off only).
// Two scenarios, each counted per path:
//   quiet: NPC State's runtime core is a stub and mood-pull is off. Its per-reply npc.tick is still sent, but it is refused ("Nothing to update."), so it commits nothing. 13 pane draws = 5 lines + 2 bench steps
//     + 3 Story Director commits (atlas.visit, chronicle.note, director.pulse) + 1 out-of-turn command + 1 turn + 1 head.
//   active: the reply also has a `~ npc` line and a story-clock move, so NSD's per-reply npc.tick is a real kept send after the turn
//     (18 pane draws = 16 commits + 1 turn + 1 head; the tick is 1 of the commits), and 3 `cast-rendered` page events are fired the way
//     the chat's inline cast render fires them (they add 1 renderCast: 19 in all).
// Left out (not drivable without product changes): NSD scan sends (the scan runs from SillyTavern's own message
// events in NSD's runtime core, which this stub replaces) and real inline chat renders. Step J11-5 adds the
// flag-on assertions that need them. The pane draws are counted by wrapping the pane's replaceChildren,
// which the tab host (host-ui/tab-host.js, found from the call stack) calls once per draw; the World tab is a screen the host renders, so it has no render of its own to wrap, and the screen's own replaceChildren calls are not draws.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');

const findDir = (env, suiteName, pkgName, rel) => [
    env,
    process.env.STORY_SUITE_ROOT && path.join(process.env.STORY_SUITE_ROOT, suiteName),
    path.join(repoRoot, 'packages', pkgName),
].filter(Boolean).find(dir => existsSync(path.join(dir, rel)));

const sbDir = findDir(process.env.SUITE_SB, 'Story_block', 'story-block', 'testkit/index.js');
const sdDir = findDir(process.env.SUITE_SD, 'Story_director', 'story-director', 'src/v2/module.js');
const nsdDir = findDir(
    process.env.SUITE_NSD ?? process.env.NPC_STATE_DELTA_PATH,
    'npc_state_delta',
    'npc-state-delta',
    'src/storysuite-v2.js',
);

const skip = (!sbDir || !sdDir || !nsdDir)
    ? 'Story Block, Story Director and NPC State Delta checkouts are required'
    : false;

const REPLY = [
    'Fenna steps into the tavern and checks her pack.',
    '',
    '<Changes>',
    '+ item Rope',
    '+ item Lantern | qty: 2',
    '+ coin 10',
    '+ item Torch',
    '+ item Key',
    '</Changes>',
].join('\n');

// Waits for `promise`, failing with a clear message instead of hanging when it never settles.
async function within(promise, ms, what) {
    let timer;
    const late = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${what} did not happen within ${ms} ms`)), ms); });
    try { return await Promise.race([promise, late]); } finally { clearTimeout(timer); }
}
const flush = () => new Promise(resolve => setImmediate(resolve));
const TIMEOUT = 30000;

async function runScenario(t, { active, flag = false }) {
    t.mock.method(console, 'warn', () => {});
    const at = (dir, rel) => import(pathToFileURL(path.join(dir, rel)).href);
    const [kit, { mountUi }, { setupDom }, SD, NSD] = await Promise.all([
        at(sbDir, 'testkit/index.js'),
        at(sbDir, 'ui/legacy/ui-host.js'),
        at(sbDir, 'tests/ui/view/mounts/helpers.js'),
        at(sdDir, 'src/v2/module.js'),
        at(nsdDir, 'src/storysuite-v2.js'),
    ]);

    const doc = setupDom();
    let resolveHead = null;
    const headSeen = new Promise(resolve => { resolveHead = resolve; });

    let sdk = null;
    const sd = SD.createModule({
        host: { settings: id => sdk?.settings(id) ?? null, substitute: text => sdk?.substitute(text) },
    });

    let renderCastCalls = 0;
    let counting = false;
    const nsdNpcs = [{ id: '1', name: 'Fenna', aliases: [], present: true }];
    const deltaApi = {
        isEnabled: () => true,
        getNpc: () => null,
        presentCastHtml: () => {
            if (counting) renderCastCalls += 1;
            return '<div class="npc-state-delta-present-cell" data-npc-id="1"><div class="npc-state-delta-present-card-text">Fenna</div></div>';
        },
        fillPresentCast() {},
        castEmptyReason: () => ({ text: 'No NPC is present.' }),
    };

    const adapter = NSD.createStorySuiteV2Adapter({
        suiteApi: { npcs: () => nsdNpcs },
        delta: () => deltaApi,
        host: () => globalThis.StoryBlock,
        doc,
        timers: {},
        logger: { warn() {} },
    });

    const host = await kit.createHost({
        settings: { modules: { 'story-block': { assistExtractor: true } }, ...(flag ? { flags: { 'suite.redrawScheduler': true } } : {}) },
        modules: [sd],
        callModel: async () => 'none',
    });
    sdk = host.sdk;
    const sent = [];
    let resolveTick = null;
    const tickSent = new Promise(resolve => { resolveTick = resolve; });
    // Story Block's sdk is frozen: the adapter gets a copy whose command() records what NSD sends.
    const spy = { ...sdk, command: async (type, ...rest) => { const out = await sdk.command(type, ...rest); if (counting) { sent.push([type, out?.ok, out?.code, out?.message]); if (type === 'npc.tick') { counts.tick += out?.ok ? 1 : 0; resolveTick(); } } return out; } };
    // The tick is sent in both scenarios (refused when quiet); mood and pull on is what makes it kept.
    host.features.set('npc-state-delta.mood-pull', active);

    const savedSB = globalThis.StoryBlock;
    globalThis.StoryBlock = { apiVersion: 2, ready: Promise.resolve(spy), sdk: spy };
    const ui = mountUi({ runtime: host, ctx: host.ctx, doc });

    const counts = { committed: 0, turn: 0, head: 0, tick: 0 };
    let paneDraws = 0;
    const offs = [
        host.events.on('committed', () => {
            if (!counting) return;
            counts.committed += 1;
        }),
        host.events.on('turn', () => { if (counting) counts.turn += 1; }),
        host.events.on('head', () => {
            if (!counting) return;
            counts.head += 1;
            resolveHead();
        }),
    ];

    try {
        await host.sdk.registerModule({
            id: 'qa-bench-step',
            name: 'Bench Step',
            version: '2.0.0-alpha.1',
            commands: {
                'qa-bench-step.step': () => ({ summary: 'step' }),
                'qa-bench-step.oob': () => ({ summary: 'oob' }),
            },
            hooks: {
                afterCapture: () => ({
                    commands: [
                        { type: 'qa-bench-step.step', payload: { step: 1 } },
                        { type: 'qa-bench-step.step', payload: { step: 2 } },
                    ],
                }),
            },
        });

        adapter.start();
        assert.equal(await within(adapter.settled(), TIMEOUT, 'NPC State Delta registering'), true, 'NPC State Delta registered with Story Block');

        // Put Fenna in the scene before measuring so World -> Here mounts story-director.people on every draw.
        await host.send('Setup.', 'Fenna is in the tavern.\n\n<Changes>\n+ place Tavern\n+ present Fenna\n' + (active ? '~ time June 4, 1200, 08:00 am\n' : '') + '</Changes>');
        await flush();

        ui.refresh();
        ui.openPanel();
        const worldBtn = doc.querySelectorAll('.story-suite-tab').find(node => node.getAttribute('data-tab-id') === 'story-director/world');
        assert.ok(worldBtn, 'World tab button exists');
        worldBtn.click();

        const pane = doc.querySelector('.story-suite-pane');
        assert.ok(pane, 'tab pane exists');
        // The tab host empties the pane exactly once per draw, then renders the World tab into it.
        const drawn = pane.replaceChildren.bind(pane);
        pane.replaceChildren = (...args) => { if (counting && args.length === 0 && /tab-host\.js/.test(new Error().stack)) paneDraws += 1; return drawn(...args); };

        renderCastCalls = 0;
        counting = true;

        await host.send('Fenna enters.', active ? REPLY.replace('</Changes>', '~ npc Fenna | trust: +1\n~ time June 5, 1200, 08:00 am\n</Changes>') : REPLY);
        await within(headSeen, TIMEOUT, 'the head event (Assist afterReply)');
        if (active) await within(tickSent, TIMEOUT, 'the npc.tick send');
        await flush();
        await host.sdk.command('qa-bench-step.oob', {});
        if (active) {
            // The chat's inline cast render fires this page event (NSD runtime-inline-cards-mount.js); the adapter listens on `doc`.
            for (let n = 0; n < 3; n += 1) {
                const event = { type: 'npc-state-delta:cast-rendered', detail: { streaming: false } };
                for (const entry of [...doc.listeners]) if (entry.type === event.type) entry.fn(event);
            }
        }
        await flush();
        if (flag) await new Promise(resolve => setTimeout(resolve, 60));   // (the last frame)

        counting = false;

        console.log(JSON.stringify({ bench: 'suite-redraw-count', scenario: active ? 'active' : 'quiet', flag, paneDraws, renderCastCalls, ...counts, sent }));
        return { paneDraws, renderCastCalls, counts };
    } finally {
        offs.forEach(off => off());
        adapter.stop?.();
        ui.destroy();
        host.close();
        if (savedSB === undefined) delete globalThis.StoryBlock; else globalThis.StoryBlock = savedSB;
    }
}

test('J11-0 suite baseline (quiet NSD): one scripted reply with the World tab open draws at today\'s counts', { skip, timeout: 60000 }, async t => {
    const { paneDraws, renderCastCalls, counts } = await runScenario(t, { active: false });
    assert.equal(counts.committed, 11, '5 lines + 2 bench steps + 3 Story Director commits (atlas.visit, chronicle.note, director.pulse) + 1 out-of-turn command');
    assert.equal(counts.turn, 1, '1 turn event');
    assert.equal(counts.head, 1, '1 head event from Assist afterReply');
    assert.equal(paneDraws, 13, '13 pane draws today (11 committed + 1 turn + 1 head)');
    assert.equal(renderCastCalls, 13, '13 renderCast calls today, one per pane draw');
});

test('J11-0 suite baseline (active NSD): the tick and cast-rendered events add to the counts', { skip, timeout: 60000 }, async t => {
    const { paneDraws, renderCastCalls, counts } = await runScenario(t, { active: true });
    assert.equal(counts.tick, 1, 'one npc.tick send that is kept');
    assert.equal(counts.committed, 16, '5 lines + 1 npc line + 1 time line + 2 bench steps + 3 Story Director commits + 2 clock commits (scene.weather, time.settle) + 1 out-of-turn command + 1 npc.tick');
    assert.equal(counts.turn, 1, '1 turn event');
    assert.equal(counts.head, 1, '1 head event from Assist afterReply');
    assert.equal(paneDraws, 18, '18 pane draws today (16 committed + 1 turn + 1 head)');
    assert.equal(renderCastCalls, 19, '19 renderCast calls today: one per pane draw + 1 from the 3 cast-rendered events');
});

test('J11-5 suite flag on (active NSD): the same events render the cast far less than today (19)', { skip, timeout: 60000 }, async t => {
    // A browser frame (~16 ms) spans a burst of events; the test page has no requestAnimationFrame, so it gets one.
    globalThis.requestAnimationFrame = fn => setTimeout(fn, 16);
    let result;
    try { result = await runScenario(t, { active: true, flag: true }); } finally { delete globalThis.requestAnimationFrame; }
    const { renderCastCalls, counts } = result;
    assert.deepEqual({ committed: counts.committed, turn: counts.turn, head: counts.head, tick: counts.tick }, { committed: 16, turn: 1, head: 1, tick: 1 }, 'the same events');
    // (the flag-on pane is drawn apart and swapped in, so the old pane's replaceChildren count above is not a draw count here: the cast renders are)
    assert.ok(renderCastCalls >= 1 && renderCastCalls <= 6, `${renderCastCalls} cast renders with the scheduler on (19 today)`);
});
