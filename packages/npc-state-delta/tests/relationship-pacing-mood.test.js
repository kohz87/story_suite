import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_ID } from '../src/storysuite-v2.js';
import { validateNpcSlice, createNpcPart } from '../src/npc-meters.js';
import { applyEvents, easeAxis, restMood, restingMood } from '../npc-mood.js';
import { stepPull, samePlace } from '../npc-instincts.js';
import { DAY, suite } from './helpers/pacing-suite.js';
import { MOOD_ON, axes, clockTo, moodSuite, plain, recordOf, world } from './relationship-pacing.helpers.js';

// ---- mood and pull (feature npc-state-delta.mood-pull; npc-mood.js, npc-instincts.js) ----

test('mood: a trust drop and a betrayal move the axes by the rules and keep the reason as the cause; a rise does nothing', async () => {
    const s = await moodSuite();
    await s.setDay(2);
    await s.say(['~ npc Oren | trust: +3']);
    assert.equal(recordOf(s).mood, undefined, 'a rise moves no mood');
    await s.say(['~ npc Oren | trust: -2 | impact: meaningful | reason: Astra lied']);
    assert.deepEqual(plain(recordOf(s).mood), { v: -1, a: 1, d: -1, day: 2, cause: 'trust dropped: Astra lied' });
    await s.say(['~ npc Oren | trust: -3 | impact: major | why: the vault']);
    assert.deepEqual(plain(recordOf(s).mood), { v: -3, a: 3, d: -2, day: 2, cause: 'betrayed: the vault' });
    assert.deepEqual(validateNpcSlice(s.host.head().domains.npc), []);
    const row = (await s.host.sdk.query('npc.cast', {})).find(item => item.key === 'oren');
    assert.equal(row.mood.word, 'Alarmed');
    assert.deepEqual(row.mood.bars, { energy: 6, control: 1, max: 6 });
    assert.equal(row.mood.cause, 'betrayed: the vault');
    const shown = s.adapter.dossierMeters([{ id: 'npc_oren', name: 'Oren' }]);
    assert.equal(shown.npc_oren.mood.word, 'Alarmed', 'the dossier view model carries the mood');
});

test('mood eases toward rest over story time: per-axis speed, proportional, same minute = no extra easing, always all three fields', async () => {
    const s = await moodSuite();
    await s.setDay(2);
    await s.say(['~ npc Oren | trust: -3 | impact: major']);
    assert.deepEqual(axes(s), [-2, 2, -1]);
    const at = recordOf(s).mood.at;
    await clockTo(s, at + 5);
    await s.say([]);
    assert.deepEqual(axes(s), [-2, 2, -1], 'five minutes later: nothing moves yet');
    await clockTo(s, at + 5);
    await s.say([]);
    assert.deepEqual(axes(s), [-2, 2, -1], 'a Continue or swipe in the same minute: no extra easing');
    await clockTo(s, at + 240);
    await s.say([]);
    assert.deepEqual(axes(s), [-2, 1, -1], 'about 4 hours: arousal about halved, valence and dominance barely moved');
    await clockTo(s, at + 600);
    await s.say([]);
    assert.deepEqual(axes(s), [-1, 0, -1], 'ten hours: arousal gone, valence about half, dominance slowest');
    await clockTo(s, at + DAY + 120);
    await s.say([]);
    assert.deepEqual(axes(s), [0, 0, -1], 'a day and a bit: valence gone, dominance still there');
    await clockTo(s, at + 5 * DAY);
    await s.say([]);
    assert.deepEqual(axes(s), [0, 0, 0], 'days later: at rest, and the three fields are still on the record');
    assert.deepEqual(Object.keys(recordOf(s).mood).filter(key => ['v', 'a', 'd'].includes(key)), ['v', 'a', 'd']);
    assert.deepEqual(validateNpcSlice(s.host.head().domains.npc), []);
});

test('mood: new events add on top of what is left; ongoing stress keeps it raised', async () => {
    const s = await moodSuite();
    await s.setDay(2);
    await s.say(['~ npc Oren | trust: -2 | impact: meaningful']);
    const at = recordOf(s).mood.at;
    await clockTo(s, at + 120);
    await s.say(['~ npc Oren | trust: -2 | impact: meaningful']);
    assert.equal(recordOf(s).mood.a, 2, 'arousal 1 eased to 1 after two hours, plus the new drop');
    assert.equal(recordOf(s).mood.v, -2);
    await clockTo(s, at + 180);
    await s.say(['~ npc Oren | trust: -2 | impact: meaningful']);
    assert.equal(recordOf(s).mood.a, 3, 'stacks under ongoing stress');
});

