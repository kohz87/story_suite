// The Director judge on tomorrow's daily roll (switch story-director.world-events): with the chronicle setting `judge` the events the roll will fire
// are asked about once a day and a refusal holds one back for that day (it rolls again the next); with the arc setting `dailyPass` every eligible
// event is asked about and may be made likelier or less likely. Only stored marks are read: swipes, a rebuild and a reload roll the same way.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createHost } from '../../../../testkit/index.js';
import { createModule } from '../../../../modules/director/module.js';
import { overrideWorld } from '../../../../modules/world/chronicle/world-daily/read-world.js';
import { rollAsker } from '../../../../modules/arc/judge/roll-ask.js';
import { markedChance } from '../../../../modules/world/daily/director-mark.js';
import { fakeFightRunner } from '../../../suite/integration/director/helpers/fake-fight-runner.js';
import { FEATURE, reply, settle } from './judge-host.helpers.js';

const PACK = JSON.stringify({ id: 'roll-world', version: '1.0.0', name: 'Roll world', format: 4, kind: 'world', requires: { suite: '^0.1' }, content: { places: [{ name: 'Highmark', region: 'The March', x: 0, y: 0, kind: 'town' }] } });
const event = (id, chance) => ({ id, kind: 'one-off', certainty: 'possible', chance, where: ['Highmark'], window: { after: 'start + 1 day', within: '20 days' }, ends_when: 'instant', title: `The ${id}`, summary: `A ${id} in Highmark.` });
const SPEC = { realms: [{ name: 'March Realm', regions: ['The March'] }], events: [event('riot', '100% over the window')] };
const SETTINGS = extra => ({ modules: { 'story-director': { 'tracker.maxJump': 60, ...extra } } });

function rollModel(answers) {
    const model = { calls: 0, prompts: [], async callModel(request) {
        if (request.module !== 'story-director roll judge') return { ok: false, error: 'FAILED', text: '' };
        model.calls += 1;
        model.prompts.push(request);
        return { ok: true, text: answers[Math.min(model.calls, answers.length) - 1], error: null };
    } };
    return model;
}

async function rollHost(model, settings, spec = SPEC) {
    const undo = overrideWorld(world => ({ ...world, ...spec }));
    rollAsker.clear();
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text), feature: id => host?.features.on(id), callModel: request => model.callModel(request), canCallModel: () => true, chat: () => [] } });
    host = await createHost({ modules: [fakeFightRunner(), module], settings: SETTINGS(settings) });
    host.features.set(FEATURE, true);
    assert.equal((await host.packs.packs.install(PACK, { origin: 'pack.json' })).ok, true);
    host.done = () => { host.close(); undo(); rollAsker.clear(); };
    host.spec = spec;
    host.settingsGiven = settings;
    return host;
}

const daily = host => host.head().domains.chronicle.daily?.[0] ?? null;
const marks = host => host.head().domains.chronicle.ledger?.[0]?.marks ?? {};
async function day(host, text) {
    await settle();
    await host.send(text, reply(text, ['! time +1d']));
}

async function agrees(host, label) {
    const live = JSON.stringify(host.head().domains);
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head().domains), live, `${label}: rebuild equals live`);
    const undo = overrideWorld(world => ({ ...world, ...host.spec }));
    const again = await createHost({ modules: [fakeFightRunner(), createModule()], settings: SETTINGS(host.settingsGiven) });
    try {
        again.features.set(FEATURE, true);
        await again.packs.packs.install(PACK, { origin: 'pack.json' });
        await again.st.loadChat(structuredClone(host.ctx.chat));
        assert.equal(JSON.stringify(again.head().domains.chronicle), JSON.stringify(host.head().domains.chronicle), `${label}: a fresh load agrees`);
    } finally { again.close(); undo(); }
}

