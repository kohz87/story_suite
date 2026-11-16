import test from 'node:test';
import assert from 'node:assert/strict';
import { derivedFields, stubRecord, STUB_REASON } from '../../modules/people/meters/npc-lines-parts/derived.js';
import { factFields } from '../../modules/people/meters/npc-lines-parts/facts.js';
import { readStub, STUB_LOOK_MAX } from '../../modules/people/meters/npc-lines-parts/stub.js';
import { fillPolicy, fillFailureNote, queueFills, FILL_REASON } from '../../modules/people/meters/npc-lines-parts/fill-in.js';
import { buildBackfillPrompt } from '../../modules/people/core/core-prompts-targeted.js';
import { buildLinesRules } from '../../modules/people/core/core-prompts-lines-parts/rules.js';
import { queueNpcBackfillInState } from '../../modules/people/calls/runtime-scan-backfill.js';
import { normalizeAutomaticBackfillRequest, automaticBackfillStillRelevant } from '../../modules/people/calls/scan-context.js';

// N4: what code derives (NSD7), the fact normalisers (N3's deferred item), the stub reader, the fill-in rules and the two approved prompt lines.

test('derived fields: the identity kind follows the name, the reason and retention are code\'s, the summary of the bond is never a line\'s', () => {
    assert.equal(derivedFields({ name: 'Marta' }).identityKind, 'proper_name');
    assert.equal(derivedFields({ name: 'Guild Receptionist' }).identityKind, 'role_label');
    assert.equal(derivedFields({ name: 'Luna', identityKind: 'role_label' }, { name: 'Guild Receptionist', identityKind: 'role_label' }).identityKind, 'proper_name', 'a title that gained a name is a proper name again');
    assert.equal(derivedFields({ name: 'Marta' }).dossierReason, STUB_REASON);
    assert.equal(derivedFields({ name: 'Marta', dossierReason: 'met at the quay' }).dossierReason, 'met at the quay');
    assert.equal(derivedFields({ name: 'Marta', memories: ['a', 'b', 'c', 'd', 'e', 'f'] }).memoryRetention, 'top5');
    assert.equal(derivedFields({ name: 'Marta', memories: ['a'] }).memoryRetention, undefined);
    assert.equal(derivedFields({ name: 'Marta', relationshipSummary: 'adores you' }, { relationshipSummary: 'wary' }).relationshipSummary, 'wary');
    assert.equal(derivedFields({ name: 'Marta' }).relationshipSummary, '');
});

test('a stub record holds the role and the look exactly as written, and no clock', () => {
    const look = 'x'.repeat(STUB_LOOK_MAX);
    const a = stubRecord({ name: 'Marta', role: 'clerk', look }, 'npc_marta', undefined, 3);
    const b = stubRecord({ name: 'Marta', role: 'clerk', look }, 'npc_marta', undefined, 3);
    assert.equal(a.appearance, look);
    assert.equal(a.id, 'npc_marta');
    assert.deepEqual(a, b, 'the same line makes the same record');
    assert.equal(a.createdAt, 3);
});

test('readStub reads the role and the look from the line as written, colons and all; a look past 100 is cut with a note', () => {
    const line = { raw: '+ npc Marta | the harbour clerk | eyes: grey; a limp', name: 'Marta', text: 'x', labels: { eyes: 'grey; a limp' } };
    assert.deepEqual(readStub(line), { name: 'Marta', role: 'the harbour clerk', look: 'eyes: grey; a limp', problems: [] });
    assert.deepEqual(readStub({ raw: '+ npc Dov', name: 'Dov' }), { name: 'Dov', role: '', look: '', problems: [] });
    const long = readStub({ raw: `+ npc Dov | ferryman | ${'y'.repeat(130)}`, name: 'Dov' });
    assert.equal(long.look.length, 100);
    assert.match(long.problems[0], /look was cut to 100 characters/);
});

test('a line states a fact in the form the dossier keeps it: gender male or female, age a number, a birthday as the calendar reads it; the rest is a problem', () => {
    const got = factFields({ gender: 'Woman', age: '34 years old', birthday: 'Goldwane 4' }, {});
    assert.deepEqual(got.set, { gender: 'female', age: '34', birthday: 'Goldwane 4' });
    const bad = factFields({ gender: 'fluid', age: 'young', birthday: '' }, {});
    assert.deepEqual(bad.set, {});
    assert.match(bad.problems.join(' '), /gender: "fluid" is not male or female/);
    assert.match(bad.problems.join(' '), /age: "young" is not a story age/);
    assert.deepEqual(factFields({ gender: 'male' }, { gender: 'female' }).set, {}, 'written once');
});

test('the fill-in rules: its own call, no wait, one attempt (the request layer\'s compact retry is the one retry), a plain note, one request per person', () => {
    assert.deepEqual(fillPolicy({ reason: FILL_REASON }), { max: 1, cooldown: false, ownsCall: true });
    assert.deepEqual(fillPolicy({ reason: 'new-admission' }), { max: 3, cooldown: true, ownsCall: true }, 'unchanged for the old reasons');
    assert.deepEqual(fillPolicy({ reason: 'missed-participant' }), { max: 3, cooldown: true, ownsCall: false });
    assert.match(fillFailureNote('Wiz'), /the profile for Wiz could not be filled in\. The name, role and look from the story stay/);
    const state = {};
    queueFills(state, [{ id: 'npc_wiz', name: 'Wiz' }, { id: 'npc_chris', name: 'Chris' }], 4, queueNpcBackfillInState);
    assert.deepEqual(state.pendingBackfills.map(item => [item.reason, item.npcId, item.requestedMessageId]), [[FILL_REASON, 'npc_wiz', 4], [FILL_REASON, 'npc_chris', 4]]);
    for (const item of state.pendingBackfills) assert.ok(normalizeAutomaticBackfillRequest(item), 'the saved queue keeps it');
    assert.equal(automaticBackfillStillRelevant(state.pendingBackfills[0], { id: 'npc_wiz', name: 'Wiz' }, [{ id: 'npc_wiz', name: 'Wiz' }], ''), true);
});

test('the backfill prompt gets the quote line only when asked (the plain prompt is the same bytes as before)', () => {
    const base = { transcript: '[m1] Wiz grins.', targetName: 'Wiz', existingNpc: null };
    const plain = buildBackfillPrompt(base);
    const quoted = buildBackfillPrompt({ ...base, quoteFacts: true });
    const LINE = 'For every fact you write, quote the few words of the story that show it. Leave a field out when you have no quote for it.';
    assert.equal(buildBackfillPrompt({ ...base, quoteFacts: false }), plain);
    assert.ok(!plain.includes('quote the few words'));
    assert.equal(quoted.replace(`\n${LINE}`, ''), plain, 'the only difference is that one line');
});

test('the one-pass builder carries the approved NSD6 and NSD7 texts', () => {
    const rules = buildLinesRules({});
    assert.match(rules, /New people: the first time a named person appears who is not in the list above, write \+ npc Name \| role \| look\./);
    assert.match(rules, /at most 100 characters; leave it out for someone from the character card\./);
    assert.match(rules, /A title alone \(the guard\) is not a person until the story gives a name\./);
    assert.match(rules, /Write only what changed in this reply\. Never write "keep", an empty value, a summary of the relationship, or a field again with the same value\. Match people by the names in the list above; a person already listed with only a title who now has a name is the same person: use the listed name\./);
});
