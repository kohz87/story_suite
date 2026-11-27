// A scan or command never carries one stored person's death, looks, birth date or row to another stored person, however their names meet. Only a
// record the merge folds into a survivor hands these on.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyNpcStateCommand, createNpcRecord, mergeScanResult } from '../../modules/people/core/core.js';
import { settleScanRows } from '../../modules/people/core/core-merge-namesakes.js';
import { scanMoodNumbers } from '../../modules/people/calls/runtime-scan-helpers-parts/scan-results.js';

const record = (id, extra = {}, name = 'Guard') => ({ ...createNpcRecord(name, []), id, role: 'guard', ...extra });
const DEAD = { lifeState: 'deceased', lifeStateCertainty: 'explicit', lifeStateReason: 'Killed at the gate.', mood: 'cold' };
const ROW = { id: 'npc_g1', name: 'Guard', present: true, mood: 'wary' };
const BORN = { birthDate: { era: '', year: 1990, month: '03', day: 3 }, birthDateSource: 'established', birthDatePrecision: 'full', birthDateYearSource: 'established' };
const merge = (npcs, scan, options = {}) => mergeScanResult({ npcs, turn: 5 }, scan, { turn: 5, sourceMessageId: 9, ...options });
const byId = result => Object.fromEntries(result.state.npcs.map(npc => [npc.id, npc]));
// the two modes a replay of an older reply uses, and a new read
const MODES = [{}, { keepNamesakeRows: true }, { historicalRead: true }];

test('a row for the living Guard leaves them alive, with the row\'s mood, in either record order and in every read mode', () => {
    const pair = () => [record('npc_g1', { present: true }), record('npc_g2', { ...DEAD })];
    for (const options of MODES) for (const npcs of [pair(), pair().reverse()]) {
        const { npc_g1: living, npc_g2: gone } = byId(merge(npcs, { npcs: [ROW] }, options));
        assert.deepEqual([living.lifeState, living.present, living.mood], ['unknown', true, 'wary'], JSON.stringify(options));
        assert.deepEqual([gone.lifeState, gone.present, gone.mood, gone.fieldChanges], ['deceased', false, 'cold', {}]);
    }
});

test('a command about someone else leaves the living Guard alive', () => {
    const state = { npcs: [record('npc_g1', { present: true }), record('npc_g2', { ...DEAD })], turn: 5 };
    const next = byId(applyNpcStateCommand(state, { action: 'add', name: 'Bo' }));
    assert.deepEqual([next.npc_g1.lifeState, next.npc_g1.present, next.npc_g2.lifeState], ['unknown', true, 'deceased']);
});

test('two different names sharing an alias do not share a death', () => {
    const npcs = [record('npc_m', { aliases: ['the captain'] }, 'Mara'), record('npc_j', { ...DEAD, aliases: ['the captain'] }, 'Joren')];
    const { npc_m: mara } = byId(merge(npcs, { npcs: [{ id: 'npc_m', name: 'Mara', present: true, mood: 'wary' }] }));
    assert.deepEqual([mara.lifeState, mara.present, mara.mood], ['unknown', true, 'wary']);
});

test('living namesakes keep their own looks and birth date, and no change is stamped on the one the scan did not touch', () => {
    const tall = { appearance: 'A tall man with red hair.' };
    const short = { appearance: 'A short woman with black hair.' };
    for (const born of ['npc_g1', 'npc_g2']) for (const order of [1, -1]) {
        const npcs = [record('npc_g1', { ...tall, ...(born === 'npc_g1' ? BORN : {}) }), record('npc_g2', { ...short, ...(born === 'npc_g2' ? BORN : {}) })];
        const other = born === 'npc_g1' ? 'npc_g2' : 'npc_g1';
        const next = byId(merge(order > 0 ? npcs : npcs.reverse(), { npcs: [ROW] }));
        assert.equal(next[born].birthDateSource, 'established');
        assert.notEqual(next[other].birthDateSource, 'established', `born ${born}, order ${order}`);
        assert.match(next.npc_g2.appearance, /^A short woman with black hair\.$/i);
        assert.deepEqual(next.npc_g2.fieldChanges, {});
    }
});

