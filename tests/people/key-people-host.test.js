import test from 'node:test';
import assert from 'node:assert/strict';
import { createNpcRecord } from '../core.js';
import { FEATURE_DRIFT, FEATURE_STAGES, KEY_PEOPLE_QUERY, observeKeyAway, validateNpcSlice } from '../src/npc-meters.js';
import { isAway, keyView, returnNote } from '../src/key-people.js';
import { keyAwayHtml, keyProjection } from '../dossier-ui.js';
import { createDirectorQueriesPart } from '../src/adapter/queries-director.js';
import { applyStaleLifecycleAfterScan as staleAfterScan } from '../runtime-scan-stale.js';
import { REN_AWAY, key, suite } from './key-people.helpers.js';

test('the adapter reads the key people from Story Director; with none to ask (or no such query) it answers null', async () => {
    const s = await suite();
    assert.deepEqual(s.adapter.keyPeople(), [], 'Story Director answers an empty list');
    await s.keys([key('Ren', { here: false, away: REN_AWAY }), key('Odda')]);
    assert.deepEqual(s.adapter.keyPeople().map(entry => [entry.name, isAway(entry)]), [['Ren', true], ['Odda', false]]);
    const plain = await suite({ modules: [] });
    assert.equal(plain.adapter.keyPeople(), null, 'Story Block alone: no key people anywhere');
    const old = await suite({ modules: [{ id: 'zz-old', name: 'Older director', domains: {}, commands: {}, queries: { 'director.time': () => ({ minutes: 0 }) } }] });
    assert.equal(old.adapter.keyPeople(), null, 'an older Story Director without the query');
});

test('while a key person is away their meters do not drift and their stage is not lost; both resume when they are back', async () => {
    const settings = {
        customMeters: [{ name: 'Mood', min: -50, max: 50, start: 0, drift: 4, driftTo: 0 }],
        ladder: [{ name: 'Friend', needs: 'trust 20' }], demoteAfter: 2,
    };
    const s = await suite({ settings, features: { [FEATURE_DRIFT]: true, [FEATURE_STAGES]: true } });
    await s.say(['~ npc Ren | mood: +15 | trust: +15', '~ npc Mira | mood: +15 | trust: +15']);
    await s.say(['~ npc Ren | trust: +15', '~ npc Mira | trust: +15']);
    assert.deepEqual([s.meters('Ren').rank, s.meters('Mira').rank], ['Friend', 'Friend']);
    assert.deepEqual([s.meters('Ren').meters.mood, s.meters('Mira').meters.mood], [15, 15]);

    // Three story days pass and trust falls below the stage; Ren is away, Mira is here.
    await s.keys([key('Ren', { here: false, away: REN_AWAY })], 3 * 1440);
    await s.say(['~ npc Ren | trust: -15', '~ npc Mira | trust: -15']);
    await s.say();
    assert.equal(s.meters('Mira').meters.mood, 3, 'Mira (here) drifted toward rest: 4 a day for 3 days');
    assert.equal(s.meters('Mira').rank, undefined, 'and lost her stage after the replies below it');
    assert.equal(s.meters('Ren').meters.mood, 15, 'Ren (away) stays exactly as set');
    assert.equal(s.meters('Ren').rank, 'Friend', 'and keeps his stage');
    assert.equal(s.meters('Ren').meters.trust, 15, 'a change the story writes is still the story\'s');
    await s.keys(undefined, 20 * 1440);
    await s.say();
    assert.equal(s.meters('Mira').meters.mood, 0);
    assert.equal(s.meters('Ren').meters.mood, 15, 'seventeen more days away: still as set');

    await s.keys([key('Ren', { here: true })]);
    await s.say();
    assert.equal(s.meters('Ren').meters.mood, 15, 'the days he was away are not caught up');
    await s.keys(undefined, 21 * 1440);
    await s.say();
    assert.equal(s.meters('Ren').meters.mood, 11, 'once back, the drift resumes with the next story day');
});

test('the memory of the last absence is in the saved slice: the step writes it, a swipe does not count twice, a reload keeps it and its one-time note', async () => {
    const DAY = 1440;
    const away = { doing: 'scouting the north road', since: 11 * DAY, back: 17 * DAY, steps: [{ date: 13 * DAY, text: 'reached Wolfmere Outpost' }] };
    const s = await suite();
    const memory = () => s.host.sdk.query('npc.keyAway', {});
    const head = () => s.host.store.headIndex();
    const viewOf = () => keyView(s.adapter.keyPeople(), s.adapter.keyAwayMemory(), { name: 'Ren' }, head());
    assert.deepEqual(memory(), {}, 'nothing until someone has been away');

    await s.keys([key('Ren', { here: false, away })]);
    await s.say();
    assert.deepEqual(Object.keys(memory()), ['ren']);
    assert.deepEqual(memory().ren.away, { doing: 'scouting the north road', since: 'January 12', back: 'January 18', steps: [{ date: 'January 14', text: 'reached Wolfmere Outpost' }] }, 'dates written on the calendar when the step ran');
    assert.equal(memory().ren.returnedAt, null);
    assert.deepEqual(validateNpcSlice(s.host.head().domains.people?.bonds ?? { npcs: {}, problems: [] }), []);

    // The reply that brings him back.
    await s.keys([key('Ren', { here: true })]);
    await s.say();
    const returnedAt = head();
    assert.equal(memory().ren.returnedAt, returnedAt);
    assert.equal(memory().ren.presentReplies, 0);
    assert.equal(viewOf().recent.justReturned, true);

    // A swipe of that reply runs the step again from the reply before it: the same memory, never counted twice.
    await s.swipe();
    assert.equal(head(), returnedAt);
    assert.equal(memory().ren.returnedAt, returnedAt);
    assert.equal(memory().ren.presentReplies, 0);

    // A reload between the return and the next reply (the host rebuilds its state from the chat): the view and the note are still there.
    await s.host.turn.onChatChanged();
    assert.equal(head(), returnedAt);
    assert.equal(memory().ren.returnedAt, returnedAt, 'the memory came back with the replies');
    const after = viewOf();
    assert.equal(after.away, null);
    assert.equal(after.recent.justReturned, true, 'the narrator is still told at the next generation');
    assert.equal(returnNote(after.recent.away), 'WHILE AWAY, NOW BACK (January 12 – January 18): scouting the north road; January 14: reached Wolfmere Outpost');
    assert.equal(keyAwayHtml(keyProjection(after)).includes('January 14'), true, 'and the dossier still shows the steps');

    // The next reply: no longer the return; present replies count once each, and a swipe does not add one.
    await s.say();
    assert.equal(viewOf().recent.justReturned, false);
    assert.equal(memory().ren.presentReplies, 1);
    await s.swipe();
    assert.equal(memory().ren.presentReplies, 1);
    await s.say();
    await s.say();
    assert.deepEqual(memory(), {}, 'present for three replies: dropped');
    assert.equal(viewOf().recent, null);
});

