// A new fight rebuilds from the Foes block; only one open fight's exact bars carry into its next segment.
// (The carry and the rewind are the core's, interaction/carry.js; these tests drive them with the fight kind and check what the fight carries.)

import test from 'node:test';
import assert from 'node:assert/strict';
import { playBoard } from '../../../../src/v2/lean-rpg/board/engine.js';
import { settledNote } from '../../../../src/v2/lean-rpg/board/note.js';
import { fightKind } from '../../../../src/v2/lean-rpg/board/interaction.js';
import { receiveSegment, reconcileSession } from '../../../../src/v2/interaction/carry.js';
import { interactionPayload } from '../../../../src/v2/interaction/session.js';
import { boardSession, discardBoard, openBoard, stageExchange } from '../../helpers/board-port.js';
import { STANDARD_FORMULA } from '../../../../src/v2/lean-rpg/rules.js';
import { character, foeBlock, sheetDomain } from '../helpers.js';

const RULES = { ...STANDARD_FORMULA, levelDivisor: 5 };
const state = (foes = [['Rats', 3, 1, 4]]) => ({ meta: { claims: {} }, domains: { dataModules: sheetDomain({
    hero: { role: 'character', fields: character('Astra', { str: 20, agi: 20, health: 8 }) }, foes: { role: 'foes', fields: foeBlock(foes) },
}) } });
const action = { actions: [{ who: 'Astra', kind: 'attack', target: 11 }] };
const port = meta => meta.storySuiteInteraction;
// the open segment's payload, as the settle receipt keeps it; the core's carry takes it with the segment's result
const payloadOf = meta => interactionPayload(port(meta).open);
const receive = (meta, payload, result, sid, receiptId, state) => receiveSegment(port(meta), fightKind, payload, result, sid, receiptId, state);
const takeBack = (meta, gone) => reconcileSession(port(meta), id => !gone.includes(id));
const bits = result => ({ rounds: result.rounds, members: result.members, hurts: result.hurts, stop: result.stop });

test('every new board fight is marked for members and never reads a cross-fight kept cache', () => {
    const value = state(), meta = { rpgFightHistory: [{ claim: 'old', members: [{ slot: 11, group: 1, n: 1, value: 1, pack: false, count: 1 }] }] };
    const opened = openBoard(meta, value, { sid: 'reply-1', rules: RULES });
    assert.equal(opened.error, undefined, opened.error);
    assert.equal(opened.session.setup.members, 1);
    assert.equal(Object.hasOwn(opened.session.setup, 'kept'), false);
    assert.equal(Object.hasOwn(meta, 'rpgFightHistory'), true, 'an old cache is left alone, not rewritten');
});

// an open first segment of a fight on `meta` (the attempts roll other dice until one leaves the fight open), with `pick` choosing the target
function openFirst(meta, value, sid, pick = preview => preview.result.members.find(member => member.standing)?.slot) {
    for (let attempt = 0; attempt < 200; attempt += 1) {
        const opened = openBoard(meta, value, { sid, rules: RULES });
        assert.equal(opened.error, undefined, opened.error);
        const target = pick(opened.preview);
        if (target) {
            const staged = stageExchange(meta, value, [{ who: 'Astra', kind: 'attack', target }]);
            if (!staged.error && staged.preview.result.stop === 'open') return { staged, target };
        }
        assert.equal(discardBoard(meta), true);
    }
    return null;
}

test('a continuation carries exact member values and original counts, and drops the opening list', () => {
    const value = state(), opened = [{ name: 'Rats', count: 3, level: 1 }];
    const meta = { storySuiteInteraction: { start: { anchor: 'origin', result: { opened } } } };
    const first = openFirst(meta, value, 'origin');
    assert.ok(first, 'found an open first segment');
    assert.equal(receive(meta, payloadOf(meta), first.staged.preview.result, 'reply1', 'receipt1', first.staged.preview.state), true);
    const setup = boardSession(meta).setup;
    assert.deepEqual(setup.carriedMembers.values, Object.fromEntries(first.staged.preview.result.members.map(member => [member.slot, member.value])));
    assert.deepEqual(setup.carriedMembers.counts, { 1: 3 });
    assert.equal(Object.hasOwn(setup, 'opened'), false, 'the next segment does not repeat New foes');
    assert.equal(Object.hasOwn(setup, 'kept'), false);
    assert.equal(Object.hasOwn(meta, 'rpgFightHistory'), false);
});

