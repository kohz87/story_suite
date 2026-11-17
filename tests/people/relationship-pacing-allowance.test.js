import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_ID } from '../../modules/people/storysuite-v2.js';
import { validateNpcSlice } from '../../modules/people/meters/npc-meters.js';
import { DEFAULT_RELATIONSHIP_CAPS, normalizeNpcRecord } from '../../modules/people/core/core.js';
import { applyFocusedRelationshipDecisions } from '../../modules/people/legacy/relationship-pass.js';
import { DEFAULT_IMPACT_CRITERIA } from '../../modules/people/core/core-prompts-criteria.js';
import { DEFAULT_ALLOWANCE, flatDayProblems, fromFlatDay, impactDayProblems, toFlatDay, normalizeAllowance, pacingDefaults, spendEvent, spendFlatEvent } from '../../modules/people/legacy/relationship-pacing.js';
import { cutToTier, eventSummary, pacingNote, readEvent } from '../../modules/people/meters/npc-meters-pacing.js';
import { DAY, dossiers, suite, major } from './helpers/pacing-suite.js';
import { TEMIWA } from './relationship-pacing.helpers.js';

test('the allowance setting: a blank field is no limit (null), a missing one is the default, 0 is none, 0..99 whole numbers', () => {
    assert.deepEqual(normalizeAllowance(undefined), { ordinary: 3, meaningful: 1, major: 1, extreme: 1 });
    assert.deepEqual(normalizeAllowance({ ordinary: null, meaningful: '', major: 0, extreme: 250 }), { ordinary: null, meaningful: null, major: 0, extreme: 99 });
    assert.deepEqual(normalizeAllowance({ ordinary: '2.6', meaningful: 'x', major: -4 }), { ordinary: 3, meaningful: 1, major: 0, extreme: 1 });
});

test('the used tier: down the chain extreme > major > meaningful > ordinary, none left means nothing', () => {
    const allowance = normalizeAllowance();
    let record;
    const event = (tier, reply = `r${Math.random()}`) => {
        const out = spendEvent(record, { tier, reply, clockDay: 5, allowance });
        record = out.next ?? record;
        return out;
    };
    assert.equal(event('extreme').used, 'extreme');
    assert.equal(event('extreme').used, 'major', 'extreme is used up: the next one is a major');
    assert.equal(event('extreme').used, 'meaningful');
    assert.equal(event('major').used, 'ordinary');
    assert.equal(event('meaningful').used, 'ordinary');
    assert.equal(event('ordinary').used, 'ordinary');
    const none = event('extreme');
    assert.equal(none.used, null, 'every tier is used: ignored');
    assert.deepEqual(none.skipped, ['ordinary', 'meaningful', 'major', 'extreme']);
    assert.equal(pacingNote('major', null, ['ordinary', 'meaningful', 'major']), "today's ordinary, meaningful and major are used");
    assert.equal(pacingNote('major', 'meaningful', ['major']), "major counted as meaningful: today's major is used");
    assert.equal(pacingNote('major', 'major', []), '');
});

test('blank is no limit, 0 is none of that tier, a new story day starts again, an unknown tier or no clock is not paced', () => {
    const free = normalizeAllowance({ major: null });
    let record;
    for (let n = 0; n < 5; n += 1) {
        const out = spendEvent(record, { tier: 'major', reply: `a${n}`, clockDay: 1, allowance: free });
        assert.equal(out.used, 'major');
        record = out.next;
    }
    assert.equal(spendEvent(undefined, { tier: 'major', reply: 'z', clockDay: 1, allowance: normalizeAllowance({ major: 0 }) }).used, 'meaningful', '0 means none: counted as meaningful');
    const day1 = spendEvent(undefined, { tier: 'major', reply: 'a', clockDay: 1, allowance: normalizeAllowance() });
    assert.equal(spendEvent(day1.next, { tier: 'major', reply: 'b', clockDay: 1, allowance: normalizeAllowance() }).used, 'meaningful');
    assert.equal(spendEvent(day1.next, { tier: 'major', reply: 'b', clockDay: 2, allowance: normalizeAllowance() }).used, 'major', 'tomorrow the major is back');
    assert.deepEqual(spendEvent(day1.next, { tier: 'major', reply: 'b', clockDay: null, allowance: normalizeAllowance() }), { used: 'major', next: null, skipped: [] }, 'no clock: no limit, nothing counted');
    assert.equal(spendEvent(day1.next, { tier: 'nonsense', reply: 'b', clockDay: 1, allowance: normalizeAllowance() }).used, null);
    const full = { day: 1, reply: 'a', ordinary: 1000, meaningful: 0, major: 0, extreme: 0 };
    const unlimited = spendEvent(full, { tier: 'ordinary', reply: 'b', clockDay: 1, allowance: normalizeAllowance({ ordinary: null }) });
    assert.equal(unlimited.next.ordinary, 1000, 'an unlimited tier remains valid after a thousand events');
    assert.deepEqual(impactDayProblems(unlimited.next), []);
    assert.equal(spendEvent(unlimited.next, { tier: 'ordinary', reply: 'c', clockDay: 1, allowance: normalizeAllowance({ ordinary: 99 }) }).used, null);
});