test('with no Story Director the per-reply step is exactly as before (nobody is held)', async () => {
    const settings = { customMeters: [{ name: 'Mood', min: -50, max: 50, start: 0, drift: 4, driftTo: 0 }] };
    const clock = { id: 'zz-clock', name: 'Clock', domains: { director: { initial: () => ({ time: { minutes: 0 } }) } }, commands: { 'zz.clock': (ctx, { minutes }) => { ctx.draft('director').time.minutes = minutes; return { summary: 'time' }; } }, queries: { 'director.time': state => ({ minutes: state?.domains?.director?.time?.minutes ?? null }) } };
    const s = await suite({ settings, modules: [clock], features: { [FEATURE_DRIFT]: true } });
    await s.say(['~ npc Ren | mood: +15']);
    await s.host.sdk.command('zz.clock', { minutes: 2 * 1440 + 60 });
    await s.say();
    assert.equal(s.meters('Ren').meters.mood, 7);
});

// Story Director absent is "no key list", not a failure (so the stale pass still deletes incidental dossiers); only a real failure blocks deletion.
test('keyPeopleReadable: no Story Director module or switched off (null) is readable; an error or a non-list answer from a registered one is not', () => {
    const readable = (query, modules = [{ id: 'story-director' }]) => createDirectorQueriesPart({ hosted: true, sdkRef: { query, modules: () => modules } }, {}, { hostFeature: () => undefined }).keyPeopleReadable();
    assert.equal(readable(() => { throw new Error('no module answers'); }, []), true, 'no Story Director registered: no key list, whatever the error');
    assert.equal(readable(() => null), true, 'the feature is off');
    assert.equal(readable(() => []), true);
    assert.equal(readable(() => { throw Object.assign(new Error('x'), { code: 'NOT_FOUND' }); }), false, 'a registered Director that fails');
    assert.equal(readable(() => { throw new Error('boom'); }), false);
    assert.equal(readable(() => ({ not: 'a list' })), false, 'malformed answer');
    assert.equal(createDirectorQueriesPart({ hosted: true, sdkRef: { query: () => [], modules: () => { throw new Error('x'); } } }, {}, { hostFeature: () => undefined }).keyPeopleReadable(), false, 'the host cannot say');
    assert.equal(createDirectorQueriesPart({ hosted: false }, {}, { hostFeature: () => undefined }).keyPeopleReadable(), true, 'not hosted: nothing to read');
});

// Director absence is read from the host's modules (the sdk's no-module error has no code): through the live Story Block runtime.
test('hosted: Story Director not registered reads fine and an incidental stale dossier is deleted; a registered one that throws deletes nothing', async () => {
    const stale = () => [{ ...createNpcRecord('Inc', []), id: 'npc_inc', lastSeenTurn: 1 }];
    const settings = { autoPruneStale: true, maxNpcs: 40, staleArchiveAfter: 30, staleDeleteAfter: 50 };
    // The same test the runtime applies (runtime-hosted.js hostedReadsFailed), on the real adapter and sdk.
    const failed = adapter => adapter.keyPeopleReadable() === false || !Array.isArray(adapter.meterEntries());
    const run = adapter => staleAfterScan({ turn: 100, npcs: stale() }, {}, '', settings, { keepIds: [], noDelete: failed(adapter) });

    const none = await suite({ modules: [] });
    assert.throws(() => none.host.sdk.query(KEY_PEOPLE_QUERY, {}), error => error.code === undefined, 'the real sdk error carries no code');
    assert.equal(none.adapter.keyPeopleReadable(), true);
    assert.equal(failed(none.adapter), false);
    assert.deepEqual(run(none.adapter).removed.map(item => item.id), ['npc_inc'], 'deleted, as without Director');

    const throwing = await suite({ modules: [{ id: 'story-director', name: 'Story Director', version: '0.0.0-test', queries: { 'director.keyPeople': () => { throw new Error('boom'); } } }] });
    assert.equal(throwing.adapter.keyPeopleReadable(), false);
    assert.equal(failed(throwing.adapter), true);
    assert.equal(run(throwing.adapter).removed.length, 0, 'a registered Director that fails: nothing deleted');
});