test('judge: the event tomorrow\'s roll fires is asked about once; a refusal holds it back that day, it fires the next; replay rolls the same', async () => {
    const model = rollModel(['1: refuse: the Watch keeps Highmark quiet this week', '1: accept']);
    const host = await rollHost(model, { 'chronicle.judge': true });
    try {
        await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
        const first = daily(host).day;
        await day(host, 'Day 1.');
        const day1 = first + 1;
        assert.deepEqual(marks(host)[`riot|${day1}`], { veto: 'the Watch keeps Highmark quiet this week' }, 'the refusal is stored before the crossing reply');
        assert.equal(daily(host).events.riot.state, 'eligible', 'held back, still eligible');
        assert.match(model.prompts[0].prompt, /Items:\n1: The riot — A riot in Highmark\. \| place: Highmark$/);
        assert.doesNotMatch(model.prompts[0].system, /likelier/, 'only the pass may weight');
        await day(host, 'Day 2.');
        assert.equal(daily(host).events.riot.fired, day1 + 1, 'the next day it fires');
        assert.equal(model.calls, 2, 'one call a day');
        assert.equal(host.sdk.query('chronicle.directorCalls', {}).count, 2);
        const recorded = JSON.stringify(daily(host));
        await host.swipe(reply('Day 2, again.', ['! time +1d']));
        await settle();
        assert.equal(JSON.stringify(daily(host)), recorded, 'a swipe of the crossing reply rolls the same');
        assert.equal(model.calls, 2, 'a swipe asks nothing');
        const crossing = host.ctx.chat.findIndex(message => !message.is_user && message.mes.startsWith('Day 1.'));
        assert.equal((await host.sdk.reread(crossing)).ok, true);
        assert.equal(JSON.stringify(daily(host)), recorded, 'a Re-read of the vetoed day\'s reply: the stored veto holds, the same rolls');
        await settle();
        assert.equal(model.calls, 2, 'a Re-read asks nothing');
        await agrees(host, 'judged roll');
    } finally { host.done(); }
});

test('daily pass: every eligible event is asked about, "likelier" doubles its odds for that day; the settings off: no call', async () => {
    const spec = { ...SPEC, events: [event('omen', '10% over the window')] };
    const model = rollModel(['1: likelier']);
    const host = await rollHost(model, { 'arc.dailyPass': true }, spec);
    try {
        await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
        await day(host, 'Day 1.');
        const day1 = daily(host).day;
        assert.deepEqual(marks(host)[`omen|${day1}`], { weight: 2 });
        assert.match(model.prompts[0].system, /<n>: likelier/);
        assert.equal(daily(host).events.omen.fired, undefined, 'a weight changes the odds, never fires by itself');
        await agrees(host, 'daily pass');
    } finally { host.done(); }
    const quiet = rollModel(['1: refuse: no']);
    const off = await rollHost(quiet, {});
    try {
        await off.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
        await day(off, 'Day 1.');
        await day(off, 'Day 2.');
        assert.equal(quiet.calls, 0, 'neither setting on: nothing is asked');
        assert.ok(daily(off).events.riot.fired !== undefined, 'the roll is code\'s alone');
    } finally { off.done(); }
});

test('the mark on one roll: a veto discards it, a weight scales the odds, set-in-motion and other days are untouched', () => {
    const ws = { directorMarks: { 'omen|5': { weight: 2 }, 'riot|5': { veto: 'quiet' }, 'levy|5': { veto: 'no' } } };
    const chance = { p: 0.2, blocked: false };
    const odds = p => p / (1 - p);
    const weighted = markedChance(ws, { id: 'omen', certainty: 'possible' }, 5, chance);
    assert.ok(Math.abs(odds(weighted.chance.p) / odds(0.2) - 2) < 1e-9);
    assert.deepEqual(markedChance(ws, { id: 'riot', certainty: 'likely' }, 5, chance), { chance, veto: 'quiet' });
    assert.deepEqual(markedChance(ws, { id: 'levy', certainty: 'set-in-motion' }, 5, chance), { chance, veto: '' }, 'a set-in-motion event is never held back');
    assert.deepEqual(markedChance(ws, { id: 'omen', certainty: 'possible' }, 6, chance), { chance, veto: '' }, 'another day: no mark');
});
