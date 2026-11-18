// Learned secrets as anchors (spec v0.14.4 §3, ruling 32; acceptance tests 100-102, the engine's part): NPC State's opened notes of a
// dossier made from the pack become `learned:<cast id>/<secret id>` (and `fact:<writes_fact>`, written once) in the ledger; the step
// reads them as anchors from the next step on, never in the message that recorded them.
import test from 'node:test';
import assert from 'node:assert/strict';

import { learnedAnchors, knownAnchors } from '../../../../modules/world/chronicle/world-daily/learned.js';
import { runDays } from '../../../../modules/world/daily/step.js';
import { markLedger, ledgerOf } from '../../../../modules/world/chronicle/conditions/ledger.js';
import { world } from './helpers.js';

const cast = [
    { kind: 'companion', id: 'temiwa', name: 'Temiwa', homeBase: 'Oakhollow', secrets: [{ id: 'page', gate: 'meter trust >= 40', text: 'The last rite was forged.', writes_fact: 'last-rite-proof' }] },
    { kind: 'figure', id: 'durvald', name: 'Durvald', homeBase: 'Town', secrets: [{ id: 'collars', gate: 'quote:collars', text: 'He made the collars.', writes_fact: 'binding-exposed' }, { id: 'ledger', gate: 'quote:ledger', text: 'He sold them to the Veil.', writes_fact: 'binding-exposed' }] },
];
const people = unlocked => ({
    npcs: {
        npc_temiwa: { name: 'Temiwa', castFrom: { key: 'ersveil:temiwa', id: 'temiwa' }, secrets: [{ id: 'sec_aaaaaaaa', text: 'The last rite was forged.' }] },
        npc_durvald: { name: 'Durvald', castFrom: { key: 'ersveil:durvald', id: 'durvald' }, secrets: [{ id: 'collars', text: 'x' }, { id: 'ledger', text: 'y' }] },
    },
    bonds: { npcs: { npc_temiwa: { unlocked: unlocked.temiwa ?? [] }, npc_durvald: { unlocked: unlocked.durvald ?? [] } } },
});

test('test 102: an opened note matched by text or id makes the learned anchor and writes its fact once; nothing opened, nothing', () => {
    assert.deepEqual(learnedAnchors(people({}), cast), []);
    assert.deepEqual(learnedAnchors(people({ temiwa: ['sec_aaaaaaaa'] }), cast), ['learned:temiwa/page', 'fact:last-rite-proof'], 'matched by its text');
    assert.deepEqual(learnedAnchors(people({ durvald: ['collars', 'ledger'] }), cast), ['learned:durvald/collars', 'fact:binding-exposed', 'learned:durvald/ledger'], 'two secrets, one fact: written once');
    const known = new Set(['learned:durvald/collars', 'fact:binding-exposed']);
    assert.deepEqual(learnedAnchors(people({ durvald: ['collars', 'ledger'] }), cast, known), ['learned:durvald/ledger'], 'already recorded: not again; the fact changes nothing');
    const chronicle = {};
    markLedger(chronicle, { day: 5, anchors: ['learned:temiwa/page'] });
    assert.deepEqual([...knownAnchors(chronicle)], ['learned:temiwa/page'], 'the ledger counts as recorded');
});

test('tests 100-101: an event requiring the learned anchor is Dormant before it, not eligible in the message that recorded it, Eligible from the next step', () => {
    const war = { id: 'war', kind: 'one-off', certainty: 'set-in-motion', where: ['Valegard'], requires: ['learned:temiwa/page'], window: { after: 'start', within: '30 days' }, ends_when: 'instant', summary: 'War.' };
    const w = world({ cast, events: [war] });
    const step = (state, today, marks = null) => runDays({ state, table: {}, world: w, today, seed: 's', marks, draw: () => 0 });
    let out = step(null, 1);
    assert.notEqual(out.daily.events.war?.state, 'active', 'unlearned: not fired');
    // The reveal is recorded after the reply's own step (the hook orders it last), so the step on that reply did not see it.
    const chronicle = {};
    markLedger(chronicle, { day: 1, anchors: ['learned:temiwa/page'] });
    out = step(out.daily, 2, ledgerOf(chronicle.ledger));
    assert.equal(out.daily.events.war.state, 'ended', 'from the next step on: eligible, and (set in motion) it fires');
    assert.deepEqual(out.daily.anchors['learned:temiwa/page'], [1]);
    // A swipe or delete of the reveal removes the ledger slot with its reply: the same step without it leaves the event waiting.
    const again = step(step(null, 1).daily, 2, null);
    assert.notEqual(again.daily.events.war?.state, 'ended', 'without the reveal: still not eligible');
});

test('a bonds record keyed apart from the dossier (made before it) is found by the person\'s name', () => {
    const state = people({});
    state.bonds.npcs = { npc_other: { name: 'Temiwa', unlocked: ['sec_aaaaaaaa'] } };
    assert.deepEqual(learnedAnchors(state, cast), ['learned:temiwa/page', 'fact:last-rite-proof']);
});