test('one reply keeps the day it started on: a later event of it never reads the clock again', () => {
    const allowance = normalizeAllowance();
    const first = spendEvent(undefined, { tier: 'major', reply: 'r1', clockDay: 4, allowance });
    const later = spendEvent(first.next, { tier: 'major', reply: 'r1', clockDay: 5, allowance });
    assert.equal(later.used, 'meaningful', 'the clock crossed midnight inside the reply: still the day it started on');
    assert.equal(later.next.day, 4);
});

test('a downgraded move is cut to the used tier\'s points and stops on a gate that needs a higher tier', () => {
    const caps = { ordinary: 1, meaningful: 2, major: 3, extreme: 6 };
    const at = { trust: 49, affection: 10, desire: 0 };
    const cut = cutToTier([{ meter: 'trust', value: 3 }, { meter: 'affection', value: 5 }, { meter: 'desire', value: -4 }], 'meaningful', caps, id => at[id]);
    assert.deepEqual(cut.map(change => change.value), [1, 2, -2], 'trust 49 stops on the gate at 50 (it needs a major); the others are held to 2');
    assert.deepEqual(cutToTier([{ meter: 'trust', value: 3 }], 'major', caps, () => 49).map(change => change.value), [3], 'a major may cross 50');
    assert.deepEqual(cutToTier([{ meter: 'loyalty', value: 3 }], 'meaningful', caps, () => 49).map(change => change.value), [2], 'custom meters have the tier cap, not relationship gates');
    const flat = toFlatDay({ day: 3, reply: 'a', ordinary: 1, meaningful: 0, major: 0, extreme: 0 });
    assert.deepEqual(flat, { reply: 'a', 'd3:ordinary': 1, 'd3:meaningful': 0, 'd3:major': 0, 'd3:extreme': 0 });
    assert.deepEqual(fromFlatDay(flat, 3), { day: 3, reply: 'a', ordinary: 1, meaningful: 0, major: 0, extreme: 0 });
    const leftovers = { reply: 'b', 'd2:ordinary': 3, 'd4:meaningful': 1 };
    assert.deepEqual(fromFlatDay(leftovers, 4), { day: 4, reply: 'b', ordinary: 0, meaningful: 1, major: 0, extreme: 0 }, 'only the day asked for is read; a missing key is zero');
    assert.deepEqual(fromFlatDay(leftovers, 2), { day: 2, reply: 'b', ordinary: 3, meaningful: 0, major: 0, extreme: 0 }, 'an older day is read when the clock is on it: never "the newest day"');
    assert.equal(fromFlatDay(leftovers, 9).ordinary + fromFlatDay(leftovers, 9).meaningful, 0, 'a day with no keys counts nothing, whatever other days hold');
    assert.equal(fromFlatDay(leftovers, null), null);
    assert.deepEqual(flatDayProblems(flat), []);
    assert.ok(flatDayProblems({ reply: 'a', 'd3:major': -1, day: 3 }).length >= 2);
    assert.deepEqual(fromFlatDay({ reply: 'a' }, 3), { day: 3, reply: 'a', ordinary: 0, meaningful: 0, major: 0, extreme: 0 });
    // A write stores the current day's four keys only: every other day's key the record held is dropped with it.
    const written = spendFlatEvent({ reply: 'a', 'd9:major': 1, 'd2:ordinary': 2 }, { tier: 'major', reply: 'b', clockDay: 5, allowance: normalizeAllowance() });
    assert.deepEqual(written.next, { reply: 'b', 'd5:ordinary': 0, 'd5:meaningful': 0, 'd5:major': 1, 'd5:extreme': 0 });
    assert.equal(written.used, 'major', 'day 9\'s major (a clock that went back, or a leftover) does not count on day 5');
    assert.deepEqual(impactDayProblems({ day: 3, reply: 'a', ordinary: 1, meaningful: 0, major: 0, extreme: 0 }), []);
    assert.ok(impactDayProblems({ day: 3, reply: 'a', ordinary: -1, meaningful: 0, major: 0, extreme: 0, sneaky: 1 }).length >= 2);
});

