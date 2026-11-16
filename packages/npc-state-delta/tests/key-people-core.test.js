import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHost } from '../../story-block/testkit/index.js';
import { buildInjection, createNpcRecord, mergeScanResult } from '../core.js';
import { keyAwayHtml, keyProjection, projectDossierState } from '../dossier-ui.js';
import { dossierRowNodes } from '../story-block-tabs.js';
import { storyMinuteText } from '../calendar.js';
import { FEATURE_DRIFT, FEATURE_STAGES, KEY_PEOPLE_QUERY, observeKeyAway, validateNpcSlice } from '../src/npc-meters.js';
import { MODULE_ID, createStorySuiteV2Adapter } from '../src/storysuite-v2.js';
import {
    AWAY_LOCKED_FIELDS, RECENT_REPLIES, awayNpcIds, awayRange, findKeyEntry, isAway, isKey, keyView,
    lockAwayNpcs, memoryKey, normalizeKeyPeople, returnNote,
} from '../src/key-people.js';
import { fakeDocument } from './helpers/fake-dom.js';
import { runHostScenario } from './helpers/host-scenario.js';
import { runtimeSource } from './helpers/runtime-source.js';

// Key people (the user's decision, 1 Nov): Story Director owns who is a key person and where they are; Delta reads
// its query `director.keyPeople` and shows it (badge, "While away", ★ on cards and in the library), tells the narrator
// the summary once when the person comes back, and holds a key person's stable fields still while they are away.
// Without Story Director (or one without the query) nothing changes anywhere.

import {
    REN_AWAY, key, npc,
} from './key-people.helpers.js';

// ---- the query's answer ----

test('the answer is cleaned: names, aliases, dates and steps are text of a bounded size; a removed person has no absence', () => {
    assert.equal(KEY_PEOPLE_QUERY, 'director.keyPeople');
    assert.deepEqual(normalizeKeyPeople(null), []);
    assert.deepEqual(normalizeKeyPeople({ name: 'Ren' }), []);
    const list = normalizeKeyPeople([
        { name: '  Ren \n', aliases: ['The Scout', '', 5], here: false, away: { doing: ' scouting ', since: 'Gw 12', back: 12, steps: [{ date: 'Gw 14', text: 'reached Wolfmere' }, { date: 'x', text: '' }, 'junk'] } },
        { name: 'ren' },
        { name: 'Odda', here: true, away: null },
        { name: 'Mara', away: { doing: 'x' }, removed: { reason: 'died', on: 'Gw 18' } },
        null, { name: '' },
    ]);
    assert.deepEqual(list.map(entry => entry.name), ['Ren', 'Odda', 'Mara'], 'a repeated name and junk rows are dropped');
    assert.deepEqual(list[0].aliases, ['The Scout', '5']);
    assert.deepEqual(list[0].away, { doing: 'scouting', since: 'Gw 12', back: '', steps: [{ date: 'Gw 14', text: 'reached Wolfmere' }] });
    assert.equal(list[1].away, null);
    assert.equal(list[2].away, null, 'a removed person is not away');
    assert.deepEqual(list[2].removed, { reason: 'died', on: 'Gw 18' });
    assert.equal(isKey(list[2]), false);
    assert.equal(isAway(list[0]), true);
    assert.equal(isAway(list[1]), false);
    const long = normalizeKeyPeople([{ name: 'Ren', away: { doing: 'x'.repeat(900), steps: Array.from({ length: 30 }, (_, i) => ({ date: `d${i}`, text: `step ${i}` })) } }])[0];
    assert.equal(long.away.doing.length, 200);
    assert.equal(long.away.steps.length, 12);
    assert.equal(long.away.steps.at(-1).text, 'step 29', 'the newest steps are kept');
    assert.equal(normalizeKeyPeople(Array.from({ length: 80 }, (_, i) => ({ name: `P${i}` }))).length, 50);
});

