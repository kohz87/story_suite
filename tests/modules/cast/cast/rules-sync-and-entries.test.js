import test from 'node:test';
import assert from 'node:assert/strict';

import { applyAdvance, applyMeet, applySync, planSync, syncEmpty, syncPayload, whyNarrator, whyText } from '../../../../modules/cast/cast/apply.js';
import { initialCast, timeOfDay, validateCast } from '../../../../modules/cast/cast/domain.js';
import { atParty, castOf, fightOn, readEntry, routineHolds, samePlace } from '../../../../modules/cast/cast/entries.js';
import { chooseMeetings, dueMove, metInTheStory, movable, paceOf, roomLeft } from '../../../../modules/cast/cast/world.js';
import { entry } from './helpers.js';
import { DAY, HOUR, SYNC_NOW, castFor, crowd, synced } from './rules.helpers.js';
test('entries: a listed entry is read cut to size; one without a pack, id or name is not one; a key once; the pack list names the packs', () => {
    const read = readEntry(entry('fenna', { name: `  Fenna ${'x'.repeat(200)}`, aliases: ['the ferrywoman', 'the ferrywoman', ' '], drawnTo: ['a', '', 'b'], canDieUnmet: true }));
    assert.deepEqual(readEntry(entry('fenna', { aliases: ['Fenna', 'the ferrywoman'] })).aliases, ['the ferrywoman'], 'her own name is no alias');
    assert.equal(read.key, 'ersveil:fenna');
    assert.equal(Array.from(read.name).length, 80);
    assert.deepEqual(read.aliases, ['the ferrywoman']);
    assert.deepEqual([read.drawnTo, read.canDieUnmet, read.ver, read.place], [['a', 'b'], true, '1.1.0', 'Harrow']);
    assert.equal(readEntry({ id: 'x', name: 'X' }), null);
    assert.equal(readEntry({ pack: 'p', id: 'bad id', name: 'X' }), null);
    assert.equal(readEntry({ pack: 'p', id: 'x', name: '   ' }), null);
    assert.equal(readEntry('Fenna'), null);
    const cast = castFor(entry('a'), entry('a', { name: 'Again' }), { nonsense: true }, entry('b'));
    assert.deepEqual(cast.entries.map(item => item.key), ['ersveil:a', 'ersveil:b']);
    assert.deepEqual([cast.listed, cast.packs.ersveil, [...cast.enabled]], [true, { name: 'Ersveil', version: '1.1.0' }, ['ersveil']]);
    // The packs could not be asked: not listed, and nothing may be inferred from the silence.
    assert.equal(castOf(() => { throw new Error('no packs'); }).listed, false);
    assert.equal(castOf(null).listed, false);
});

test('places: one holds the other (three letters at least); the party\'s place or region is the person\'s', () => {
    assert.ok(samePlace('Bluewatch docks', 'bluewatch docks'));
    assert.ok(samePlace('Bluewatch', 'Bluewatch docks, east quay'));
    assert.ok(!samePlace('Ye', 'Yew'));
    assert.ok(!samePlace('', 'Harrow'));
    assert.ok(!samePlace('Harrow', 'Kesh'));
    assert.ok(atParty('Harrow', { place: 'Harrow', region: '' }));
    assert.ok(atParty('Ersveil', { place: 'Harrow', region: 'Ersveil' }));
    assert.ok(!atParty('Kesh', { place: 'Harrow', region: 'Ersveil' }));
    assert.ok(!atParty('', { place: 'Harrow' }));
});

