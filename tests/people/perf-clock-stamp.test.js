import test from 'node:test';
import assert from 'node:assert/strict';
import { createTimelinePart } from '../../modules/people/adapter/timeline.js';
import { NPC_KIND, MILESTONE_KIND } from '../../modules/people/meters/npc-meters.js';

// The story clock is read once per task (or until a host event), not once per ask: counts of host queries, never timings.
const CALENDAR = { era: 'AR', months: [{ name: 'Thaw', days: 28 }], leapYears: false };
const kind = { grammar: '', heads: [], after: [], apply: () => {} };

function build({ withOn = true } = {}) {
    const counts = { time: 0, calendar: 0 };
    const handlers = new Map();
    let minutes = 600;
    const sdk = {
        query: name => {
            if (name === 'director.time') { counts.time += 1; return { minutes }; }
            counts.calendar += 1;
            return CALENDAR;
        },
        ...(withOn ? { on: (name, fn) => { handlers.set(name, fn); return () => handlers.delete(name); } } : {}),
    };
    const session = { hosted: true, sdkRef: sdk };
    const part = {
        features: {}, commands: { 'npc.milestone': () => {} }, kinds: { [NPC_KIND]: kind, [MILESTONE_KIND]: kind },
        context: {}, settings: { defaults: {}, schema: {} }, defs: () => [], redact: text => text,
    };
    const deps = { runtime: () => null, queries: {}, enabled: () => true, version: '1', settleMs: 1, settlePollMs: 1, warn() {}, notifyChange() {} };
    const timeline = createTimelinePart(session, { ...deps, part });
    return { timeline, counts, handlers, setMinutes: value => { minutes = value; } };
}

test('a hundred clock reads in one task cost one pair of host queries', () => {
    const { timeline, counts } = build();
    for (let i = 0; i < 100; i += 1) assert.equal(timeline.storyClock().minutes, 600);
    assert.deepEqual(counts, { time: 1, calendar: 1 });
});

test('each host event drops the kept clock, so a moved clock is read again', () => {
    const { timeline, counts, handlers, setMinutes } = build();
    assert.equal(timeline.storyClock().minutes, 600);
    setMinutes(900);
    assert.equal(timeline.storyClock().minutes, 600);   // nothing announced: still the one read
    let expected = 1;
    for (const name of ['committed', 'head', 'turn', 'feature', 'modules']) {
        setMinutes(900 + expected);
        handlers.get(name)();
        assert.equal(timeline.storyClock().minutes, 900 + expected, name);
        expected += 1;
        assert.equal(counts.time, expected, name);
    }
});

test('the next task asks again (a settings edit sends no host event)', async () => {
    const { timeline, counts, setMinutes } = build();
    timeline.storyClock();
    setMinutes(777);
    await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(timeline.storyClock().minutes, 777);
    assert.equal(counts.time, 2);
});

test('a caller changing the answer cannot change the kept clock', () => {
    const { timeline } = build();
    const first = timeline.storyClock();
    first.calendar.months.push({ name: 'x', days: 1 });
    first.minutes = 1;
    assert.equal(timeline.storyClock().calendar.months.length, 1);
    assert.equal(timeline.storyClock().minutes, 600);
});

test('a host with no events keeps nothing: every ask reads', () => {
    const { timeline, counts } = build({ withOn: false });
    for (let i = 0; i < 3; i += 1) timeline.storyClock();
    assert.deepEqual(counts, { time: 3, calendar: 3 });
});