test('mood: a person with a temperament settles there, not at 0, and the record is stored with it', async () => {
    const rest = restingMood('A calm, confident old sailor.');
    assert.deepEqual(rest, { v: 0, a: -1, d: 1 });
    assert.deepEqual(restingMood('plain person', null), { v: 0, a: 0, d: 0 });
    assert.deepEqual(restingMood('cheerful warm kind gentle joyful'), { v: 2, a: 0, d: 0 }, 'at most 2 either way');
    const m = restMood(rest, 5000);
    assert.deepEqual([m.v, m.a, m.d, m.rest, m.at], [0, -1, 1, rest, 5000]);
    const hit = applyEvents(m, 5000, [{ kind: 'betrayal' }]);
    assert.deepEqual([hit.v, hit.a, hit.d], [-2, 1, 0]);
    const later = applyEvents(hit, 5000 + 20 * DAY, []);
    assert.deepEqual([later.v, later.a, later.d], [0, -1, 1], 'after many days: back at the temperament, not at 0,0,0');
    assert.deepEqual(validateNpcSlice({ ...JSON.parse(JSON.stringify({ npcs: {} })) }).filter(line => /mood/.test(line)), []);
});

test('mood easing core: proportional, integer, never overshooting, per-axis speed, replay == rebuild', () => {
    const steps = [0, 30, 60, 120, 240, 480, 960, 1920, 5000, 50000];
    for (const half of [210, 720, 1620]) {
        for (const [from, rest] of [[3, 0], [-3, 0], [3, -1], [-3, 2], [1, 1], [0, 2]]) {
            let last = Math.abs(from - rest);
            for (const m of steps) {
                const v = easeAxis(from, rest, m, half);
                assert.ok(Number.isInteger(v));
                const mag = Math.abs(v - rest);
                assert.ok(mag <= last, 'never moves away');
                assert.ok(Math.sign(v - rest) === 0 || Math.sign(v - rest) === Math.sign(from - rest), 'never overshoots rest');
                last = mag;
            }
            assert.equal(easeAxis(from, rest, 5000000, half), rest);
        }
    }
    const far = 3 - easeAxis(3, 0, 300, 210), near = 1 - easeAxis(1, 0, 300, 210);
    assert.ok(far >= near, 'the further away, the bigger the step');
    assert.equal(easeAxis(3, 0, 210, 210), 2, 'about half after one half-life (3 -> 1.5 -> 2)');
    assert.ok(easeAxis(3, 0, 720, 210) <= 0, 'arousal is gone in 12 hours');
    assert.ok(easeAxis(3, 0, 1440, 1620) > easeAxis(3, 0, 1440, 720), 'dominance is slower than valence');
    const mood = applyEvents(null, 1000, [{ kind: 'betrayal', reason: 'x' }]);
    const once = applyEvents(mood, 1000 + 400, []);
    assert.deepEqual(applyEvents(once, 1000 + 400, []), once, 'reading twice at one minute is the same');
    assert.deepEqual(applyEvents(applyEvents(mood, 1100, []), 1400, []), applyEvents(mood, 1400, []), 'any read cadence gives the same axes');
});

test('pull: closure from an open thread that names them, after the days it waited; belonging when benched', async () => {
    const s = await moodSuite();
    await s.setDay(1);
    await world(s, { party: [{ id: 'a', name: 'Oren' }], threads: [{ id: 'th_aaaaaaaa', key: 'The stolen letter', status: 'active', fields: { people: 'Oren, Astra' } }] });
    await s.say(['~ npc Oren | trust: +1']);
    assert.equal(recordOf(s).pull, undefined, 'a thread seen today has waited no days');
    await s.setDay(4);
    await s.say([]);
    assert.deepEqual(recordOf(s).pull, { kind: 'closure', cause: 'The stolen letter', since: 1 });
    assert.deepEqual(recordOf(s).inst, { belo: 0, clos: 1, awe: 0 });
    const pulled = s.adapter.dossierMeters([{ id: 'npc_oren', name: 'Oren' }]).npc_oren.pull;
    assert.deepEqual([pulled.kind, pulled.level, pulled.days], ['closure', 1, 3], 'the dossier view model carries the pull, its level and days');
    await s.setDay(5);
    await world(s, { party: [{ id: 'it_aaaaaaaa', name: 'Astra' }] });
    await s.say([]);
    assert.deepEqual(recordOf(s).pull, { kind: 'belonging', cause: 'benched from the party', since: 5 });
    assert.equal(recordOf(s).inst.belo, 3);
    await world(s, { party: [{ id: 'a', name: 'Oren' }], threads: [] });
    await s.say([]);
    assert.equal(recordOf(s).pull?.cause === 'benched from the party', false, 'back in the party: no longer benched');
    assert.deepEqual(validateNpcSlice(s.host.head().domains.npc), []);
});

