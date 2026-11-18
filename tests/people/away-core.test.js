// NPC State's side of people away (people/away; AWAYFOLLOW): the answer of `director.away` matched to dossiers, the memory of the last absence,
// the one-time "While away" note, the injection, and the scan hold. Ported from the Key people tests B4-9 removed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInjection, mergeScanResult } from '../../modules/people/core/core.js';
import { validateNpcSlice } from '../../modules/people/meters/npc-meters.js';
import { findAwayEntry, isAwayEntry, normalizeAwayAnswer } from '../../modules/people/away/away-read.js';
import { observeAway, returnNote } from '../../modules/people/away/away-memory.js';
import { awayDossierIds, holdAwayDossiers } from '../../modules/people/away/away-hold.js';
import { runtimeSource } from './helpers/runtime-source.js';
import { REN_AWAY, key, npc } from './away.helpers.js';

const HELD = ['personality', 'speech', 'appearance', 'mannerisms', 'behaviorProfile', 'background', 'customFields'];

test('a dossier is matched to someone away by name or alias, either side, any case; the dead are never held', () => {
    const list = normalizeAwayAnswer([key('Ren', { aliases: ['The Scout'] }), key('Odda')]);
    assert.equal(findAwayEntry(list, { name: 'ren' })?.name, 'Ren');
    assert.equal(findAwayEntry(list, { name: 'Renato', aliases: ['the scout'] })?.name, 'Ren');
    assert.equal(findAwayEntry(list, { name: 'Oddy', aliases: ['ODDA'] })?.name, 'Odda');
    assert.equal(findAwayEntry(list, { name: 'Mira' }), null);
    assert.equal(findAwayEntry(null, { name: 'Ren' }), null);
    const away = normalizeAwayAnswer([key('Ren', { here: false, away: REN_AWAY }), key('Odda'), { name: 'Vorn', away: REN_AWAY, removed: { reason: 'died' } }]);
    assert.deepEqual([...awayDossierIds(away, [npc('Ren'), npc('Odda'), npc('Mira'), npc('Vorn')])], ['npc_ren']);
    assert.equal(isAwayEntry(away.find(entry => entry.name === 'Vorn')), false);
});

test('away, back, present for a few replies: the absence is kept, told once at the return, then dropped', () => {
    const ren = npc('Ren');
    const awayList = normalizeAwayAnswer([key('Ren', { here: false, away: REN_AWAY })]);
    const backList = normalizeAwayAnswer([key('Ren', { here: true })]);
    let memory = {};
    const note = (list, head) => { const out = observeAway(memory, list, head); memory = out.memory; return out; };
    assert.equal(note(backList, 3).changed, false, 'someone never seen away leaves nothing');
    assert.equal(note(awayList, 4).changed, true);
    assert.equal(memory.ren.returnedAt, null);
    assert.deepEqual(validateNpcSlice({ npcs: {}, problems: [], keyAway: memory }), [], 'what the step writes is a valid slice');
    assert.equal(returnNote(awayList, memory, ren, 4), '', 'no note while away');
    assert.equal(note(awayList, 5).changed, false, 'still away, the same record: nothing to write');
    note(backList, 6);
    assert.equal(memory.ren.returnedAt, 6, 'noticed back at reply 6');
    assert.equal(returnNote(backList, memory, ren, 6), 'WHILE AWAY, NOW BACK (Gw 12 – Gw 18): scouting the north road; Gw 14: reached Wolfmere Outpost; Gw 16: met the toll-gang at the weir');
    note(backList, 7);
    assert.equal(returnNote(backList, memory, ren, 7), '', 'one reply later it is no longer the return');
    note(backList, 8);
    note(backList, 9);
    assert.deepEqual(memory, {}, 'present for three replies: dropped');
    memory = {};
    note(awayList, 4);
    for (const head of [5, 6, 7]) note(backList.map(entry => ({ ...entry, here: false })), head);
    assert.equal(memory.ren.presentReplies, 0, 'not present after the return: it waits');
    assert.deepEqual(observeAway(memory, [], 9).memory, {}, 'no longer listed: dropped');
    assert.deepEqual(observeAway(memory, normalizeAwayAnswer([{ name: 'Ren', removed: { reason: 'died' } }]), 9).memory, {}, 'dead: dropped');
    assert.equal(observeAway(memory, null, 9).changed, false, 'no answer: nothing is touched');
    assert.equal(observeAway(memory, backList, null).changed, false, 'no head: nothing is touched');
    assert.ok(validateNpcSlice({ npcs: {}, problems: [], keyAway: { ren: { name: 'Ren' } } }).length, 'a memory not shaped as the step writes it is refused');
});

