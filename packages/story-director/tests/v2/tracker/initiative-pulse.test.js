// World pulse (pulse/effects.js): a seeded step before the reply, a slot, one tail line.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { part } from '../../../src/v2/tracker/index.js';
import { setPersonaReader } from '../../../src/v2/tracker/initiative.js';
import { makeState, runCommand, story } from './helpers/fake-ctx.js';
import { rng } from '../../vendor/story-block/src/v2/rng.js';
import { PULSE, QUIET, agendaProgress, meetEntry, modeOf, part as pulsePart, pulseCommand, pulseHook, quietCommand, resultsOf, shiftEntry, weatherFrom, worldLine } from '../../../src/v2/pulse/effects.js';
import { rumor } from '../../../src/v2/chronicle/capture/world.js';
import { INTENSITIES, QUIET_FALLBACK, QUIET_SPREAD, TABLES, briefFor, d20Of, flavourLines, intensityOf, resolveKind, tableFor } from '../../../src/v2/pulse/tables.js';
import { WORLD, withScene } from './initiative.helpers.js';

const seededPulse = seed => (ctx, payload) => pulseCommand({ ...ctx, rng: rng(seed) }, payload);
const pulseAt = (state, seed, { at = 5, settings = {}, call = null, queries = {}, payload = {} } = {}) => runCommand(state, seededPulse(seed), { at, ...payload }, { settings, call, queries });
const clocked = () => withScene(story(WORLD, makeState()), { present: ['Elula', 'Bram'] });

const pulseTexts = (state, seeds = 150, payload = {}) => {
    const out = [];
    for (let seed = 1; seed <= seeds; seed += 1) {
        const result = pulseAt(state, seed, { payload });
        assert.equal(result.ok, true, result.message);
        out.push(...resultsOf(result.state.domains.director));
    }
    return out;
};

test("pulse: a step that carries the persona never makes {{user}} the subject of an event: not a mood, not a memory, not a chance meeting; alone, those events step down", () => {
    const withAstra = withScene(story(WORLD, makeState()), { present: ['Astra', 'Elula'] });
    // Without the persona told, the old reading: Astra is picked (proves the scene would offer her).
    assert.ok(pulseTexts(withAstra).some(entry => /^Astra /.test(entry.text)), 'Astra is a candidate when nobody says she is the player');
    const told = { persona: 'Astra', age: 1, reach: 2 };
    const mixed = pulseTexts(withAstra, 150, told);
    assert.ok(mixed.every(entry => !entry.text.includes('Astra') && entry.who !== 'Astra'));
    assert.ok(mixed.some(entry => entry.who === 'Elula'), 'the NPC still gets the mood');
    const alone = pulseTexts(withScene(story(WORLD, makeState()), { present: ['Astra'] }), 150, told);
    assert.ok(alone.every(entry => !entry.text.includes('Astra') && entry.kind !== 'MOOD_SWING' && entry.kind !== 'MEMORY_TRIGGER'));
    // A cast person who is the persona is never met by chance; another still is.
    const cast = { people: { astra: { name: 'Astra', alive: true, met: null }, rika: { name: 'Rika', alive: true, met: null } } };
    for (const unit of [0, 0.4, 0.9]) assert.equal(meetEntry({ cast, at: 4, place: 'Bluewatch Village', draw: { actor: unit }, persona: 'Astra' }).receipt.who, 'rika');
    assert.equal(meetEntry({ cast: { people: { astra: cast.people.astra } }, at: 4, place: 'Bluewatch Village', persona: 'Astra' }), null);
    assert.equal(meetEntry({ cast, at: 4, place: 'Bluewatch Village', draw: { actor: 0 } }).receipt.who, 'astra', 'no persona told: the old pick');
});

