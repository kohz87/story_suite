// J11-0 baseline benchmark: pins today's tab-pane redraw count per reply (flag off only).
// Scripted reply: 5 change lines, 2 afterCapture steps, Assist afterReply, 1 out-of-turn command.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost, hostAvailable } from '../../../testkit/index.js';
import { mountUi } from '../../../src/v2/ui-host.js';
import { setupDom } from '../view/mounts/helpers.js';

// Waits for `promise`, failing with a clear message instead of hanging when it never settles.
async function within(promise, ms, what) {
    let timer;
    const late = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${what} did not happen within ${ms} ms`)), ms); });
    try { return await Promise.race([promise, late]); } finally { clearTimeout(timer); }
}

const available = await hostAvailable();
const skip = available.ok ? false : available.reason;

const REPLY = [
    'You search the pack and count what is inside.',
    '',
    '<Changes>',
    '+ item Rope',
    '+ item Lantern | qty: 2',
    '+ coin 10',
    '+ item Torch',
    '+ item Key',
    '</Changes>',
].join('\n');

// Runs the scripted reply with the panel open; with `scheduler` the flag `suite.redrawScheduler` is on. → { paneDraws, counts }.
async function scriptedReply(t, scheduler) {
    t.mock.method(console, 'warn', () => {});
    const doc = setupDom();
    let resolveAssist;
    const assistDone = new Promise(resolve => { resolveAssist = resolve; });

    const host = await createHost({
        settings: { modules: { 'story-block': { assistExtractor: true } } },
        callModel: async () => 'none',
    });
    if (scheduler) host.ctx.extensionSettings.storySuite = { ...host.ctx.extensionSettings.storySuite, flags: { 'suite.redrawScheduler': true } };
    const ui = mountUi({ runtime: host, ctx: host.ctx, doc });

    let paneDraws = 0;
    const counts = { committed: 0, turn: 0, head: 0 };
    let counting = false;

    const offs = [
        host.events.on('committed', () => { if (counting) counts.committed += 1; }),
        host.events.on('turn', () => { if (counting) counts.turn += 1; }),
        host.events.on('head', () => {
            if (!counting) return;
            counts.head += 1;
            resolveAssist();
        }),
    ];

    try {
        await host.sdk.registerModule({
            id: 'qa-bench',
            name: 'Bench',
            version: '2.0.0-alpha.1',
            commands: {
                'qa-bench.step': () => ({ summary: 'step' }),
                'qa-bench.oob': () => ({ summary: 'oob' }),
            },
            hooks: {
                afterCapture: () => ({
                    commands: [
                        { type: 'qa-bench.step', payload: { step: 1 } },
                        { type: 'qa-bench.step', payload: { step: 2 } },
                    ],
                }),
            },
            tabs: [{
                id: 'count',
                title: 'Count',
                icon: 'fa-gauge',
                render(pane) {
                    if (counting) paneDraws += 1;
                    const node = doc.createElement('p');
                    node.textContent = `draws=${paneDraws}`;
                    pane.appendChild(node);
                },
            }],
        });

        ui.refresh();
        ui.openPanel();
        const tabBtn = doc.querySelectorAll('.story-suite-tab').find(node => node.getAttribute('data-tab-id') === 'count');
        assert.ok(tabBtn, 'counting tab button exists');
        tabBtn.click();

        // Start counting after initial panel open and tab selection.
        paneDraws = 0;
        counting = true;

        await host.send('Search the pack.', REPLY);
        await within(assistDone, 30000, 'the head event (Assist afterReply)');
        await host.sdk.command('qa-bench.oob', {});

        await new Promise(resolve => setTimeout(resolve, 40));   // (the last frame)
        counting = false;
        return { paneDraws, counts };
    } finally {
        offs.forEach(off => off());
        ui.destroy();
        host.close();
    }
}

test('J11-0 baseline: one scripted reply with panel open draws the tab pane 10 times (5+2+1+1+1)', { skip, timeout: 60000 }, async t => {
    const { paneDraws, counts } = await scriptedReply(t, false);
    console.log(JSON.stringify({ bench: 'sb-redraw-count', flag: false, paneDraws, ...counts }));
    assert.equal(counts.committed, 8, '5 lines + 2 afterCapture steps + 1 out-of-turn command');
    assert.equal(counts.turn, 1, '1 turn event');
    assert.equal(counts.head, 1, '1 head event from Assist afterReply');
    assert.equal(paneDraws, 10, '10 pane draws today (5+2+1+1+1)');
});

test('J11-3 flag on: the same reply draws the tab pane at most 3 times (10 today), at least once', { skip, timeout: 60000 }, async t => {
    // A browser frame (~16 ms) spans a burst of events; the test page has no requestAnimationFrame, so it gets one.
    globalThis.requestAnimationFrame = fn => setTimeout(fn, 16);
    let result;
    try { result = await scriptedReply(t, true); } finally { delete globalThis.requestAnimationFrame; }
    const { paneDraws, counts } = result;
    console.log(JSON.stringify({ bench: 'sb-redraw-count', flag: true, paneDraws, ...counts }));
    assert.deepEqual(counts, { committed: 8, turn: 1, head: 1 }, 'the same events');
    assert.ok(paneDraws >= 1 && paneDraws <= 3, `${paneDraws} pane draws with the scheduler on (10 today)`);
});