test('Story Director sends story minutes: they are written as dates on its calendar; no calendar means no text, words are kept', () => {
    const DAY = 1440;
    const calendar = { era: 'CY', months: [{ name: 'Goldwane', days: 30 }, { name: 'Bluewatch', days: 30 }], leapYears: false };
    const text = minutes => storyMinuteText(minutes, calendar);
    assert.equal(text(11 * DAY), 'Goldwane 12');
    assert.equal(text(30 * DAY + 3 * DAY + 600), 'Bluewatch 4', 'the clock time is dropped; the month rolls over');
    assert.equal(text(null), '');
    assert.equal(text(1.5), '');
    assert.equal(storyMinuteText(0), 'January 1', 'no calendar: Gregorian, as Story Director falls back');
    assert.equal(storyMinuteText(60 * DAY, { months: [] }), 'March 1', 'year 0 is a leap year');
    assert.equal(storyMinuteText(5, { months: [{ name: '', days: 30 }] }), '');

    const away = { doing: 'scouting', since: 11 * DAY, back: 17 * DAY, steps: [{ date: 13 * DAY, text: 'reached Wolfmere' }, { date: null, text: 'a step with no date' }] };
    const [ren] = normalizeKeyPeople([{ name: 'Ren', here: false, away }], text);
    assert.deepEqual(ren.away, { doing: 'scouting', since: 'Goldwane 12', back: 'Goldwane 18', steps: [{ date: 'Goldwane 14', text: 'reached Wolfmere' }, { date: '', text: 'a step with no date' }] });
    assert.equal(returnNote(ren.away), 'WHILE AWAY, NOW BACK (Goldwane 12 – Goldwane 18): scouting; Goldwane 14: reached Wolfmere; a step with no date');
    const [bare] = normalizeKeyPeople([{ name: 'Ren', away }]);
    assert.deepEqual([bare.away.since, bare.away.back, bare.away.steps[0].date], ['', '', ''], 'no way to write a minute: no text, never a bare number');
    assert.equal(normalizeKeyPeople([{ name: 'Mara', removed: { reason: 'died', on: 18 * DAY } }], text)[0].removed.on, 'Goldwane 19');
    assert.equal(normalizeKeyPeople([{ name: 'Ren', away: { doing: 'x', since: 'Gw 12', back: null } }])[0].away.since, 'Gw 12', 'a date already in words is kept');
});

test('a dossier is matched to a key person by name or alias, either side, any case', () => {
    const list = normalizeKeyPeople([key('Ren', { aliases: ['The Scout'] }), key('Odda')]);
    assert.equal(findKeyEntry(list, { name: 'ren' })?.name, 'Ren');
    assert.equal(findKeyEntry(list, { name: 'Renato', aliases: ['the scout'] })?.name, 'Ren');
    assert.equal(findKeyEntry(list, { name: 'Oddy', aliases: ['ODDA'] })?.name, 'Odda');
    assert.equal(findKeyEntry(list, { name: 'Mira' }), null);
    assert.equal(findKeyEntry([], { name: 'Ren' }), null);
    assert.equal(findKeyEntry(null, { name: 'Ren' }), null);
    const away = normalizeKeyPeople([key('Ren', { here: false, away: REN_AWAY }), key('Odda')]);
    assert.deepEqual([...awayNpcIds(away, [npc('Ren'), npc('Odda'), npc('Mira')])], ['npc_ren']);
});

// ---- the memory of the last absence ----