test('pulse: a step recorded before the persona rule (no `persona`) replays byte-identical, whatever the reader says now; the hook stores the persona on new steps', () => {
    const scenes = [['Astra', 'Elula', 'Bram'], ['Astra']].map(present => withScene(story(WORLD, makeState()), { present }));
    const before = scenes.map(state => JSON.stringify(pulseTexts(state, 200, { age: 1, reach: 2 })));
    setPersonaReader(() => 'Astra');
    try {
        assert.deepEqual(scenes.map(state => JSON.stringify(pulseTexts(state, 200, { age: 1, reach: 2 }))), before, 'an old reply read again rolls as written');
        const step = pulseHook({ state: clocked(), settings: {}, chat: { length: 5, lastUser: '' } });
        assert.equal(step.commands[0].payload.persona, 'Astra');
    } finally { setPersonaReader(null); }
});

test('pulse: the roll is a system step drawn with its seed: same seed same result, a click is refused, a swipe (new seed) rolls again', () => {
    const state = clocked();
    const one = pulseAt(state, 42);
    const two = pulseAt(state, 42);
    assert.equal(one.ok, true, one.message);
    assert.deepEqual(one.state.domains.director.pulse, two.state.domains.director.pulse);
    const [entry] = resultsOf(one.state.domains.director);
    assert.equal(entry.at, 5);
    assert.ok(entry.d20 >= 1 && entry.d20 <= 20 && ['std', 'duo'].includes(entry.table));
    assert.deepEqual(part.domains.director.validate(one.state.domains.director), []);
    const seen = new Set();
    for (let seed = 1; seed <= 60; seed += 1) seen.add(resultsOf(pulseAt(state, seed).state.domains.director)[0].d20);
    assert.ok(seen.size > 8, `fresh rolls per seed: ${seen.size} different d20s`);
    assert.equal(runCommand(state, (ctx, payload) => pulseCommand({ ...ctx, cause: 'ui' }, payload), { at: 5 }).code, 'REFUSED');
    assert.equal(runCommand(state, pulseCommand, { at: -1 }).code, 'INVALID');
    assert.equal(d20Of(0), 1);
    assert.equal(d20Of(0.999999), 20);
});

test('pulse: only the last 6 results are kept; a result for the same reply (a redo) replaces its own', () => {
    let state = clocked();
    for (let at = 1; at <= 8; at += 1) state = pulseAt(state, at, { at }).state;
    assert.deepEqual(resultsOf(state.domains.director).map(entry => entry.at), [3, 4, 5, 6, 7, 8]);
    state = pulseAt(state, 99, { at: 8 }).state;
    assert.deepEqual(resultsOf(state.domains.director).map(entry => entry.at), [3, 4, 5, 6, 7, 8]);
    assert.equal(part.domains.director.validate({ ...state.domains.director, pulse: [{ results: [...resultsOf(state.domains.director), ...resultsOf(state.domains.director)] }] }).length, 1);
    assert.equal(part.domains.director.validate({ ...state.domains.director, pulse: [{ results: [{ at: 'x' }] }] }).length, 1);
    assert.equal(part.domains.director.validate({ ...state.domains.director, pulse: null }).length, 0);
});