test('routine: a routine that names a time of day has someone at their place only then; one that names none holds at any hour; no clock, no objection', () => {
    const at = hour => hour * HOUR + 5 * DAY;
    assert.ok(routineHolds('works the night ferry', at(23)) && routineHolds('works the night ferry', at(2)) && routineHolds('works the night ferry', at(20)));
    assert.ok(!routineHolds('works the night ferry', at(12)) && !routineHolds('works the night ferry', at(8)));
    assert.ok(routineHolds('at the forge in the morning', at(9)) && !routineHolds('at the forge in the morning', at(15)));
    assert.ok(routineHolds('drinks at dusk, sleeps by day', at(18)) && routineHolds('drinks at dusk, sleeps by day', at(10)) && !routineHolds('drinks at dusk, sleeps by day', at(2)));
    assert.ok(routineHolds('keeps the books', at(3)) && routineHolds('', at(3)));
    assert.ok(routineHolds('works the night ferry', null), 'the clock is not set');
    assert.deepEqual([0, 6, 9, 12, 15, 19, 23].map(hour => timeOfDay(hour * HOUR)), ['night', 'dawn', 'morning', 'midday', 'afternoon', 'evening', 'night']);
    assert.equal(timeOfDay(null), '');
});

test('a fight: a session that has not ended; none, or an ended one, is no fight', () => {
    const fight = session => fightOn(name => (name === 'combat.session' ? session : null));
    assert.equal(fight({ status: 'active', round: 2 }), true);
    assert.equal(fight({ id: 'cb_1' }), true);
    assert.equal(fight({ status: 'ended' }), false);
    assert.equal(fight({ status: 'Victory' }), false);
    assert.equal(fight(null), false);
    assert.equal(fightOn(() => { throw new Error('no fights here'); }), false);
    assert.equal(fightOn(null), false);
});

test('when the cast moves: the day changes or six hours pass; a clock that went back only follows; not before the cast\'s day is started', () => {
    const slice = at => ({ ...initialCast(), day: at === null ? null : [{ at, rev: 1 }] });
    const noon = 10 * DAY + 12 * HOUR;
    assert.equal(dueMove(slice(null), noon), null);
    assert.equal(dueMove(slice(noon), null), null);
    assert.equal(dueMove(slice(noon), noon + 5 * HOUR), null, 'later the same day');
    assert.deepEqual(dueMove(slice(noon), noon + 6 * HOUR), { from: noon, to: noon + 6 * HOUR, reset: false }, 'six hours is a skip');
    assert.deepEqual(dueMove(slice(10 * DAY + 20 * HOUR), 11 * DAY + HOUR), { from: 10 * DAY + 20 * HOUR, to: 11 * DAY + HOUR, reset: false }, 'a new day');
    assert.deepEqual(dueMove(slice(noon), noon - 3 * DAY), { from: noon, to: noon - 3 * DAY, reset: true });
});

test('sync: new entries join at the current minute at their start; a second look finds nothing to do; an unchanged entry is no update', () => {
    const { slice, cast } = synced([entry('fenna', { start: { place: 'Bluewatch docks', goal: 'ferry', routine: 'works the night ferry' } }), entry('sera', { start: { place: 'Gwenmar', goal: 'x' } })]);
    assert.deepEqual(Object.keys(slice.people).sort(), ['ersveil:fenna', 'ersveil:sera']);
    assert.match(slice.people['ersveil:fenna'].sig, /^[0-9a-f]{12}$/, 'a fingerprint of what the entry says');
    assert.deepEqual({ ...slice.people['ersveil:fenna'], sig: undefined }, { sig: undefined, pack: 'ersveil', eid: 'fenna', name: 'Fenna', ver: '1.1.0', joined: SYNC_NOW, where: 'Bluewatch docks', doing: 'works the night ferry', since: SYNC_NOW, alive: true, met: null, heard: null, rev: 1 });
    assert.equal(slice.people['ersveil:sera'].doing, 'x', 'no routine: the goal');
    assert.deepEqual(slice.day, [{ at: SYNC_NOW, rev: 1, first: SYNC_NOW }], 'the first minute the cast knew is kept (for people with no since of their own)');
    assert.ok(syncEmpty(planSync(slice, cast, { now: SYNC_NOW })));
    assert.deepEqual(validateCast(slice), []);
});