test('away, back, present for a few replies: the absence is kept, then dropped (the step\'s memory, one reply at a time)', () => {
    const ren = npc('Ren');
    const awayList = normalizeKeyPeople([key('Ren', { here: false, away: REN_AWAY })]);
    const backList = normalizeKeyPeople([key('Ren', { here: true })]);
    let memory = {};
    const note = (list, head) => { const out = observeKeyAway(memory, list, head); memory = out.memory; return out; };
    assert.equal(memoryKey('Ren'), 'ren');
    assert.equal(memoryKey('Jean-Luc  Picard'), 'jean-luc-picard');

    assert.equal(note(backList, 3).changed, false, 'a key person never seen away leaves nothing');
    assert.deepEqual(memory, {});
    assert.equal(note(awayList, 4).changed, true);
    assert.equal(memory.ren.returnedAt, null);
    assert.deepEqual(validateNpcSlice({ npcs: {}, problems: [], keyAway: memory }), [], 'what the step writes is a valid slice');
    assert.equal(keyView(awayList, memory, ren, 4).away.doing, 'scouting the north road');
    assert.equal(keyView(awayList, memory, ren, 4).recent, null);
    assert.equal(note(awayList, 5).changed, false, 'still away, the same record: nothing to write');

    note(backList, 6);
    assert.equal(memory.ren.returnedAt, 6, 'noticed back at reply 6');
    let view = keyView(backList, memory, ren, 6);
    assert.equal(view.away, null);
    assert.equal(view.recent.justReturned, true);
    assert.equal(view.recent.away.steps.length, 2);

    note(backList, 7);
    view = keyView(backList, memory, ren, 7);
    assert.equal(view.recent.justReturned, false, 'one reply later it is no longer the return');
    assert.equal(memory.ren.presentReplies, 1);
    note(backList, 8);
    assert.equal(memory.ren.presentReplies, 2);
    note(backList, 9);
    assert.equal(RECENT_REPLIES, 3);
    assert.deepEqual(memory, {}, 'present for three replies: the absence is dropped');
    assert.equal(keyView(backList, memory, ren, 9).recent, null);

    // Not present after the return: it waits (the section stays) until they are.
    memory = {};
    note(awayList, 4);
    for (const head of [5, 6, 7]) note(backList.map(entry => ({ ...entry, here: false })), head);
    assert.equal(memory.ren.presentReplies, 0);
    assert.ok(keyView(backList, memory, ren, 7).recent);

    // Away again before they were present for long: a new absence replaces the old.
    note(awayList.map(entry => ({ ...entry, away: { ...entry.away, doing: 'on a second errand' } })), 8);
    assert.equal(memory.ren.away.doing, 'on a second errand');
    assert.equal(memory.ren.returnedAt, null);
    // Unpinned (not a key person any more), removed, no answer, no head.
    assert.deepEqual(observeKeyAway(memory, [], 9).memory, {});
    assert.deepEqual(observeKeyAway(memory, normalizeKeyPeople([{ name: 'Ren', removed: { reason: 'died', on: null } }]), 9).memory, {});
    assert.equal(observeKeyAway(memory, null, 9).changed, false, 'no answer: nothing is touched');
    assert.equal(observeKeyAway(memory, backList, null).changed, false, 'no head: nothing is touched');
    // The slice refuses a memory that is not shaped as the step writes it.
    assert.ok(validateNpcSlice({ npcs: {}, problems: [], keyAway: { ren: { name: 'Ren' } } }).length);
    assert.ok(validateNpcSlice({ npcs: {}, problems: [], keyAway: [] }).length);
});

test('the summary for the narrator is one short line: where, the newest steps, within its limit', () => {
    assert.equal(awayRange(REN_AWAY), 'Gw 12 – Gw 18');
    assert.equal(awayRange({ since: 'Gw 12' }), 'since Gw 12');
    assert.equal(awayRange({ back: 'Gw 18' }), 'until Gw 18');
    assert.equal(awayRange({}), '');
    assert.equal(awayRange(null), '');
    assert.equal(returnNote(normalizeKeyPeople([key('Ren', { away: REN_AWAY })])[0].away),
        'WHILE AWAY, NOW BACK (Gw 12 – Gw 18): scouting the north road; Gw 14: reached Wolfmere Outpost; Gw 16: met the toll-gang at the weir');
    assert.equal(returnNote(null), '');
    const many = normalizeKeyPeople([key('Ren', { away: { doing: 'scouting', since: 'A', back: 'B', steps: Array.from({ length: 9 }, (_, i) => ({ date: `D${i}`, text: 'a long step that goes on and on '.repeat(3).trim() })) } })])[0].away;
    const long = returnNote(many);
    assert.ok(long.length <= 360, `within the limit (${long.length})`);
    assert.match(long, /^WHILE AWAY, NOW BACK \(A – B\): scouting; /);
    assert.match(long, /D8:/, 'the newest step is the one kept');
    assert.ok(returnNote(many, 80).length <= 80);
    assert.match(returnNote(many, 80), /^WHILE AWAY, NOW BACK \(A – B\): scouting$/, 'too short for any step: the head alone');
    assert.match(returnNote(many, 30), /…$/);
    assert.ok(returnNote(many, 30).length <= 30);
});

// ---- the narrator: once, with the dossier, within the budget ----