test('pulse: skipped (and the reason recorded) in a fight, in a quiet scene, with no clock, after a rest and after a 6-hour jump; mode off does nothing', () => {
    const state = clocked();
    const reason = result => resultsOf(result.state.domains.director).at(-1).skipped;
    assert.equal(reason(pulseAt(state, 3, { queries: { 'combat.session': () => ({ status: 'active' }) } })), 'fight');
    const quiet = runCommand(state, quietCommand, { on: true }).state;
    assert.equal(reason(pulseAt(quiet, 3)), 'quiet');
    assert.equal(runCommand(state, quietCommand, { on: 'yes' }).code, 'INVALID');
    assert.deepEqual(part.domains.director.validate(quiet.domains.director), []);
    const noClock = makeState();
    assert.equal(reason(pulseAt(noClock, 3)), 'clock');
    // After a roll, a jump of 6+ hours: skipped; a smaller one rolls.
    const first = pulseAt(state, 3, { at: 5 }).state;
    const later = hours => { const next = structuredClone(first); next.domains.director.time.minutes += hours * 60; return next; };
    assert.equal(reason(pulseAt(later(6), 3, { at: 7 })), 'jump');
    assert.equal(reason(pulseAt(later(5), 3, { at: 7 })), undefined);
    const rested = later(1);
    rested.domains.dataModules = { instances: { a: { chat: { fields: { 'rested-at': rested.domains.director.time.minutes } } } } };
    assert.equal(reason(pulseAt(rested, 3, { at: 7 })), 'rest');
    rested.domains.dataModules = { instances: { a: { chat: { fields: {} }, characters: { ann: { fields: { 'rested-at': rested.domains.director.time.minutes } } } } } };
    assert.equal(reason(pulseAt(rested, 3, { at: 7 })), 'rest', 'a character module\'s rest counts too');
    const off = pulseAt(state, 3, { settings: { mode: 'off' } });
    assert.equal(off.state.domains.director.pulse, null);
    assert.equal(modeOf({ mode: 'x' }), 'lively');
});

test('pulse: the hook asks for one step per reply written; a swipe is one below the chat length; a Continue, off and mode off ask for none', () => {
    const state = clocked();
    const view = (extra = {}) => ({ state, settings: {}, chat: { length: 5, lastUser: '' }, ...extra });
    assert.deepEqual(pulseHook(view()), { commands: [{ type: PULSE, payload: { at: 5, age: 1, reach: 3, pulse: 2, persona: '' } }] });
    assert.deepEqual(pulseHook(view({ chat: { length: 6 } }), { type: 'swipe' }), { commands: [{ type: PULSE, payload: { at: 5, age: 1, reach: 3, pulse: 2, persona: '' } }] });
    assert.ok(pulseHook(view(), { type: 'regenerate' }));
    assert.equal(pulseHook(view(), { type: 'continue', commit: false }), undefined);
    assert.equal(pulseHook(view({ feature: id => id !== 'story-director.pulse' })), undefined);
    assert.equal(pulseHook(view({ settings: { mode: 'off' } })), undefined);
    // The swipe does not stop at "the pick is made": it asks again (a fresh roll), unlike the initiative.
    const rolled = pulseAt(state, 3).state;
    assert.ok(pulseHook({ ...view({ chat: { length: 6 } }), state: rolled }, { type: 'swipe' }));
    assert.equal(pulsePart.hooks.beforeGenerate, pulseHook);
    assert.equal(pulsePart.commands[PULSE].feature, 'story-director.pulse');
    assert.equal(pulsePart.commands[PULSE].prelude, true, 'a prelude: stored on the reply, so the reply takes it back');
    assert.equal(pulsePart.context.tail, undefined);
    assert.equal(pulsePart.commands[QUIET].feature, 'story-director.pulse');
});

test('pulse: the line is the step\'s cue (narrated only when there is a line), plain, under 40 tokens, cut at a word; none on CALM or a skip', () => {
    const state = clocked();
    let shown = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
        const result = pulseAt(state, seed);
        const [entry] = resultsOf(result.state.domains.director);
        if (entry.kind === 'CALM' || !entry.text) assert.deepEqual([result.result.narrate, result.result.summary], [false, '']);
        else {
            shown += 1;
            assert.equal(result.result.narrate, true);
            assert.match(result.result.summary, /^World this reply: /);
            assert.ok(Math.ceil(result.result.summary.length / 4) <= 40);
            assert.doesNotMatch(result.result.summary, /[{}<>]/);
        }
    }
    assert.ok(shown > 5);
    assert.equal(pulseAt(runCommand(state, quietCommand, { on: true }).state, 5).result.narrate, false);
    const long = worldLine(`Snatches of talk ${'in the lower town about the grain tax '.repeat(6)}`);
    assert.ok(Math.ceil(long.length / 4) <= 40 && !/\s$/.test(long) && /\w$/.test(long) && long.endsWith("grain"), long);
});