test('a row with one namesake\'s id changes only that record, in both row lists', () => {
    const npcs = () => [record('npc_g1', { appearance: 'A tall man with red hair.' }), record('npc_g2', { appearance: 'A short woman with black hair.' })];
    const looks = { id: 'npc_g1', name: 'Guard', appearance: 'A tall man with red hair and a scarred chin.', appearanceState: 'refine' };
    const born = { birthDate: { month: '05', day: 5, year: 1980 }, birthDateState: 'establish' };
    for (const key of ['npcs', 'profileUpdates']) for (const options of MODES) {
        const alone = byId(merge(npcs(), { [key]: [] }, options)).npc_g2;
        const next = byId(merge(npcs(), { [key]: [{ ...looks, ...born }] }, options));
        assert.match(next.npc_g1.appearance, /scarred chin/i, key);
        for (const field of ['appearance', 'birthDate', 'birthDateSource', 'profileEvidence', 'fieldChanges']) {
            assert.deepEqual(next.npc_g2[field], alone[field], `${key} ${field} ${JSON.stringify(options)}`);
        }
    }
});

test('the live runtime reads the same row: its mood numbers reach its own id only', () => {
    const npcs = [record('npc_g1'), record('npc_g2')];
    for (const idsOnly of [false, true]) {
        const rows = settleScanRows(npcs, { npcs: [{ ...ROW, moodV: 1, moodA: 1, moodD: 1 }] }, [], idsOnly).scanResult.npcs;
        assert.equal(rows[0].settledId, 'npc_g1');
        assert.deepEqual(npcs.map(npc => Boolean(scanMoodNumbers(rows, npc, row => row?.mood))), [true, false]);
        assert.deepEqual(settleScanRows(npcs, { npcs: rows }, [], idsOnly).scanResult.npcs, rows, 'a journaled tied row reads the same again');
    }
});

test('unique names, and a row that reveals a stored duplicate, are handed on untouched', () => {
    const unique = [record('npc_m', {}, 'Mara'), record('npc_j', {}, 'Joren')];
    const duplicate = [record('npc_gm', { createdAt: 2 }, 'the gate guard'), record('npc_marcus', { createdAt: 1 }, 'Marcus')];
    for (const [npcs, row] of [[unique, { id: 'npc_m', name: 'Mara' }], [duplicate, { id: 'npc_gm', name: 'Marcus', aliases: ['the gate guard'] }]]) {
        for (const idsOnly of [false, true]) {
            const scan = { npcs: [row] };
            assert.equal(settleScanRows(npcs, scan, [], idsOnly).scanResult, scan);
        }
    }
});

test('a duplicate folded into the survivor still hands on its death and birth date', () => {
    const npcs = [record('npc_old', { createdAt: 1, aliases: ['Marcus'] }, 'the gate guard'), record('npc_new', { createdAt: 2, updatedAt: 1, ...DEAD, ...BORN }, 'Marcus')];
    npcs[0].updatedAt = 99;
    const result = merge(npcs, { npcs: [] });
    assert.deepEqual(result.report.deduplicated.map(item => [item.keptId, item.removedId]), [['npc_old', 'npc_new']]);
    const [kept] = result.state.npcs;
    assert.deepEqual([kept.lifeState, kept.present, kept.birthDateSource], ['deceased', false, 'established']);
});

test('an older journal entry that killed the living Guard replays with them alive; a stored death stays', () => {
    const before = [record('npc_g1', { present: true }), record('npc_g2', { ...DEAD })];
    const entry = { npcs: [structuredClone(ROW)] };
    const replayed = byId(merge(structuredClone(before), entry, { keepNamesakeRows: true }));
    assert.equal(replayed.npc_g1.lifeState, 'unknown');
    const stored = [record('npc_g1', { ...DEAD }), record('npc_g2', { ...DEAD })];
    assert.equal(byId(merge(stored, entry, { keepNamesakeRows: true })).npc_g1.lifeState, 'deceased');
});