test('the injection gives a returned key person the summary with their block; without it the text is byte-identical', () => {
    const ren = npc('Ren', { present: true, personality: 'Dry and watchful.', role: 'Scout' });
    const mira = npc('Mira', { present: true, personality: 'Warm.', role: 'Smith' });
    const plain = buildInjection([ren, mira], 'Ren and Mira stand at the gate.', 3, 3);
    const none = buildInjection([ren, mira], 'Ren and Mira stand at the gate.', 3, 3, undefined, undefined, null, { awayNotes: null });
    assert.equal(none, plain, 'no note: exactly as before');
    assert.equal(buildInjection([ren, mira], 'Ren and Mira stand at the gate.', 3, 3, undefined, undefined, null, { awayNotes: {} }), plain);
    const note = returnNote(normalizeKeyPeople([key('Ren', { away: REN_AWAY })])[0].away);
    const text = buildInjection([ren, mira], 'Ren and Mira stand at the gate.', 3, 3, undefined, undefined, null, { awayNotes: { npc_ren: note } });
    const renLine = text.split('\n').find(line => line.startsWith('- Ren: IDENTITY'));
    const miraLine = text.split('\n').find(line => line.startsWith('- Mira: IDENTITY'));
    assert.ok(renLine.endsWith(`; ${note}`), 'the summary closes Ren\'s own block');
    assert.equal(text.split('WHILE AWAY').length - 1, 1, 'once, and only for Ren');
    assert.ok(!miraLine.includes('WHILE AWAY'));
    assert.equal(text.replace(`; ${note}`, ''), plain, 'nothing else moves');
    // It counts in the budget like the block: a tight budget still ends within it.
    const tight = buildInjection([ren, mira], 'Ren and Mira stand at the gate.', 3, 3, undefined, 512, null, { awayNotes: { npc_ren: note } });
    assert.ok(tight.length <= 512 * 4, `within the budget (${tight.length})`);
});

// ---- a scan leaves an away key person's stable fields alone ----

test('a scan leaves an away key person\'s custom fields and stable profile as they are; present people change as usual', () => {
    const fields = { personality: 'Dry and watchful.', background: 'Raised on the river docks.', mannerisms: ['taps the hilt'], customFields: { Rank: 'Scout' } };
    const ren = npc('Ren', { ...fields, manualProfileFields: ['role'] });
    const odda = npc('Odda', { ...fields });
    const state = { npcs: [ren, odda], candidates: [], turn: 1 };
    const scan = {
        npcs: ['Ren', 'Odda'].map(name => ({
            id: `npc_${name.toLowerCase()}`, name, present: true,
            personality: 'Dry and watchful, with a sudden warmth toward people who feed him.', personalityState: 'refine',
            customFields: { Rank: 'Captain' }, customFieldsReason: 'promoted to captain',
        })),
    };
    const options = { turn: 2, customFieldNames: ['Rank'], developmentContext: 'Ren and Odda were promoted to captain, and a sudden warmth showed toward people who feed him.' };

    const free = mergeScanResult(state, scan, options).state.npcs;
    assert.equal(free.find(item => item.id === 'npc_ren').customFields.Rank, 'Captain', 'without the hold the scan changes a custom field (the test is a fair one)');
    assert.match(free.find(item => item.id === 'npc_ren').personality, /sudden warmth/);

    const held = mergeScanResult(state, scan, { ...options, awayNpcIds: ['npc_ren'] }).state.npcs;
    const heldRen = held.find(item => item.id === 'npc_ren');
    const heldOdda = held.find(item => item.id === 'npc_odda');
    assert.deepEqual(heldRen.customFields, { Rank: 'Scout' }, 'custom fields held');
    assert.equal(heldRen.personality, 'Dry and watchful.', 'a stable profile field held');
    assert.equal(heldRen.background, 'Raised on the river docks.');
    assert.deepEqual(heldRen.mannerisms, ['taps the hilt']);
    assert.equal(heldOdda.customFields.Rank, 'Captain', 'someone who is present is scanned as usual');
    assert.match(heldOdda.personality, /sudden warmth/);
    assert.deepEqual(heldRen.manualProfileFields, ['role'], 'their own locks are put back: the hold is never stored');
    assert.deepEqual(heldOdda.manualProfileFields, []);

    // Back (not in the set any more): scanned as usual again.
    const back = mergeScanResult({ ...state, npcs: [heldRen, heldOdda] }, scan, { ...options, awayNpcIds: [] }).state.npcs.find(item => item.id === 'npc_ren');
    assert.equal(back.customFields.Rank, 'Captain', 'scans resume when they are present');
    assert.match(back.personality, /sudden warmth/);
});

test('the hold: only the stable profile fields and custom fields, nothing stored, nobody away means the state itself', () => {
    assert.deepEqual(AWAY_LOCKED_FIELDS, ['personality', 'speech', 'appearance', 'mannerisms', 'behaviorProfile', 'background', 'customFields']);
    const state = { npcs: [npc('Ren', { manualProfileFields: ['role'] }), npc('Odda')], turn: 1 };
    assert.equal(lockAwayNpcs(state, new Set()), null);
    assert.equal(lockAwayNpcs(state, ['npc_nobody']), null);
    const hold = lockAwayNpcs(state, ['npc_ren']);
    assert.deepEqual(hold.state.npcs[0].manualProfileFields, ['role', ...AWAY_LOCKED_FIELDS]);
    assert.deepEqual(hold.state.npcs[1], state.npcs[1]);
    assert.deepEqual(state.npcs[0].manualProfileFields, ['role'], 'the real state is untouched');
    assert.deepEqual(hold.restore(hold.state.npcs)[0].manualProfileFields, ['role']);
});