test('pulse: quiet mode makes flavour only; lively with real people and news can write a rumour, a meeting or an agenda change', () => {
    const base = withScene(story([{ lines: [WORLD[0].lines, '+ agenda Courier — rides in | now: far north | then: reaches the gate | on: March 3, 2026, 06:00 pm'].join('\n') }], makeState()), { present: ['Elula', 'Bram', 'Orsa'] });
    const cast = { people: { ann: { name: 'Ann', alive: true, met: null, where: 'Elsewhere' } } };
    const calls = [];
    const queries = { 'chronicle.events': () => [{ id: 'ev_1', name: 'Wolf Plague', summary: 'wolves in the fold', state: 'ongoing', place: 'Harrow', factions: [] }], 'atlas.here': () => ({ name: 'Harrow', placeKind: 'town' }) };
    const call = (type, payload) => { calls.push(type); return {}; };
    const kinds = new Set();
    for (let seed = 1; seed <= 150; seed += 1) {
        const state = { ...base, domains: { ...base.domains, cast } };
        const result = runCommand(state, seededPulse(seed), { at: 5 }, { call, queries, owned: ['director'] });
        assert.equal(result.ok, true, result.message);
        const [entry] = resultsOf(result.state.domains.director);
        kinds.add(entry.kind);
        const quietRun = runCommand(state, seededPulse(seed), { at: 5 }, { settings: { mode: 'quiet' }, call: () => assert.fail('quiet mode writes no effect'), queries });
        assert.equal(resultsOf(quietRun.state.domains.director)[0].effect, undefined);
        if (entry.kind === 'TASK_SHIFT' || entry.kind === 'ENTER_CHECK') {
            const fields = Object.values(result.state.domains.director.threads).find(thread => thread.key === 'Courier').fields;
            assert.ok(entry.kind === 'ENTER_CHECK' ? fields.arrive : fields.on !== 'March 3, 2026, 06:00 pm', JSON.stringify(fields));
            assert.deepEqual(part.domains.director.validate(result.state.domains.director), []);
        }
    }
    for (const type of ['chronicle.rumor', 'cast.meet']) assert.ok(calls.includes(type), `${type} was called`);
    assert.ok(kinds.has('TASK_SHIFT') || kinds.has('ENTER_CHECK'), [...kinds].join());
});

test('pulse: chronicle.rumor writes a looming event once, refused from a click, waits for the clock', () => {
    const chronicle = { events: {}, factions: {}, seen: [], seenAt: {}, round: 0, surfaced: null, days: {}, written: null, dayFacts: {}, noted: null, questLog: {} };
    const payload = { at: 5, event: { name: 'Rumour of Plague', summary: 'coughing', place: 'Harrow', factions: [] } };
    const run = (extra = {}, body = payload) => {
        const draft = structuredClone(chronicle);
        const ctx = { cause: 'system', rev: 3, rng: () => 0.5, id: prefix => `${prefix}_abcdefgh`, time: () => 100, draft: () => draft, query: () => 100, fail: (code, message) => { throw Object.assign(new Error(message), { code }); }, ...extra };
        try { return { out: rumor(ctx, body), draft }; } catch (error) { return { code: error.code }; }
    };
    const made = run();
    assert.equal(Object.values(made.draft.events)[0].state, 'looming');
    assert.equal(Object.values(made.draft.events)[0].name, 'Rumour of Plague');
    assert.equal(run({ cause: 'ui' }).code, 'REFUSED');
    assert.equal(run({}, { at: 5, event: { name: '' } }).code, 'INVALID');
    assert.equal(run({ time: () => null, query: () => null }).code, 'NOT_YET');
});