// ---- settings ----

test('the defaults: points 1 / 2 / 3 / 6; a saved 1 / 2 / 5 / 10 moves once, any other saved set is the reader\'s', () => {
    assert.deepEqual({ ...DEFAULT_RELATIONSHIP_CAPS }, { ordinary: 1, meaningful: 2, major: 3, extreme: 6 });
    assert.deepEqual(DEFAULT_ALLOWANCE, { ordinary: 3, meaningful: 1, major: 1, extreme: 1 });
    assert.deepEqual(pacingDefaults({ relationshipCaps: { ordinary: 1, meaningful: 2, major: 5, extreme: 10 } }).caps, { ordinary: 1, meaningful: 2, major: 3, extreme: 6 });
    assert.deepEqual(pacingDefaults({ relationshipCaps: { ordinary: 1, meaningful: 2, major: 4, extreme: 10 } }).caps, { ordinary: 1, meaningful: 2, major: 4, extreme: 10 }, 'a value the reader chose stays');
    assert.deepEqual(pacingDefaults({ relationshipPacingMigrated: true, relationshipCaps: { ordinary: 1, meaningful: 2, major: 5, extreme: 10 } }).caps, { ordinary: 1, meaningful: 2, major: 5, extreme: 10 }, 'a later deliberate 1 / 2 / 5 / 10 stays');
    assert.equal(pacingDefaults({ relationshipImpactCriteria: 'my own words' }).impactCriteria, 'my own words');
    assert.equal(pacingDefaults({}).impactCriteria, DEFAULT_IMPACT_CRITERIA);
});

// ---- on the story's slice ----