test('the same segment received again (a swipe) refreshes nothing it should not: carried bars stay, opened stays dropped, staged steps stay', () => {
    const value = state(), opened = [{ name: 'Rats', count: 3, level: 1 }];
    const meta = { storySuiteInteraction: { start: { anchor: 'origin', result: { opened } } } };
    const first = openFirst(meta, value, 'origin');
    assert.ok(first, 'found an open first segment');
    const payload = payloadOf(meta), result = first.staged.preview.result;
    assert.equal(receive(meta, payload, result, 'reply1', 'receipt1', first.staged.preview.state), true);
    const carried = structuredClone(boardSession(meta).setup.carriedMembers);
    const next = playBoard(first.staged.preview.state, boardSession(meta).setup, []);
    const target = next.result.members.find(member => member.standing)?.slot;
    if (target) assert.equal(stageExchange(meta, first.staged.preview.state, [{ who: 'Astra', kind: 'attack', target }]).error, undefined);
    const steps = boardSession(meta).exchanges.length;
    assert.equal(receive(meta, payload, result, 'reply1b', 'receipt1b', first.staged.preview.state), true);
    const again = boardSession(meta);
    assert.deepEqual(again.setup.carriedMembers, carried);
    assert.deepEqual(again.setup.carriedMembers.values, Object.fromEntries(result.members.map(member => [member.slot, member.value])));
    assert.equal(Object.hasOwn(again.setup, 'opened'), false);
    assert.equal(again.exchanges.length, steps, 'the staged steps are kept');
    assert.equal(again.anchor, 'reply1b', 'the segment is re-anchored on the new reply');
});

test('OPENING_NOTE: the preview names the new foes, and the next segment does not repeat them', () => {
    const value = state(), opened = [{ name: 'Rats', count: 3, level: 1 }];
    const meta = { storySuiteInteraction: { start: { anchor: 'reply-1', result: { opened } } } };
    const first = openBoard(meta, value, { sid: 'reply-1', rules: RULES });
    assert.equal(first.error, undefined, first.error);
    assert.match(settledNote(first.preview.result, first.session.setup), /New foes: Rats ×3 \(Lv 1\), each fought on its own\./);
    const staged = stageExchange(meta, value, action.actions);
    assert.equal(staged.error, undefined, staged.error);
    assert.equal(staged.preview.result.stop, 'open');
    assert.match(settledNote(staged.preview.result, staged.session.setup), /New foes:/, 'the staged preview and its committed note agree');

    assert.equal(receive(meta, payloadOf(meta), staged.preview.result, 'reply-1', 'receipt-1', value), true);
    const nextSetup = boardSession(meta).setup;
    assert.equal(Object.hasOwn(nextSetup, 'opened'), false);
    const next = playBoard(value, nextSetup, []);
    assert.equal(next.error, undefined, next.error);
    assert.doesNotMatch(settledNote(next.result, nextSetup), /New foes:/, 'the next segment has only its own note');
});