test('pulse: agenda progress: stepAt, stepOf and stepSince follow now/then and never touch the narrator\'s `step`; where is the atlas place; old agendas are valid', () => {
    assert.deepEqual(agendaProgress(null, { now: 'the docks', then: 'sells; hides; leaves' }, { minutes: 90 }), { stepAt: '1', stepOf: '4', stepSince: '90' });
    assert.deepEqual(agendaProgress({ now: 'the docks', then: 'a', stepAt: '1', stepOf: '2' }, { now: 'the market', then: 'b', stepAt: '1', stepOf: '2' }, { minutes: 200, where: 'Market' }), { stepAt: '2', stepSince: '200', where: 'Market' });
    assert.equal(agendaProgress({ now: 'a', then: 'b' }, { now: 'a', then: 'b' }, { minutes: 5 }), null);
    const text = agendaProgress({ now: 'a', then: 'b', step: 'sneaks in' }, { now: 'c', then: 'b', step: 'sneaks in' }, {});
    assert.equal(text?.step, undefined, 'a text `step` is left alone');
    assert.equal(weatherFrom('soft rain, mild'), 'rain');
    assert.equal(weatherFrom('clear'), null);
});

test('pulse: TASK_SHIFT never moves `on` into the past; ENTER_CHECK only takes agendas that can converge and sets no place', () => {
    const format = minutes => `m${minutes}`;
    const agendas = [{ id: 'a', name: 'Courier', named: false, text: 'x', abs: 1000 }];
    for (let line = 0; line < 1; line += 0.05) {
        const made = shiftEntry({ agendas, at: 5, now: 990, format, draw: { actor: 0, line } });
        if (made) assert.ok(made.receipt.to >= 990 + 20, `${line} -> ${made.receipt.to}`);
    }
    assert.equal(shiftEntry({ agendas, at: 5, now: 2000, format, draw: { actor: 0, line: 0.1 } }), null, 'already overdue: no earlier date');
    assert.equal(shiftEntry({ agendas, at: 5, now: 2000, format, draw: { actor: 0, line: 0.9 } }).receipt.to, 1000 + 60 * (1 + Math.floor(((0.9 * 2) % 1) * 4)));
    const state = withScene(story([{ lines: [WORLD[0].lines, '+ agenda Courier — rides in | now: far north | then: reaches the gate'].join('\n') }], makeState()), { present: ['Elula', 'Bram', 'Orsa'] });
    const queries = { 'atlas.here': () => ({ name: 'Harrow', placeKind: 'town', region: 'Vale' }), 'atlas.place': ({ name }) => ({ name, region: 'Coast' }) };
    for (let seed = 1; seed <= 150; seed += 1) {
        const threads = Object.values(pulseAt(state, seed, { queries, call: () => ({}) }).state.domains.director.threads);
        assert.ok(threads.every(thread => !thread.fields.arrive && !thread.fields.where), 'a far agenda is not picked, and nobody gets a place');
    }
});

test('pulse: rumours never use pulse rumours or hidden names as facts, and leave room: a near-full chronicle gets none', () => {
    const state = withScene(story([{ lines: [WORLD[0].lines, '+ agenda Courier — rides in | now: far north'].join('\n') }], makeState()), { present: ['Elula', 'Bram', 'Orsa'] });
    const event = (id, name, extra = {}) => ({ id, name, summary: `${name} news`, state: 'ongoing', place: 'Harrow', factions: [], ...extra });
    const run = (events, seed) => {
        const types = [];
        pulseAt(state, seed, { queries: { 'chronicle.events': () => events, 'atlas.here': () => ({ name: 'Harrow', placeKind: 'town' }) }, call: (type, payload) => { types.push([type, payload]); return {}; } });
        return types.filter(([type, payload]) => type === 'chronicle.rumor' && payload.event);
    };
    const used = new Set();
    for (let seed = 1; seed <= 200; seed += 1) {
        for (const [, payload] of run([event('ev_1', 'Courier'), event('ev_2', 'Rumour of Wolves', { rumour: 'Wolves' }), event('ev_3', 'Wolf Plague')], seed)) if (payload.event) used.add(payload.event.name);
        const full = Array.from({ length: 54 }, (_, n) => event(`ev_${n}`, `Fact ${n}`));
        assert.deepEqual(run(full, seed), [], 'a near-full chronicle: the pulse writes no rumour');
    }
    assert.deepEqual([...used], ['Rumour of Wolf Plague'], 'not about a hidden agenda name, nor a rumour');
});