test('pull: awe at the first arrival at a place they were not at before (the first place seen is only remembered)', async () => {
    const s = await moodSuite();
    await s.setDay(1);
    await s.say(['~ place Market | street | Dunmere', '~ npc Oren | trust: +1']);
    assert.equal(recordOf(s).pull, undefined, 'the first place is the baseline, not an arrival');
    await s.say(['~ place Harbor | docks | Dunmere']);
    assert.deepEqual(recordOf(s).pull, { kind: 'awe', cause: 'first time at Harbor', since: 1 });
    assert.deepEqual(recordOf(s).track.places, ['Market', 'Harbor']);
    await s.say(['~ place Market | street | Dunmere']);
    assert.equal(recordOf(s).pull, undefined, 'a place they have seen is no awe');
    assert.deepEqual(validateNpcSlice(s.host.head().domains.npc), []);
});

test('pull trace (run 3): a place under a fuller or shorter name is the same place, so no false arrival', async () => {
    assert.equal(samePlace("Ram's Head Inn", "Ram's Head"), true);
    assert.equal(samePlace('Market District', 'Market District, Highmark Capital'), true);
    assert.equal(samePlace('Bluewatch Village / Guild Office', 'Bluewatch Village'), true);
    assert.equal(samePlace('Guild Hall', 'Guild Yard'), false);
    assert.equal(samePlace('River wall', ''), false);
    const s = await moodSuite();
    await s.setDay(1);
    await s.say(["~ place Ram's Head Inn | inn | Highmark", '~ npc Oren | trust: +1']);
    await s.say(["~ place Ram's Head | inn | Highmark"]);
    assert.equal(recordOf(s).pull, undefined, 'the same inn under a shorter name is no arrival');
    assert.deepEqual(recordOf(s).track.places, ["Ram's Head Inn"]);
    await s.say(['~ place Old Tannery | dungeon | Highmark']);
    assert.equal(recordOf(s).pull?.kind, 'awe', 'a different place still is');
});

test('pull trace (run 3): a hook names its giver, and the thread counts its own days from when the host opened it, not from when this person was first read', async () => {
    const s = await moodSuite();
    await s.setDay(4);
    await world(s, { threads: [{ id: 'th_bbbbbbbb', key: 'Dockside Recruitment', status: 'active', fields: { giver: 'Oren', goal: 'confront Garvan' }, track: { created: { turn: 3, time: 1 * DAY } } }] });
    await s.say(['~ npc Oren | trust: +1']);
    assert.deepEqual(recordOf(s).pull, { kind: 'closure', cause: 'Dockside Recruitment', since: 1 });
    assert.equal(stepPull({}, { day: 4, party: false, threads: [{ id: 'x', title: 't' }] }).track.threads.x, 4, 'a host that gives no opening day: the day first read, as before');
});

test('pull trace (run 3): Pull and Mood reach the prompt as kept lines (after the Changes cue), and survive a tight tail budget', async () => {
    const { assemble } = await import('../../story-block/src/v2/prompt.js');
    const s = await moodSuite();
    await s.setDay(1);
    await s.say(['~ place Market | street | Dunmere', '~ npc Oren | trust: +1']);
    await s.say(['~ place Harbor | docks | Dunmere', '~ npc Oren | trust: -3 | impact: major | reason: a broken oath']);
    const tail = s.host.registry.module(MODULE_ID).context.tail({ state: s.host.head(), chat: { length: s.host.ctx.chat.length } });
    const kept = tail.lines.filter(line => typeof line === 'object' && line.keep === true).map(line => line.text);
    assert.match(kept[0], /^Whenever anything changed/, 'the cue is first of the kept lines (as on main); Pull and Mood take what the cap leaves');
    assert.match(kept[1], /^Pull: Oren: awe \(first time at Harbor\)\.$/);
    assert.match(kept[2], /^Mood: Oren /);
    assert.ok(!tail.optional.some(line => /^(Pull|Mood): /.test(line)), 'not optional lines: the host drops those first');
    const view = { state: s.host.head(), query: () => null, settings: {}, chat: { length: s.host.ctx.chat.length } };
    const built = assemble({ registry: s.host.registry, view, settings: { tailBudget: 60 } });
    assert.match(built.tailText, /^Pull: Oren: awe/m, built.tailText);
    assert.match(built.tailText, /^Mood: Oren /m);
});