test('the note is one short line within its limit, the newest steps kept', () => {
    const many = { doing: 'scouting', since: 'A', back: 'B', steps: Array.from({ length: 9 }, (_, i) => ({ date: `D${i}`, text: 'a long step that goes on and on '.repeat(3).trim() })) };
    const list = normalizeAwayAnswer([key('Ren', { here: true })]);
    const memory = { ren: { name: 'Ren', aliases: [], away: normalizeAwayAnswer([key('Ren', { away: many })])[0].away, returnedAt: 2, presentReplies: 0 } };
    const long = returnNote(list, memory, npc('Ren'), 2);
    assert.ok(long.length <= 360);
    assert.match(long, /^WHILE AWAY, NOW BACK \(A – B\): scouting; /);
    assert.match(long, /D8:/);
    assert.match(returnNote(list, memory, npc('Ren'), 2, 80), /^WHILE AWAY, NOW BACK \(A – B\): scouting$/);
    assert.ok(returnNote(list, memory, npc('Ren'), 2, 30).length <= 30);
});

test('the injection gives a returned person the note with their block; without it the text is byte-identical', () => {
    const ren = npc('Ren', { present: true, personality: 'Dry and watchful.', role: 'Scout' });
    const mira = npc('Mira', { present: true, personality: 'Warm.', role: 'Smith' });
    const plain = buildInjection([ren, mira], 'Ren and Mira stand at the gate.', 3, 3);
    assert.equal(buildInjection([ren, mira], 'Ren and Mira stand at the gate.', 3, 3, undefined, undefined, null, { awayNotes: null }), plain);
    const note = 'WHILE AWAY, NOW BACK (Gw 12 – Gw 18): scouting the north road';
    const text = buildInjection([ren, mira], 'Ren and Mira stand at the gate.', 3, 3, undefined, undefined, null, { awayNotes: { npc_ren: note } });
    assert.ok(text.split('\n').find(line => line.startsWith('- Ren: IDENTITY')).endsWith(`; ${note}`));
    assert.equal(text.replace(`; ${note}`, ''), plain, 'nothing else moves');
});

test('a scan leaves an away person\'s custom fields and stable profile as they are; present people change as usual; the hold is never stored', () => {
    const fields = { personality: 'Dry and watchful.', background: 'Raised on the river docks.', mannerisms: ['taps the hilt'], customFields: { Rank: 'Scout' } };
    const state = { npcs: [npc('Ren', { ...fields, manualProfileFields: ['role'] }), npc('Odda', { ...fields })], candidates: [], turn: 1 };
    const scan = { npcs: ['Ren', 'Odda'].map(name => ({ id: `npc_${name.toLowerCase()}`, name, present: true, personality: 'Dry and watchful, with a sudden warmth toward people who feed him.', personalityState: 'refine', customFields: { Rank: 'Captain' }, customFieldsReason: 'promoted to captain' })) };
    const options = { turn: 2, customFieldNames: ['Rank'], developmentContext: 'Ren and Odda were promoted to captain, and a sudden warmth showed toward people who feed him.' };
    assert.equal(mergeScanResult(state, scan, options).state.npcs.find(item => item.id === 'npc_ren').customFields.Rank, 'Captain', 'without the hold the scan changes it');
    const held = mergeScanResult(state, scan, { ...options, heldAwayIds: ['npc_ren'] }).state.npcs;
    const ren = held.find(item => item.id === 'npc_ren');
    assert.deepEqual(ren.customFields, { Rank: 'Scout' });
    assert.equal(ren.personality, 'Dry and watchful.');
    assert.deepEqual(ren.manualProfileFields, ['role'], 'their own locks are put back');
    assert.equal(held.find(item => item.id === 'npc_odda').customFields.Rank, 'Captain');
    const hold = holdAwayDossiers(state, ['npc_ren']);
    assert.deepEqual(hold.state.npcs[0].manualProfileFields, ['role', ...HELD]);
    assert.equal(holdAwayDossiers(state, []), null);
    assert.equal(holdAwayDossiers(state, ['npc_nobody']), null);
});

test('runtime wiring: the one-time note, the automatic scan hold (never the reader\'s own Scan now) and the memory read from the saved slice', () => {
    const index = runtimeSource();
    assert.match(index, /\.\.\.\(manual \? \{\} : awayScanOptions\(mergeBaseState\)\)/);
    assert.match(index, /const awayNotes = awayReturnNotes\(state\);/);
    assert.match(index, /\.\.\.\(awayNotes \? \{ awayNotes \} : \{\}\)/);
    const targeted = index.slice(index.indexOf('const scoped = job.scope'), index.indexOf('const result = merged.state.npcs.find'));
    assert.doesNotMatch(targeted, /heldAwayIds|awayScanOptions/, 'a reader\'s own Refresh or backfill is not held');
});