test('NEW4: an ordinary opening with no prior carry restages its first segment unchanged', () => {
    const value = state(), meta = {}, sid = 'origin';
    const found = openFirst(meta, value, sid);
    assert.ok(found, 'found an open first segment');
    for (const key of ['carriedMembers', 'opening', 'approach', 'drop', 'opened']) assert.equal(Object.hasOwn(found.staged.session.setup, key), false);
    receive(meta, payloadOf(meta), found.staged.preview.result, 'reply1', 'receipt1', value);
    takeBack(meta, ['receipt1']);
    const restored = boardSession(meta);
    assert.equal(restored.setup.offset, 0);
    for (const key of ['carriedMembers', 'opening', 'approach', 'drop', 'opened']) assert.equal(Object.hasOwn(restored.setup, key), false);
    const restaged = stageExchange(meta, value, [{ who: 'Astra', kind: 'attack', target: found.target }]);
    assert.equal(restaged.error, undefined, restaged.error);
    assert.deepEqual(bits(restaged.preview.result), bits(found.staged.preview.result));
});

test('NEW1: a rewind restores the segment\'s prior carried bars for members and packs', () => {
    for (const count of [3, 12]) {
        const value = state([['Rats', count, 1, 4]]), meta = {}, sid = 'origin';
        let found = null;
        for (let attempt = 0; attempt < 200 && !found; attempt += 1) {
            const first = openFirst(meta, value, sid);
            assert.ok(first, `count ${count}: found an open first segment`);
            const state1 = first.staged.preview.state;
            receive(meta, payloadOf(meta), first.staged.preview.result, 'reply1', 'receipt1', state1);
            const firstCarry = structuredClone(boardSession(meta).setup.carriedMembers);
            const target2 = playBoard(state1, boardSession(meta).setup, []).result.members.find(member => member.standing)?.slot;
            if (!target2) { discardBoard(meta); continue; }
            const secondAction = [{ who: 'Astra', kind: 'attack', target: target2 }];
            const second = stageExchange(meta, state1, secondAction);
            if (second.error || second.preview.result.stop !== 'open') { discardBoard(meta); continue; }
            const secondPayload = payloadOf(meta);
            receive(meta, secondPayload, second.preview.result, 'reply2', 'receipt2', second.preview.state);
            const open = port(meta).open;
            assert.deepEqual(open.base.setup.carriedMembers, firstCarry, `count ${count}: the segment saved the carry it started from`);
            found = { state1, secondAction, second, secondPayload, firstCarry, secondCarry: structuredClone(boardSession(meta).setup.carriedMembers) };
        }
        assert.ok(found, `count ${count}: found two open segments`);

        const stagedMeta = structuredClone(meta);
        const thirdTarget = playBoard(found.second.preview.state, boardSession(stagedMeta).setup, []).result.members.find(member => member.standing)?.slot;
        assert.ok(thirdTarget, `count ${count}: a target remains for a third choice`);
        const stagedAgain = stageExchange(stagedMeta, found.second.preview.state, [{ who: 'Astra', kind: 'attack', target: thirdTarget }]);
        assert.equal(stagedAgain.error, undefined, `count ${count}: a third choice can be staged`);
        takeBack(stagedMeta, ['receipt2']);
        assert.equal(boardSession(stagedMeta).invalidated, true, `count ${count}: a staged choice is invalidated while its receipt is gone`);
        takeBack(stagedMeta, []);
        assert.equal(boardSession(stagedMeta).invalidated, undefined, `count ${count}: the returning receipt clears the invalidation`);

        takeBack(meta, ['receipt2']);
        const restored = boardSession(meta);
        assert.equal(restored.setup.offset, 1, `count ${count}: the rewind returns to the prior segment`);
        assert.deepEqual(restored.setup.carriedMembers, found.firstCarry, `count ${count}: the prior carry is back`);
        const restaged = stageExchange(meta, found.state1, found.secondAction);
        assert.equal(restaged.error, undefined, `count ${count}: the original target can be chosen again`);
        assert.deepEqual(bits(restaged.preview.result), bits(found.second.preview.result), `count ${count}: fresh restaging uses the same bars and dice`);
        receive(meta, found.secondPayload, found.second.preview.result, 'reply2', 'receipt2', found.second.preview.state);
        assert.deepEqual(boardSession(meta).setup.carriedMembers, found.secondCarry, `count ${count}: regenerating the saved receipt restores its carry`);
    }
});