const PRESET = {
    std: [[1, 2, 'CALM'], [3, 4, 'ENTER_CHECK'], [5, 6, 'BACKGROUND_INCIDENT'], [7, 8, 'MOOD_SWING'], [9, 10, 'GOSSIP_SURGE'], [11, 12, 'CHANCE_MEETING'], [13, 14, 'OVERHEARD_DETAIL'], [15, 16, 'TASK_SHIFT'], [17, 18, 'MUNDANE_INTERRUPTION'], [19, 20, 'CALM']],
    duo: [[1, 2, 'CALM'], [3, 4, 'ENV_SHIFT'], [5, 6, 'MOOD_SWING'], [7, 8, 'PHYSICAL_REACTION'], [9, 10, 'MEMORY_TRIGGER'], [11, 12, 'OBJECT_DISCOVERY'], [13, 14, 'OUTSIDE_INTRUSION'], [15, 16, 'POWER_SHIFT'], [17, 18, 'MUNDANE_INTERRUPTION'], [19, 20, 'CALM']],
};

test('pulse: both tables carry exactly the preset d20 ranges, every d20 resolves to its row, and the table choice follows the counts', () => {
    for (const id of ['std', 'duo']) {
        assert.deepEqual(TABLES[id].rows.map(item => [item.from, item.to, item.kind]), PRESET[id]);
        const context = { group: 'town', weather: 'rain', counts: { present: 1, offscreen: 1, known: 1, cast: 1 } };
        for (const [from, to, kind] of PRESET[id]) for (let roll = from; roll <= to; roll += 1) assert.equal(resolveKind(id, roll, context).kind, kind, `${id} ${roll}`);
    }
    assert.equal(tableFor({ named: 3, offscreen: 1 }), 'std');
    assert.equal(tableFor({ named: 2, offscreen: 5 }), 'duo');
    assert.equal(tableFor({ named: 6, offscreen: 0 }), 'duo');
});

test('pulse: in quiet mode an effect entry reads as its flavour fallback and keeps its band', () => {
    assert.deepEqual(Object.keys(QUIET_FALLBACK).sort(), ['CHANCE_MEETING', 'ENTER_CHECK', 'GOSSIP_SURGE', 'OVERHEARD_DETAIL', 'TASK_SHIFT']);
    const state = clocked();
    for (let seed = 1; seed <= 60; seed += 1) {
        const entry = resultsOf(pulseAt(state, seed, { settings: { mode: 'quiet' } }).state.domains.director)[0];
        assert.ok(!Object.keys(QUIET_FALLBACK).includes(entry.kind), `${seed} ${entry.kind}`);
        assert.equal(entry.effect, undefined);
        const band = PRESET[entry.table].find(([from, to]) => entry.d20 >= from && entry.d20 <= to)[2];
        // (Duo's ENV_SHIFT may step down when the scene has no weather line; the effect bands' fallbacks always have lines.)
        if (QUIET_FALLBACK[band]) assert.equal(entry.kind, QUIET_FALLBACK[band], `${seed} d20 ${entry.d20}`);
        else if (entry.table === 'std') assert.equal(entry.kind, band, `${seed} d20 ${entry.d20}`);
    }
});