test('pull + mood + cue + another module\'s kept line, tailBudget 550: all reach the prompt, the other module\'s kept line stays, the tail is under budget; a spent cap keeps the cue and gives up Pull and Mood first', async () => {
    const { assemble, estimateTokens } = await import('../../story-block/src/v2/prompt.js');
    async function run(keptTokens) {
        const s = await moodSuite();
        await s.setDay(1);
        await s.say(['~ place Market | street | Dunmere', '~ npc Oren | trust: +1']);
        await s.say(['~ place Harbor | docks | Dunmere', '~ npc Oren | trust: -3 | impact: major | reason: a broken oath']);
        const initiative = 'Initiative: Mira acts first, then the guards, then Oren.';
        const filler = Array.from({ length: 11 }, (_, i) => `Scene note ${i + 1}: ${'the harbour street holds its breath '.repeat(5)}`.trim());
        s.host.registry.register({ id: 'aa-crowd', name: 'Crowd', context: { tail: () => ({ lines: [{ text: initiative, keep: true }, ...filler] }) } });
        const view = { state: s.host.head(), query: () => null, settings: {}, chat: { length: s.host.ctx.chat.length } };
        return { built: assemble({ registry: s.host.registry, view, settings: { tailBudget: 550 }, keptTokens }), initiative };
    }
    const roomy = await run(32);
    assert.ok(roomy.built.tailText.includes(roomy.initiative), 'the other module\'s kept line stays');
    assert.match(roomy.built.tailText, /^Pull: Oren: awe/m);
    assert.match(roomy.built.tailText, /^Mood: Oren /m);
    assert.match(roomy.built.tailText, /Whenever anything changed/);
    const at = text => roomy.built.tailText.indexOf(text);
    assert.ok(at('Whenever anything changed') < at('Pull: Oren') && at('Pull: Oren') < at('Mood: Oren'), 'the cue, then Pull, then Mood');
    assert.ok(estimateTokens(roomy.built.tailText) <= 550, `tail ${estimateTokens(roomy.built.tailText)} tokens`);
    const tight = await run(100);
    assert.ok(tight.built.tailText.includes(tight.initiative), 'a spent cap never costs the other module\'s kept line');
    assert.ok(estimateTokens(tight.built.tailText) <= 550, `tail ${estimateTokens(tight.built.tailText)} tokens`);
    assert.ok(!/Whenever anything changed/.test(tight.built.tailText), 'only 20 tokens left of the cap: the 49-token cue does not fit, as on main (#315); Pull and Mood do not change that');
});