test('two majors on one story day: the second counts as meaningful, then ordinary, and the receipt says so', async () => {
    const s = await suite();
    await s.setDay(3);
    await s.say([major()]);
    assert.equal(s.npc('Oren').meters.trust, 3, 'the first major is worth 3');
    await s.say([major()]);
    assert.equal(s.npc('Oren').meters.trust, 5, 'the second counts as meaningful: +2');
    assert.match(JSON.stringify(s.host.store.receipts()), /Oren: trust 3 → 5 \(major counted as meaningful: today's major is used on [^)]*\)/);
    await s.say([major()]);
    assert.equal(s.npc('Oren').meters.trust, 6, 'then ordinary: +1');
    await s.say([major()]);
    await s.say([major()]);
    assert.equal(s.npc('Oren').meters.trust, 8, 'ordinary is allowed three times a day');
    await s.say([major()]);
    assert.equal(s.npc('Oren').meters.trust, 8, 'nothing is left: ignored');
    assert.match(JSON.stringify(s.host.store.receipts()), /Oren: nothing changed \(today's ordinary, meaningful and major are used on [^)]*\)/);
    assert.deepEqual(validateNpcSlice(s.host.head().domains.people?.bonds ?? { npcs: {}, problems: [] }), []);
    await s.setDay(4);
    await s.say([major()]);
    assert.equal(s.npc('Oren').meters.trust, 11, 'a new story day brings the allowance back');
});

test('one line naming three meters is one event; a different person has their own allowance', async () => {
    const s = await suite();
    await s.setDay(1);
    await s.say(['~ npc Oren | trust: +9 | affection: +9 | desire: +9 | impact: major']);
    const first = s.npc('Oren').meters;
    assert.deepEqual([first.trust, first.affection, first.desire], [3, 3, 3]);
    assert.equal(s.day('oren').major, 1, 'one major was counted, not three');
    await s.say([major('Sister Temiwa')]);
    assert.equal(s.npc('Sister Temiwa').meters.trust, 3, 'Temiwa\'s major is her own');
});

test('an event down the chain counts on the story day in effect when it arrives: a time line inside the reply (the day rule)', async () => {
    const s = await suite();
    await s.setDay(2);
    const index = await s.say([major()]);
    await s.setDay(3);   // midnight passes inside the same reply, before Delta's own change for it arrives
    await s.adapter.adjust({ name: 'Oren', meters: { affection: 2 }, reply: index, impact: 'major' });   // (a meter the line moved is the line's: yieldToStory)
    assert.equal(s.day('oren').day, 3, 'the day in effect at the change, not the one before the reply');
    assert.equal(s.day('oren').major, 1, 'a new day: the forwarded major is counted as a major');
});

test('time set in the reply puts its NPC lines and a scanner-only event on the new day (the day rule)', async () => {
    const s = await suite();
    await s.setDay(2);
    await s.say([major()]);
    const index = await s.say([`~ date ${3 * DAY}`, major(), major('Sister Temiwa')]);
    assert.equal(s.npc('Oren').meters.trust, 6, 'the new day takes its own major');
    assert.equal(s.day('oren').day, 3);
    assert.equal(s.day('temiwa').day, 3);
    assert.equal((await s.host.sdk.reread(index)).ok, true);
    assert.equal(s.day('oren').day, 3, 'a Re-read keeps the rule its first read used (the receipt carries it)');
    assert.equal(s.npc('Oren').meters.trust, 6);

    const t = await suite();
    await t.setDay(2);
    await t.say([major()]);
    const scanReply = await t.say([`~ date ${3 * DAY}`]);
    await t.adapter.adjust({ name: 'Oren', meters: { affection: 3 }, reply: scanReply, impact: 'major' });
    assert.equal(t.npc('Oren').meters.affection, 3, 'the scanner change counts on the new day: a major');
    assert.equal(t.day('oren').day, 3);
    await t.say([major()]);
    assert.equal(t.day('oren').day, 3, 'the following reply uses the advanced clock');
});

test('a forwarded scanner change shares the allowance with the story line, counts one event for all its meters, and is cut to the used tier', async () => {
    const s = await suite();
    await s.setDay(7);
    await s.say([major()]);   // today's major is used
    const index = await s.say();
    const out = await s.adapter.adjust({ name: 'Oren', meters: { trust: 3, affection: 3 }, start: { trust: 3, affection: 0, desire: 0, tension: 0 }, reply: index, impact: 'major' });
    assert.ok(out, 'the change was sent');
    const meters = s.npc('Oren').meters;
    assert.deepEqual([meters.trust, meters.affection], [5, 2], 'a major counted as meaningful: each meter at most 2');
    assert.equal(s.day('oren').meaningful, 1, 'one event, not one per meter');
    assert.match(JSON.stringify(s.host.store.receipts()), /major counted as meaningful/);
    // The same tier with room is applied as the scanner worked it out (no second weighing of the inertia).
    await s.setDay(8);
    const next = await s.say();
    await s.adapter.adjust({ name: 'Oren', meters: { desire: 1 }, reply: next, impact: 'ordinary' });
    assert.equal(s.npc('Oren').meters.desire, 1);
    const y = await suite(); await y.setDay(9); const reply = await y.say([major()]);
    await y.adapter.adjust({ name: 'Oren', meters: { trust: 3 }, reply, impact: 'major' });
    assert.equal(y.day('oren').meaningful, 0, 'a fully yielded event spends nothing');
    await y.adapter.adjust({ name: 'Oren', meters: { trust: 3, affection: 3 }, reply, impact: 'major' }); assert.equal(y.day('oren').meaningful, 1, 'the surviving meter spends one event');
});

test('rule NSDFOLLOW-3: a forwarded scanner change carries the scanner\'s reason onto the reply\'s last event (as a story line\'s); none given keeps none; rebuild equals live', async () => {
    const s = await suite();
    await s.setDay(7);
    const index = await s.say();
    await s.adapter.adjust({ name: 'Oren', meters: { trust: 2 }, reply: index, impact: 'meaningful', reason: 'Astra kept the quay inspector off her back' });
    const event = () => eventSummary(readEvent(s.host.head().domains.people.bonds.npcs.npc_oren.lastEvent));
    assert.equal(event().why, 'Astra kept the quay inspector off her back');
    const next = await s.say();
    await s.adapter.adjust({ name: 'Oren', meters: { affection: 1 }, reply: next, impact: 'ordinary' });
    assert.equal(event().why, undefined, 'a change with no reason keeps none');
    const live = JSON.stringify(s.host.head().domains.people?.bonds);
    s.host.store.rebuild();
    assert.equal(JSON.stringify(s.host.head().domains.people?.bonds), live, 'rebuild equals live');
});

test('an adjust with no tier, a reader\'s edit and an unknown tier are never held and never counted', async () => {
    const s = await suite();
    await s.setDay(1);
    await s.say([major()]);
    await s.say([major()]);
    const before = JSON.stringify(s.day('oren'));
    const index = await s.say();
    await s.adapter.adjust({ name: 'Oren', meters: { trust: 7 }, reply: index });
    assert.equal(s.npc('Oren').meters.trust, 12, 'no tier: as before (3 + 2 + 7)');
    await s.adapter.adjust({ name: 'Oren', meters: { trust: 2 }, reply: index, impact: 'sideways' });
    assert.equal(s.npc('Oren').meters.trust, 14, 'an unknown tier is no tier');
    await s.host.sdk.command('npc.set', { name: 'Oren', meters: { trust: 40 } });
    assert.equal(s.npc('Oren').meters.trust, 40, 'the reader\'s own value is not held');
    assert.equal(JSON.stringify(s.day('oren')), before, 'none of those counted');
});

test('a downgraded major cannot cross a gate that needs a major', async () => {
    const records = dossiers();
    records.npc_oren.relationship.trust = 49;
    const s = await suite({ records });
    await s.setDay(1);
    await s.say([major()]);
    assert.ok(s.npc('Oren').meters.trust >= 50, 'the first major crosses 50');
    const low = dossiers();
    low.npc_oren.relationship.trust = 49;
    const t = await suite({ records: low, allowance: { major: 0 } });
    await t.setDay(1);
    await t.say([major()]);
    assert.equal(t.npc('Oren').meters.trust, 50, 'with no major today the move counts as meaningful and stops on the gate');
});

test('no story clock, or the calendar kept in Delta: no limit and nothing counted', async () => {
    const free = await suite({ clock: false });
    for (let n = 0; n < 3; n += 1) await free.say([major()]);
    assert.equal(free.npc('Oren').meters.trust, 9);
    assert.equal(free.day('oren'), undefined);
    const own = await suite({ calendarOwn: true });
    await own.setDay(1);
    for (let n = 0; n < 3; n += 1) await own.say([major()]);
    assert.equal(own.npc('Oren').meters.trust, 9);
    assert.equal(own.day('oren'), undefined);
    const blank = await suite({ allowance: { major: null, ordinary: null } });
    await blank.setDay(1);
    for (let n = 0; n < 3; n += 1) await blank.say([major()]);
    assert.equal(blank.npc('Oren').meters.trust, 9, 'blank is no limit');
});

test('the prompt line gives each tier its meaning, and no number or allowance', async () => {
    const s = await suite();
    const line = s.host.registry.module(MODULE_ID).context.static();
    assert.match(line, /impact is one word for the whole line: ordinary \(a kind word, most moments\) \| meaningful \(a real favour, a shared secret\) \| major \(saved from danger, a betrayal\) \| extreme/);
    assert.doesNotMatch(line, /major a day|at most|each person can have/, 'the allowance is enforced by code, not taught (G2)');
});

test('swipe, regenerate and a rebuild give the same numbers and the same count; a swipe recounts instead of adding', async () => {
    const s = await suite();
    await s.setDay(2);
    await s.say([major()]);
    const shape = () => JSON.stringify([s.npc('Oren').meters, { ...s.day('oren'), reply: 'the reply' }]);
    const live = shape();
    await s.swipe([major()]);
    assert.equal(shape(), live, 'the swipe\'s major is again the day\'s first one');
    const head = JSON.stringify(s.host.head());
    s.host.store.rebuild();
    assert.equal(JSON.stringify(s.host.head()), head, 'replay equals live');
});

test('no drift: while hosted the numbers Delta shows are the slice\'s, also after a held event', async () => {
    const s = await suite();
    await s.setDay(1);
    await s.say([major()]);
    const index = await s.say();
    await s.adapter.adjust({ name: 'Oren', meters: { trust: 3 }, start: { trust: 3, affection: 0, desire: 0, tension: 0 }, reply: index, impact: 'major' });
    const stored = [{ id: 'npc_oren', name: 'Oren', aliases: [], relationship: { trust: 6, affection: 0, desire: 0, tension: 0 } }];   // what Delta's own scan stored (the full major)
    const shown = s.adapter.sliceView(stored)[0].relationship;
    assert.equal(shown.trust, s.npc('Oren').meters.trust, 'the view reads the slice (5), not the sidecar\'s 6');
    assert.equal(shown.trust, 5);
});

// ---- Delta alone: the pass counts on the dossier ----

test('the pass without a host counts on the dossier: the second major of a day counts as meaningful; no day, no limit', () => {
    const mira = () => normalizeNpcRecord({ id: 'npc_mira', name: 'Mira', present: true, relationship: { trust: 0, affection: 0, desire: 0, tension: 0 } });
    const deeds = ['Ari pulled her out of the burning granary at dawn.', 'Mira handed Ari the key to the sealed cellar and told him where it leads.', 'Ari stood between Mira and the tax collector in the market square.'];
    let deed = 0;
    const decision = id => {
        const text = deeds[deed++ % deeds.length];
        return new Map([[id, {
            relationshipImpact: 'major', relationshipDelta: { trust: 9, affection: 0, desire: 0, tension: 0 },
            relationshipEvidence: { trust: text, affection: '', desire: '', tension: '' },
            relationshipChangeReason: text,
        }]]);
    };
    const pace = { allowance: normalizeAllowance(), day: 4 };
    const state = { turn: 1, npcs: [mira()] };
    applyFocusedRelationshipDecisions(state, decision('npc_mira'), undefined, 10, null, pace);
    assert.equal(state.npcs[0].relationship.trust, 3);
    assert.equal(state.npcs[0].impactDay.major, 1);
    applyFocusedRelationshipDecisions(state, decision('npc_mira'), undefined, 11, null, pace);
    assert.equal(state.npcs[0].relationship.trust, 5, 'the second major counts as meaningful');
    assert.deepEqual(impactDayProblems(state.npcs[0].impactDay), []);
    assert.deepEqual(impactDayProblems(normalizeNpcRecord(state.npcs[0]).impactDay), [], 'the dossier keeps the count through its normalizer');
    const free = { turn: 1, npcs: [mira()] };
    for (const at of [10, 11, 12]) applyFocusedRelationshipDecisions(free, decision('npc_mira'), undefined, at, null, { allowance: normalizeAllowance(), day: null });
    assert.equal(free.npcs[0].relationship.trust, 9, 'no story day: no limit');
    assert.equal(free.npcs[0].impactDay, undefined);
});

// ---- the owner's chat, as numbers: Sister Temiwa ----


test('the recorded start-of-reply days pace Sister Temiwa to 13 / 12 / 5 (it was 41 / 43 / 35)', async () => {
    const s = await suite();
    let at = -1;
    for (const [, day, tier, asks] of TEMIWA) {
        if (day !== at) { await s.setDay(day); at = day; }
        const parts = Object.entries(asks).map(([meter, value]) => `${meter}: ${value >= 0 ? '+' : ''}${value}`);
        await s.say([`~ npc Sister Temiwa | ${parts.join(' | ')} | impact: ${tier}`]);
    }
    const { trust, affection, desire } = s.npc('Sister Temiwa').meters;
    // The recorded clock is on the same day at the start of the first 14 lines; the 14th advances it
    // to the next day, so the 15th is the first line to use a fresh allowance.
    assert.deepEqual([trust, affection, desire], [13, 12, 5]);
    assert.ok(Math.abs(trust - 15) <= 2 && Math.abs(affection - 13) <= 2 && Math.abs(desire - 6) <= 2);
    assert.deepEqual(validateNpcSlice(s.host.head().domains.people?.bonds ?? { npcs: {}, problems: [] }), []);
});