test('sync: a changed unmet entry takes the new words and keeps where they are; a met one keeps the words it was met with and only its version moves (and settles: no step each reply)', () => {
    const { slice } = synced([entry('fenna'), entry('sera')], draft => {
        draft.people['ersveil:fenna'].where = 'Ashford';
        draft.people['ersveil:sera'].met = { on: 1, where: 'Harrow', why: 'place', reason: '', rev: 2 };
    });
    const next = castFor({ ...entry('fenna'), name: 'Fenna Marsh', aliases: ['the ferrywoman'], packVersion: '1.2.0' }, { ...entry('sera'), name: 'Sera of Kesh', packVersion: '1.2.0' });
    const plan = planSync(slice, next, { now: SYNC_NOW });
    assert.deepEqual(plan.update.map(item => item.key).sort(), ['ersveil:fenna', 'ersveil:sera']);
    applySync(slice, syncPayload(plan), { now: SYNC_NOW, rev: 3 });
    assert.deepEqual([slice.people['ersveil:fenna'].name, slice.people['ersveil:fenna'].aliases, slice.people['ersveil:fenna'].where, slice.people['ersveil:fenna'].ver], ['Fenna Marsh', ['the ferrywoman'], 'Ashford', '1.2.0']);
    assert.deepEqual([slice.people['ersveil:sera'].name, slice.people['ersveil:sera'].ver], ['Sera', '1.2.0']);
    assert.ok(syncEmpty(planSync(slice, next, { now: SYNC_NOW })), 'a met person\'s changed entry is not asked for again');
    assert.deepEqual(validateCast(slice), []);
});

test('sync: an entry that left takes an unmet person (only while its pack is enabled); a met person stays; the pack not asked about leaves everyone', () => {
    const { slice } = synced([entry('fenna'), entry('sera')], draft => { draft.people['ersveil:sera'].met = { on: 1, where: 'Harrow', why: 'place', reason: '', rev: 2 }; });
    const none = castOf(name => (name === 'packs.content' ? [] : name === 'packs.list' ? [{ id: 'ersveil', name: 'Ersveil', version: '1.1.0', enabled: true }] : null));
    assert.deepEqual(planSync(slice, none, { now: SYNC_NOW }).drop, ['ersveil:fenna']);
    const off = castOf(name => (name === 'packs.content' ? [] : name === 'packs.list' ? [{ id: 'ersveil', name: 'Ersveil', version: '1.1.0', enabled: false }] : null));
    assert.deepEqual(planSync(slice, off, { now: SYNC_NOW }).drop, [], 'a pack that is off keeps its people');
    assert.deepEqual(planSync(slice, castOf(() => { throw new Error('x'); }), { now: SYNC_NOW }).drop, [], 'silence drops no one');
});

test('sync: the people the world holds are capped; the pack update line counts new people only where the pack already had some', () => {
    const many = Array.from({ length: 70 }, (_, n) => entry(`p${n}`));
    const { slice } = synced(many);
    assert.equal(Object.keys(slice.people).length, 64);
    const fresh = synced([entry('a')]).slice;
    const more = castFor(entry('a', {}, { packVersion: '1.1.0' }), { ...entry('b'), packVersion: '1.2.0' });
    more.packs.ersveil.version = '1.2.0';
    assert.deepEqual(planSync(fresh, more, { now: SYNC_NOW }).updated, [{ pack: 'ersveil', n: 1, changed: 0, from: '1.1.0', to: '1.2.0' }]);
    assert.deepEqual(planSync(initialCast(), more, { now: SYNC_NOW }).updated, [], 'a pack seen for the first time is not an update');
});