test('run-3 shape, tailBudget 550, 1/2/3 present people with a Pull: the cue and the first Pull reach the prompt, another module\'s kept line stays, a line over the felt cap is optional', async () => {
    const { assemble, estimateTokens } = await import('../../story-block/src/v2/prompt.js');
    const record = (name, extra) => ({ name, meters: { trust: 5, affection: 0, desire: 0, tension: 0 }, stages: {}, unlocked: [], turn: { reply: 0, from: {} }, day: 5, ...extra });
    const awe = 'first time at River wall, Highmark Capital';
    const shapes = {
        1: { oren: record('Oren', { mood: { v: -2, a: 2, d: -2, day: 5, cause: 'x' }, pull: { kind: 'awe', cause: 'first time at Harbor', since: 5 } }) },
        2: { marda: record('Marda', { pull: { kind: 'awe', cause: awe, since: 5 } }), pell: record('Pell', { pull: { kind: 'awe', cause: awe, since: 5 } }) },
        3: {
            mira: record('Mira', { mood: { v: -2, a: 2, d: -2, day: 5, cause: 'x' }, pull: { kind: 'closure', cause: 'Dockside Recruitment and the missing ledger of Garvan', since: 1 } }),
            oren: record('Oren', { mood: { v: 2, a: 0, d: 0, day: 5, cause: '' }, pull: { kind: 'closure', cause: 'The Stolen Letter from the Harbourmaster Office', since: 2 } }),
            tomas: record('Tomas', { mood: { v: -3, a: 3, d: 0, day: 5, cause: 'x' }, pull: { kind: 'awe', cause: awe, since: 5 } }),
        },
    };
    const filler = Array.from({ length: 11 }, (_, i) => `Scene note ${i + 1}: ${'the harbour street holds its breath '.repeat(5)}`.trim());
    const initiative = 'Initiative: Pell acts first, then Marda, then the dock guards, then Corran.';
    for (const [count, npcs] of Object.entries(shapes)) {
        const names = Object.values(npcs).map(r => r.name);
        const part = createNpcPart({ settings: () => ({}), present: () => names, feature: () => undefined });
        const nsd = { moduleId: 'npc-state-delta', name: 'NPC State Delta', domains: ['npc'], kinds: [], static: () => '', tail: part.context.tail, budget: part.context.budget };
        const dir = { moduleId: 'story-director', name: 'Story Director', domains: ['director'], kinds: [], tail: () => ({ lines: [{ text: initiative, keep: true }, ...filler], optional: ['Director optional line.'] }) };
        const view = { state: { domains: { npc: { problems: [], npcs } } }, chat: { length: 1 } };
        const built = assemble({ registry: { contexts: () => [nsd, dir] }, view, settings: { tailBudget: 550 }, keptTokens: 24 });
        const t = built.tailText;
        const first = Object.values(npcs)[0].name;
        assert.ok(t.includes(initiative), `${count}: the other module's kept line stays`);
        assert.match(t, /Whenever anything changed/, `${count} present: the cue reaches the prompt`);
        assert.match(t, new RegExp(`^Pull: ${first}: `, 'm'), `${count} present: the first person's Pull reaches the prompt\n${t}`);
        assert.ok(estimateTokens(t) <= 550, `${count}: tail ${estimateTokens(t)} tokens`);
        const raw = part.context.tail(view);
        const keptTokens = raw.lines.filter(l => typeof l === 'object' && l.keep).reduce((n, l) => n + estimateTokens(l.text), 0);
        assert.ok(keptTokens <= 120 - 24 - 19, `${count}: NSD's kept lines (${keptTokens}) fit what pulse and Initiative leave`);
        assert.ok(raw.lines.every(l => typeof l === 'object' || !/^(Pull|Mood): /.test(l)), 'no Pull or Mood line is a required plain line');
        if (count === '3') assert.ok(raw.optional.some(l => /^Pull: Oren/.test(l)), 'the other people\'s Pull is optional');
        console.log(`TAIL ${count}\n${t.split('\n').filter(l => !/^Scene note/.test(l)).join('\n')}\n--- ${estimateTokens(t)} tokens`);
    }
});

test('pull: a person away (key people) feels left behind; a failing or missing query is no signal', async () => {
    const s = await moodSuite();
    await s.setDay(3);
    await world(s, { away: [{ name: 'Oren', aliases: [], here: false, away: { doing: 'abroad', since: 2 * DAY, back: null, steps: [] } }] });
    await s.say(['~ npc Oren | trust: +1']);
    assert.deepEqual(recordOf(s).pull, { kind: 'belonging', cause: 'left behind while the group moved on', since: 2 });
    // A query that throws is no signal too: the tick still runs and the record is clean.
    const broken = await suite({ allowance: null, features: MOOD_ON, modules: [{ id: 'zz-broken', name: 'Broken', queries: { 'party.actors': () => { throw new Error('down'); }, 'director.threads': () => { throw new Error('down'); }, 'director.keyPeople': () => { throw new Error('down'); } } }] });
    await broken.setDay(3);
    await broken.say(['~ npc Oren | trust: -3 | impact: major']);
    await broken.setDay(6);
    await broken.say([]);
    assert.equal(recordOf(broken).pull, undefined);
    assert.equal(recordOf(broken).mood.day, 6, 'the tick ran (the mood settled to day 6)');
    assert.deepEqual(validateNpcSlice(broken.host.head().domains.npc), []);
    const bare = await suite({ allowance: null, features: MOOD_ON });
    await bare.setDay(3);
    await bare.say(['~ npc Oren | trust: -3 | impact: major']);
    assert.equal(recordOf(bare).pull, undefined, 'no party, threads or key people: no pull');
    assert.deepEqual(validateNpcSlice(bare.host.head().domains.npc), []);
});