test('chance meeting: a step recorded before the reach rule (no `reach`) replays as the goal meeting it was; a new one met by place when already there', () => {
    const cast = { people: { 'ersveil:rika': { name: 'Rika', alive: true, met: null } } };
    const old = meetEntry({ cast, at: 4, place: 'Bluewatch Village', draw: { actor: 0.1 } });
    assert.deepEqual(old.payload.who, [{ key: 'ersveil:rika', why: 'goal', reason: 'chance meeting', place: 'Bluewatch Village' }]);
    assert.deepEqual(meetEntry({ cast, at: 4, place: 'Bluewatch Village', draw: { actor: 0.1 }, here: new Set(['ersveil:rika']) }).payload.who, [{ key: 'ersveil:rika', why: 'place', reason: '' }]);
    assert.equal(meetEntry({ cast: { people: {} }, at: 4, place: 'Bluewatch Village', here: new Set() }), null, 'nobody who can be here: the roll steps down');
});

// ---- World pulse step version 2: intensity, the narrator brief, recent memory, wider fallback lines ----

const V2 = { age: 1, reach: 3, pulse: 2 };
const pulseChain = (state, seeds, { settings = {}, payload = V2 } = {}) => {
    let current = state;
    for (let at = 1; at <= seeds; at += 1) current = pulseAt(current, at * 7 + 3, { at, settings, payload }).state;
    return resultsOf(current.domains.director);
};

test('pulse v2: intensity is about 1 in 5 intrusive, mostly around/noticed, and never two intrusive in a row', () => {
    const counts = { around: 0, noticed: 0, intrusive: 0 };
    for (let i = 0; i < 1000; i += 1) counts[intensityOf(i / 1000)] += 1;
    assert.deepEqual(INTENSITIES, ['around', 'noticed', 'intrusive']);
    assert.ok(counts.intrusive >= 150 && counts.intrusive <= 250, `intrusive share ${counts.intrusive}`);
    assert.ok(counts.around + counts.noticed >= 750);
    for (let i = 0; i < 1000; i += 1) assert.notEqual(intensityOf(i / 1000, 'intrusive'), 'intrusive');
    assert.equal(intensityOf(0.001), 'intrusive');
});