test('advance: a move sets where and what; the dead and the unknown are passed over; a met person\'s news is kept; a death only for the unmet; the cast\'s minute moves', () => {
    const { slice } = synced([entry('fenna'), entry('sera'), entry('brom')], draft => {
        draft.people['ersveil:sera'].met = { on: 1, where: 'Harrow', why: 'place', reason: '', rev: 2 };
        draft.people['ersveil:brom'].alive = false;
    });
    const to = SYNC_NOW + DAY;
    const done = applyAdvance(slice, {
        from: SYNC_NOW, to, moves: [{ key: 'ersveil:fenna', where: 'Ashford', doing: 'at the guild' }, { key: 'ersveil:sera', where: 'Kesh', doing: 'at the fair' }, { key: 'ersveil:brom', where: 'Nowhere', doing: 'ghost' }, { key: 'ersveil:nobody', where: 'X', doing: 'y' }],
        died: [{ key: 'ersveil:sera' }, { key: 'ersveil:fenna' }],
    }, { rev: 4 });
    assert.deepEqual([done.moved, done.died], [2, 1]);
    assert.deepEqual([slice.people['ersveil:fenna'].where, slice.people['ersveil:fenna'].doing, slice.people['ersveil:fenna'].since, slice.people['ersveil:fenna'].alive], ['Ashford', '', to, false], 'moved, then died: nothing left to do');
    assert.deepEqual([slice.people['ersveil:sera'].alive, slice.people['ersveil:sera'].heard], [true, [{ on: to, text: 'at the fair' }]]);
    assert.equal(slice.people['ersveil:brom'].where, 'Harrow');
    assert.deepEqual(slice.day, [{ at: to, rev: 4, first: SYNC_NOW }]);
    assert.deepEqual(validateCast(slice), []);
});

test('meet: the first meeting sets met and the cue slot; a second is nothing; the reader\'s and the narrator\'s words for why', () => {
    const { slice } = synced([entry('fenna', { start: { place: 'Bluewatch docks', goal: 'g', routine: 'Works the night ferry.' } })]);
    const met = applyMeet(slice, { at: 6, who: [{ key: 'ersveil:fenna', why: 'place', reason: '' }, { key: 'ersveil:nobody', why: 'goal', reason: 'x' }] }, { now: SYNC_NOW, rev: 5 });
    assert.deepEqual(met, ['ersveil:fenna']);
    assert.deepEqual(slice.people['ersveil:fenna'].met, { on: SYNC_NOW, where: 'Bluewatch docks', why: 'place', reason: '', rev: 5 });
    assert.deepEqual(slice.meeting, [{ at: 6, keys: ['ersveil:fenna'], rev: 5, seen: 1 }]);
    assert.deepEqual(applyMeet(slice, { at: 7, who: [{ key: 'ersveil:fenna', why: 'place', reason: '' }] }, { now: SYNC_NOW, rev: 6 }), []);
    assert.deepEqual(slice.meeting[0].at, 6);
    const person = slice.people['ersveil:fenna'];
    assert.equal(whyText({ name: 'Fenna', why: 'place', reason: '', doing: person.doing, where: person.where }), 'Fenna works the night ferry at Bluewatch docks, and you are there: your first time here while they are. No roll.');
    assert.equal(whyText({ name: 'Sera', why: 'goal', reason: 'Her hunt led her to the weir.', doing: '', where: '' }), 'Her hunt led her to the weir. Their own goal pulls them to you, so they arrive; no roll.');
    assert.equal(whyNarrator(person), 'Works the night ferry, they are at Bluewatch docks, the place of this scene.');
    assert.equal(whyNarrator({ met: { why: 'goal', reason: 'her hunt led her to the weir.' } }), 'Her hunt led her to the weir. Their own goal brings them to {{user}}.');
    assert.deepEqual(validateCast(slice), []);
});

