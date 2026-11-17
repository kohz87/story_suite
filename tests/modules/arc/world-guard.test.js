// The arc planner's react-not-resolve rule (switch story-director.world-events): the rule is in the brief only while the switch is on
// (off: the text main sends), and the code guard leaves out a beat, clock or agenda that decides an Active event, with the adopted note
// on the arc card (findings) and in the accept receipt (the note is kept in the command payload, so a replay says the same).
import test from 'node:test';
import assert from 'node:assert/strict';

import { createFakeModel, createHost } from '../../../testkit/index.js';
import { createModule } from '../../../ui/legacy/director/module.js';
import { createArcController } from '../../../modules/arc/index.js';
import { WORLD_EVENT_RULE, readPlan, refuseResolving, trackerSummary, worldBriefText } from '../../../modules/arc/plan.js';
import { browserStore, createReveal } from '../../../ui/legacy/director/screens/reveal.js';
import { overrideWorld } from '../../../modules/world/chronicle/world-daily/read-world.js';

const FEATURE = 'story-director.world-events';
const said = (text, lines = []) => (lines.length ? `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>` : text);
const PLAN = '<plan>\nARC: Succession — a crown in doubt\nBEAT: Refugees — families leave Highmark\nBEAT: Coronation — the succession is settled, heir-crowned in the hall\nCLOCK: Rumours — whispers grow | due: in 2 days\n</plan>';
const PACK = JSON.stringify({ id: 'guard', version: '1.0.0', name: 'Guard', requires: { storyBlock: '^2' }, content: { places: [{ name: 'Highmark', region: 'The March', x: 0, y: 0, kind: 'town' }] } });
const SPEC = {
    realms: [{ name: 'March Realm', regions: ['The March'] }],
    events: [{
        id: 'succession', kind: 'one-off', certainty: 'set-in-motion', where: ['Highmark'], window: { after: 'start', within: '1 day' }, ends_when: { for: '9 days' }, title: 'The succession', summary: 'The king is dead.',
        outcomes: [{ name: 'heir-crowned', weight: 1 }, { name: 'regency', weight: 1 }],
    }],
};
const GUARD = [{ id: 'succession', title: 'The succession', outcomes: ['heir-crowned', 'regency'] }];

async function setUp(on, replies) {
    const undo = overrideWorld(world => ({ ...world, ...SPEC }));
    const model = createFakeModel(replies);
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text), feature: id => host?.features.on(id) } });
    host = await createHost({ callModel: model, modules: [module] });
    if (on) host.features.set(FEATURE, true);
    assert.equal((await host.packs.packs.install(PACK, { origin: 'pack.json' })).ok, true);
    const store = browserStore(null);
    const reveal = createReveal({ store, chatId: () => 'chat-1', settings: () => host.sdk.settings('story-director') });
    const arc = createArcController({ sdk: () => host.sdk, chat: () => host.ctx.chat, chatId: () => 'chat-1', store, reveal, notify: () => {} });
    host.done = () => { host.close(); undo(); };
    return { host, model, arc };
}

test('the rule is in the brief with the switch on, and not with it off', async () => {
    const on = await setUp(true, [PLAN]);
    const off = await setUp(false, [PLAN]);
    try {
        await on.host.send('Begin.', said('Highmark at dawn.', ['~ time June 3, 1200, 08:00 am', '~ place Highmark']));
        await off.host.send('Begin.', said('Highmark at dawn.', ['~ time June 3, 1200, 08:00 am', '~ place Highmark']));
        await on.arc.plan();
        await off.arc.plan();
        assert.ok(on.model.calls[0].system.includes(WORLD_EVENT_RULE));
        assert.ok(!off.model.calls[0].system.includes('World events resolve'));
        assert.ok(!off.model.calls[0].system.includes(WORLD_EVENT_RULE.slice(0, 40)));
        assert.equal(worldBriefText(null), '', 'the controller\'s join adds nothing without a brief');
        assert.equal([trackerSummary([]), worldBriefText(null)].filter(Boolean).join('\n'), trackerSummary([]));
    } finally { on.host.done(); off.host.done(); }
});

test('the guard leaves out a beat or clock that names an Active event with its outcome, with the adopted note', () => {
    const read = readPlan(PLAN);
    const out = refuseResolving(read, GUARD);
    assert.deepEqual(out.read.items.map(item => item.key), ['Refugees', 'Rumours']);
    assert.deepEqual(out.refused, ['Refused: this beat decides how the world event "The succession" ends; the world resolves it by itself. Plan a reaction instead.']);
    assert.deepEqual(out.read.findings.at(-1), { severity: 'warn', text: out.refused[0] });
    const agenda = readPlan('<plan>\nARC: A — b\nAGENDA: Duke — he wants the throne | now: the regency is settled\nBEAT: Letter — a letter comes\n</plan>');
    assert.deepEqual(refuseResolving(agenda, GUARD).read.items.map(item => item.key), ['Duke', 'Letter'], 'an outcome word without the event, not id-like: not certain, left to the judge');
    const bare = readPlan('<plan>\nARC: A — b\nBEAT: Crown — heir-crowned at dusk\n</plan>');
    assert.equal(refuseResolving(bare, GUARD).read.items.length, 0, 'an outcome id on its own is refused');
    assert.equal(refuseResolving(bare, GUARD).read.findings[0].severity, 'error', 'a plan with nothing left cannot be used');
    assert.equal(refuseResolving(read, []).read, read, 'no Active event: nothing changes');
    assert.equal(refuseResolving(read, null).read, read);
});

test('planned and accepted: the refused beat is not tracked, the card and the receipt say so', async () => {
    const { host, arc } = await setUp(true, [PLAN]);
    try {
        await host.send('Begin.', said('Highmark at dawn.', ['~ time June 3, 1200, 08:00 am', '~ place Highmark']));
        assert.deepEqual(host.sdk.query('chronicle.world.brief', {}).guard.map(each => each.id), ['succession']);
        const planned = await arc.plan();
        assert.equal(planned.ok, true);
        assert.doesNotMatch(planned.draft.text, /Coronation/);
        assert.match(planned.draft.findings.at(-1).text, /^Refused: this beat decides how the world event "The succession" ends/);
        const accepted = await arc.accept();
        assert.equal(accepted.ok, true);
        const threads = host.sdk.view().state.domains.director.threads ?? {};
        assert.ok(!JSON.stringify(threads).includes('Coronation'));
        assert.match(accepted.receipt.summary, /^New arc: Succession.* Refused: this beat decides how the world event "The succession" ends/, 'the receipt carries the note');
    } finally { host.done(); }
});

test('switch off: the planner\'s answer is kept as it is', async () => {
    const { host, arc } = await setUp(false, [PLAN]);
    try {
        await host.send('Begin.', said('Highmark at dawn.', ['~ time June 3, 1200, 08:00 am', '~ place Highmark']));
        const planned = await arc.plan();
        assert.match(planned.draft.text, /Coronation/);
        assert.equal(planned.draft.refused, undefined);
        const accepted = await arc.accept();
        assert.equal(accepted.ok, true);
        assert.doesNotMatch(accepted.receipt.summary, /Refused/);
    } finally { host.done(); }
});