// ---- the dossier, the library, the cards ----

test('the dossier shows the badge and "While away" (live and after the return); a library row carries the ★', () => {
    const view = { name: 'Ren', here: false, away: REN_AWAY, recent: null };
    const projected = keyProjection(view);
    assert.equal(projected.away.range, 'Gw 12 – Gw 18');
    const html = keyAwayHtml(projected);
    assert.match(html, /While away · Gw 12 – Gw 18/);
    assert.match(html, /<li><b>Gw 14<\/b>: reached Wolfmere Outpost<\/li>/);
    assert.match(html, /held while they are away/);
    const back = keyAwayHtml(keyProjection({ name: 'Ren', here: true, away: null, recent: { away: REN_AWAY, justReturned: false } }));
    assert.match(back, /While away · Gw 12 – Gw 18/);
    assert.match(back, /They are back\./);
    assert.equal(keyAwayHtml(keyProjection({ name: 'Ren', here: true, away: null, recent: null })), '', 'a key person who is here has no section');
    assert.equal(keyProjection(null), null);
    // Markup in the story's words is text.
    const hostile = keyAwayHtml(keyProjection({ here: false, away: { doing: '<img src=x>', steps: [{ date: '<b>', text: '<script>' }] } }));
    assert.doesNotMatch(hostile, /<img|<script/);
    assert.match(hostile, /&lt;img src=x&gt;/);
    assert.match(hostile, /<li><b>&lt;b&gt;<\/b>: &lt;script&gt;<\/li>/);

    const state = { npcs: [npc('Ren', { present: false }), npc('Odda', { present: true })], keyViews: { npc_ren: view } };
    const projection = projectDossierState(state);
    assert.equal(projection.npcs.find(item => item.id === 'npc_ren').key.away.doing, 'scouting the north road');
    assert.equal(projection.npcs.find(item => item.id === 'npc_odda').key, undefined);
    assert.deepEqual(projection.index.map(row => [row.id, row.key === true]).sort(), [['npc_odda', false], ['npc_ren', true]]);
    assert.equal(projectDossierState({ npcs: [npc('Ren')] }).npcs[0].key, undefined, 'no key people: the projection is as before');

    const rows = dossierRowNodes([{ id: 'npc_ren', name: 'Ren', role: 'Scout', statusLabel: 'Off-screen', key: true }, { id: 'npc_odda', name: 'Odda', role: '', statusLabel: '' }], fakeDocument())
        .map(node => node.serialize());
    assert.match(rows[0], /<b class="ss-listcard-title">Ren<span class="npc-state-delta-key-star" title="Key person" aria-label="Key person"> ★<\/span><\/b>/);
    assert.doesNotMatch(rows[1], /key-star/);
});

test('index.js wiring: the card tag, the badge data, the one-time note, the scan hold and the memory (source)', () => {
    const index = runtimeSource();
    assert.match(index, /\$\{isKeyNpc\(npc\) \? '<span class="npc-state-delta-key-tag" title="Key person \(Story Director\)">★ Key<\/span>' : ''\}/);
    assert.match(index, /keyAwayScanOptions\(mergeBaseState\)/);
    assert.match(index, /\.\.\.\(awayNotes \? \{ awayNotes \} : \{\}\)/);
    assert.match(index, /const keyViews = dossierKeyViews\(state\);/);
    assert.match(index, /storySuiteV2Meters\(\)\?\.keyAwayMemory\?\.\(\)/, 'the memory of the last absence is read from the saved slice');
    assert.doesNotMatch(index, /state\.keyAway/, 'and Delta\'s own sidecar holds none');
    const targeted = index.slice(index.indexOf('const scoped = job.scope'), index.indexOf('const result = merged.state.npcs.find'));
    assert.doesNotMatch(targeted, /awayNpcIds|keyAwayScanOptions/, 'a reader\'s own Refresh or backfill is not held');
    assert.match(index, /\.\.\.\(manual \? \{\} : keyAwayScanOptions\(mergeBaseState\)\)/, 'nor is the reader\'s own Scan now');
});
