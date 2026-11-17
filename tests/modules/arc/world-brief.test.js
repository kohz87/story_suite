// The arc planner and world events (switch story-director.world-events; spec §9, ruling 9; acceptance test 54, the brief's part): with an
// event Active the planner's brief carries it as a world-event thread (now, then "outcome decided by the world"), "Still to come" (pending
// backbone stages, titles only) and the conditions in the party's realm; after the event ends its thread is gone. Switch off: the brief
// is the tracker's alone, as before. (The react-not-resolve rule and its code guard: world-guard.test.js.)
import test from 'node:test';
import assert from 'node:assert/strict';

import { createFakeModel, createHost } from '../../../testkit/index.js';
import { createModule } from '../../../ui/legacy/director/module.js';
import { createArcController } from '../../../modules/arc/index.js';
import { trackerSummary, worldBriefText } from '../../../modules/arc/plan.js';
import { browserStore, createReveal } from '../../../ui/legacy/director/screens/reveal.js';
import { overrideWorld } from '../../../modules/world/chronicle/world-daily/read-world.js';
import { arcBrief } from '../../../modules/world/chronicle/world-daily/arc-brief.js';

const FEATURE = 'story-director.world-events';
const said = (text, lines = []) => (lines.length ? `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>` : text);
const PLAN = '<plan>\nARC: Quiet Days — nothing much\nBEAT: Market — the market opens\n</plan>';
const PACK = JSON.stringify({
    id: 'world-brief', version: '1.0.0', name: 'World brief', requires: { storyBlock: '^2' },
    content: {
        places: [{ name: 'Highmark', region: 'The March', x: 0, y: 0, kind: 'town' }, { name: 'Farcliff', region: 'The Coast', x: 50, y: 0, kind: 'town' }],
        conditions: [{ name: 'unrest', scope: 'place', fades: '10 days', means: 'Crowds in the streets.' }],
    },
});
const SPEC = {
    realms: [{ name: 'March Realm', regions: ['The March'] }, { name: 'Coast Realm', regions: ['The Coast'] }],
    events: [
        { id: 'levy', kind: 'one-off', certainty: 'set-in-motion', where: ['Highmark'], window: { after: 'start', within: '1 day' }, ends_when: { for: '3 days' }, title: 'The levy', effects: { set: ['unrest@Highmark', 'unrest@Farcliff'] }, summary: 'The lord calls a levy.' },
        { id: 'crowning', kind: 'chain-stage', certainty: 'likely', where: ['Highmark'], requires: ['stage:levy'], window: { after: 'fired:levy + 20 days', within: '5 days' }, ends_when: 'instant', title: 'The crowning', summary: 'A crown.' },
    ],
};

async function setUp(on) {
    const undo = overrideWorld(world => ({ ...world, ...SPEC }));
    const model = createFakeModel([PLAN, PLAN, PLAN]);
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text), feature: id => host?.features.on(id) } });
    host = await createHost({ callModel: model, modules: [module], settings: { modules: { 'story-director': { 'tracker.maxJump': 60 } } } });
    if (on) host.features.set(FEATURE, true);
    assert.equal((await host.packs.packs.install(PACK, { origin: 'pack.json' })).ok, true);
    const store = browserStore(null);
    const reveal = createReveal({ store, chatId: () => 'chat-1', settings: () => host.sdk.settings('story-director') });
    const arc = createArcController({ sdk: () => host.sdk, chat: () => host.ctx.chat, chatId: () => 'chat-1', store, reveal, notify: () => {} });
    host.done = () => { host.close(); undo(); };
    return { host, model, arc };
}

test('test 54 (the brief): an Active event as a world-event thread, Still to come, the conditions in the party\'s realm; gone once it ends', async () => {
    const { host, model, arc } = await setUp(true);
    try {
        await host.send('Begin.', said('Highmark at dawn.', ['~ time June 3, 1200, 08:00 am', '~ place Highmark']));
        const brief = host.sdk.query('chronicle.world.brief', {});
        assert.deepEqual(brief, {
            threads: [{ kind: 'world-event', key: 'The levy', now: 'The lord calls a levy.', then: 'outcome decided by the world' }],
            toCome: ['The crowning'],
            conditions: ['unrest@Highmark: Crowds in the streets.'],
            guard: [{ id: 'levy', title: 'The levy', outcomes: [] }],
        }, 'unrest at Farcliff is in another realm: not in the brief');
        assert.equal((await arc.plan()).ok, true);
        assert.match(model.calls[0].system, /World events:\n- The levy — The lord calls a levy\. → outcome decided by the world\nStill to come:\n- The crowning\nConditions in this realm:\n- unrest@Highmark: Crowds in the streets\./);
        await host.send('Wait.', said('Days pass.', ['! time +4d']));
        assert.deepEqual(host.sdk.query('chronicle.world.brief', {}).threads, [], 'the event ended: its mirrored thread is gone');
        await arc.plan();
        assert.doesNotMatch(model.calls.at(-1).system, /World events:/);
    } finally { host.done(); }
});

test('switch off: no brief, and the planner reads the tracker alone (the text main sends)', async () => {
    const { host, model, arc } = await setUp(false);
    try {
        await host.send('Begin.', said('Highmark at dawn.', ['~ time June 3, 1200, 08:00 am', '~ place Highmark']));
        assert.equal(host.sdk.query('chronicle.world.brief', {}), null);
        await arc.plan();
        assert.doesNotMatch(model.calls[0].system, /World events:|Still to come:|Conditions in this realm:/);
        const threads = [{ key: 'Old Debt', kind: 'hook', status: 'active', fields: {} }];
        assert.equal([trackerSummary(threads), worldBriefText(null)].filter(Boolean).join('\n'), trackerSummary(threads), 'the controller\'s join adds nothing without a brief');
    } finally { host.done(); }
});

test('arcBrief: an outcome is shown with the summary; Lapsed, Replaced and fired stages are not still to come', () => {
    const world = { ...SPEC, places: [{ name: 'Highmark', region: 'The March' }], events: [...SPEC.events, { ...SPEC.events[1], id: 'gone', title: 'Gone' }] };
    const out = arcBrief({ daily: { events: { levy: { state: 'active', outcome: 'the lords split' }, gone: { state: 'lapsed' } } }, world, place: 'Highmark' });
    assert.equal(out.threads[0].now, 'The lord calls a levy. (outcome: the lords split)');
    assert.deepEqual(out.toCome, ['The crowning']);
});