test('who is met: by place and routine in the order they joined, goal arrivals first, at most one a reply, within the pace, never in a fight, never the present or the pinned', () => {
    const evening = 20 * DAY + 20 * HOUR;
    const { slice, cast } = crowd([['ana', 'Bluewatch docks', 'works the night ferry'], ['bo', 'Harrow', ''], ['cy', 'Harrow', 'at the forge in the morning'], ['di', 'Kesh', '', ['her brother\'s killer']]], evening);
    const party = { place: 'Harrow', region: '' };
    const pace = paceOf({});
    const pick = (more = {}) => chooseMeetings(slice, cast, { now: evening, party, pace, ...more }).map(item => `${item.key.split(':')[1]}:${item.why}`);
    assert.deepEqual(pick(), ['bo:place'], 'Cy\'s routine is the morning; Ana is at the docks; one a reply');
    assert.deepEqual(pick({ comes: [{ key: 'ersveil:di', reason: 'she heard' }] }), ['di:goal'], 'a goal arrival first, and the one a reply is used');
    assert.deepEqual(pick({ comes: [{ key: 'ersveil:ana', reason: 'x' }] }), ['bo:place'], 'no drawnTo, no goal arrival');
    assert.deepEqual(pick({ fight: true }), []);
    assert.deepEqual(pick({ present: new Set(['bo']) }), [], 'Bo is in the scene already; Cy is not due');
    assert.deepEqual(pick({ pinned: new Set(['bo']) }), []);
    assert.deepEqual(pick({ party: { place: 'Bluewatch docks', region: '' } }), ['ana:place'], 'the night ferry at night');
    assert.deepEqual(chooseMeetings(slice, cast, { now: 20 * DAY + 9 * HOUR, party, pace }).map(item => item.key), ['ersveil:bo']);
    assert.deepEqual(pick({ party: { place: '', region: '' } }), [], 'no place known');
    // {{user}} in the pack's cast is never met (not by place, not as a goal arrival, not met in the story); the others still are.
    assert.deepEqual(pick({ persona: 'Bo' }), [], 'Bo is the player: Cy is not due');
    assert.deepEqual(pick({ persona: 'Bo', comes: [{ key: 'ersveil:bo', reason: 'x' }] }), []);
    assert.deepEqual(pick({ persona: 'Ana', party: { place: 'Bluewatch docks', region: '' } }), []);
    assert.deepEqual(metInTheStory(slice, cast, { present: new Set(['bo', 'cy']), party }).map(item => item.key), ['ersveil:bo', 'ersveil:cy']);
    assert.deepEqual(metInTheStory(slice, cast, { present: new Set(['bo', 'cy']), party, persona: 'Bo' }).map(item => item.key), ['ersveil:cy']);
    // Pace.
    slice.people['ersveil:ana'].met = { on: evening - HOUR, where: 'x', why: 'place', reason: '', rev: 2 };
    assert.deepEqual([roomLeft(slice, evening, paceOf({})), roomLeft(slice, evening, paceOf({ faces: 'day2' })), roomLeft(slice, evening + DAY, paceOf({})), roomLeft(slice, evening + 3 * DAY, paceOf({ faces: 'week1' })), roomLeft(slice, evening + 8 * DAY, paceOf({ faces: 'week1' }))], [0, 1, 1, 0, 1]);
    assert.deepEqual(pick(), [], 'one a day: the rest wait');
    // Someone who has moved on from their start has no routine to keep.
    delete slice.people['ersveil:ana'].met;
    slice.people['ersveil:ana'].met = null;
    slice.people['ersveil:cy'].where = 'Kesh road';
    assert.ok(movable(slice, cast).some(item => item.key === 'ersveil:cy'));
    assert.deepEqual(pick({ party: { place: 'Kesh road', region: '' } }), ['cy:place']);
});

test('movable: refs are the entry ids, the whole key where two packs share one; the stale first; the just-joined and the dead left out', () => {
    const a = entry('fenna');
    const b = entry('fenna', {}, { pack: 'other' });
    const cast = castFor(a, b);
    const slice = initialCast();
    applySync(slice, syncPayload(planSync(slice, cast, { now: 100 })), { now: 100, rev: 1 });
    slice.people['other:fenna'].since = 50;
    assert.deepEqual(movable(slice, cast).map(item => [item.key, item.ref]), [['other:fenna', 'other:fenna'], ['ersveil:fenna', 'ersveil:fenna']]);
    assert.deepEqual(movable(slice, cast, { to: 100 }).map(item => item.key), ['other:fenna'], 'joined at the minute asked about: nothing to move yet');
    slice.people['other:fenna'].alive = false;
    assert.deepEqual(movable(slice, cast).map(item => item.ref), ['fenna']);
});