test('pulse v2: a roll gives a brief for the narrator (kind, intensity, place group, the guide, recent pulses); invents off gives the fixed line; a v1 step gives no intensity', () => {
    const state = clocked();
    const on = pulseChain(state, 12).filter(entry => entry.invent);
    assert.ok(on.length > 0, 'some briefs');
    for (const entry of on) {
        assert.ok(INTENSITIES.includes(entry.intensity));
        assert.match(entry.brief, /^\[[a-z ]+, (around|noticed|intrusive), [a-z]+\] invent ONE small plausible thing/);
        assert.match(worldLine(entry.brief, 330), /^World this reply: \[/);
        assert.ok(entry.brief.length <= 330);
        assert.match(entry.text, /^[a-z ]+ \((around|noticed|intrusive)\): the narrator invents it$/);
        assert.ok(!/invent ONE/.test(entry.text), 'the display text never holds the brief');
    }
    assert.match(on.at(-1).brief, /not like: |no repeats/);
    const off = pulseChain(state, 12, { settings: { invents: false } });
    assert.ok(off.every(entry => !entry.invent && !/invent ONE/.test(entry.text)), 'fixed lines when the switch is off');
    assert.ok(off.some(entry => entry.text), 'fixed lines have text');
    assert.ok(pulseTexts(state, 60).every(entry => entry.intensity === undefined && !entry.invent), 'a step without the version flag rolls as before');
});

test('pulse v2: never the same kind twice in a row, intensity never intrusive twice; the brief lists the last three', () => {
    for (const settings of [{}, { mode: 'quiet' }]) {
        const results = pulseChain(clocked(), 40, { settings });
        for (let i = 1; i < results.length; i += 1) {
            if (results[i].kind !== 'CALM') assert.notEqual(results[i].kind, results[i - 1].kind, `repeat at ${i}`);
            assert.ok(!(results[i].intensity === 'intrusive' && results[i - 1].intensity === 'intrusive'), `double intrusive at ${i}`);
        }
    }
    assert.match(briefFor({ kind: 'MOOD_SWING', intensity: 'noticed', group: 'town', name: 'Elula', recent: [{ kind: 'A_B', intensity: 'around' }, { kind: 'C', intensity: 'intrusive' }] }), /\(Elula may figure\).*not like: around a b, intrusive c$/);
    assert.ok(!/[{}<>]/.test(briefFor({ kind: 'CALM', name: '{x}<b>' })));
});

test('pulse v2: the fallback has more lines per kind and group, quiet mode spreads over other kinds, and v1 keeps the short list', () => {
    for (const kind of ['BACKGROUND_INCIDENT', 'MUNDANE_INTERRUPTION', 'MOOD_SWING', 'PHYSICAL_REACTION', 'OBJECT_DISCOVERY', 'OUTSIDE_INTRUSION', 'MEMORY_TRIGGER', 'POWER_SHIFT']) {
        for (const group of ['wild', 'town', 'indoors', 'road', 'water']) {
            assert.equal(flavourLines(kind, group, null, false).length, 1);
            const wide = flavourLines(kind, group, null, true);
            assert.ok(wide.length >= 5, `${kind}/${group}`);
            assert.equal(new Set(wide).size, wide.length);
            for (const text of wide) assert.ok(text.replace('{place}', 'Harrow').replace('{name}', 'Elula').length <= 128 && !/[<>]/.test(text), text);
        }
    }
    assert.equal(new Set(Object.values(QUIET_SPREAD)).size, 5);
    const quiet = pulseChain(clocked(), 60, { settings: { mode: 'quiet', invents: false } });
    assert.ok(new Set(quiet.map(entry => entry.kind)).size >= 5, 'quiet pulses spread over kinds');
});

test('pulse v2: the invents switch is a setting, default on; the hook marks new steps as version 2', () => {
    assert.equal(pulsePart.settings.defaults.invents, true);
    assert.equal(pulsePart.settings.schema.invents.label, 'Pulse invents events (model)');
    assert.equal(pulseHook({ state: clocked(), settings: {}, chat: { length: 5, lastUser: '' } }).commands[0].payload.pulse, 2);
});

test('pulse v2: an invent entry shows a display text (no narrator brief) on the Director card and the under-reply row; the note carries the brief', async () => {
    const { createScreensPart } = await import('../../../src/v2/screens/index.js');
    const state = clocked();
    const stepped = pulseAt(state, 11, { settings: { mode: 'lively' }, payload: V2 });
    const entry = resultsOf(stepped.state.domains.director).find(item => item.invent) ?? pulseChain(state, 12).find(item => item.invent);
    assert.ok(entry, 'an invent entry');
    const view = createScreensPart({ settings: { 'pulse.mode': 'lively', 'pulse.showUnderReply': true } }).queries['pulse.view'](stepped.state, {}, {});
    for (const row of [view.now, ...view.recent].filter(Boolean)) assert.ok(!/invent ONE/.test(row.text ?? ''), `row text: ${row.text}`);
    assert.ok(/invent ONE/.test(worldLine(entry.brief, 330)));
});

test('pulse v2: quiet mode when the spread kind is the last kind steps down (blocked, retried) without a repeat, a throw or an empty entry', () => {
    for (let seed = 1; seed <= 150; seed += 1) {
        const first = pulseAt(clocked(), seed, { settings: { mode: 'quiet' }, payload: V2 });
        assert.equal(first.ok, true, first.message);
        const second = pulseAt(first.state, seed + 500, { at: 6, settings: { mode: 'quiet' }, payload: V2 });
        assert.equal(second.ok, true, second.message);
        const [a, b] = resultsOf(second.state.domains.director).slice(-2);
        assert.ok(b && typeof b.kind === 'string');
        if (b.kind !== 'CALM') assert.notEqual(b.kind, a.kind, `repeat at seed ${seed}`);
    }
});
