// The Studio's gate model (studio/model/gate.js): reads and writes a gate through the game's own grammar, and its check says what the
// game's pack checker says. Run on every gate of Ersveil (the world pack) plus the shapes Ersveil does not use.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePack } from '../../../packs/validate.js';
import { checkGateText, composeGate, parseGate } from '../../../studio/model/gate.js';

const WORLD = JSON.parse(readFileSync(new URL('../../../examples/packs/ersveil-world/pack.json', import.meta.url), 'utf8'));
const CONTENT = WORLD.content;
const gates = [
    ...CONTENT.cast.flatMap(person => (person.secrets ?? []).filter(secret => secret.gate).map(secret => ({ gate: secret.gate, owner: person.id, path: `cast ${person.id}` }))),
    ...CONTENT.lore.filter(entry => entry.gate).map(entry => ({ gate: entry.gate, owner: null, path: `lore ${entry.id ?? entry.title}` })),
];

test('Ersveil has gates to read: secrets and hidden lore', () => {
    assert.ok(gates.some(item => item.owner) && gates.some(item => !item.owner));
    assert.ok(gates.some(item => /\bor\b/.test(item.gate)) && gates.some(item => /\band\b/.test(item.gate)));
});

test('every Ersveil gate reads, writes back to the same text, and passes the check', () => {
    for (const { gate, owner, path } of gates) {
        const read = parseGate(gate);
        assert.equal(read.ok, true, path);
        assert.equal(composeGate(read.groups), gate, path);
        assert.deepEqual(checkGateText(gate, CONTENT, owner), [], path);
    }
});

test('"and" binds tighter than "or": groups are the or-lists, terms the and-lists', () => {
    const { groups } = parseGate('fact:a and meter trust >= 5 of wren or place:keep and quote:hello and goodbye');
    assert.deepEqual(groups.map(group => group.map(term => term.type)), [['anchor', 'meter'], ['place', 'quote']]);
    assert.deepEqual(groups[1][1], { type: 'quote', text: 'hello and goodbye' });
});

test('every term shape reads to fields and writes back', () => {
    const cases = {
        'fired:siege': { type: 'anchor', kind: 'fired', id: 'siege' },
        'set:inquest-active@bluewatch-reach': { type: 'anchor', kind: 'set', id: 'inquest-active', ref: 'bluewatch-reach' },
        'learned:lore/crypt': { type: 'anchor', kind: 'learned', id: 'lore/crypt' },
        'place:keep': { type: 'place', id: 'keep' },
        'quote:well met': { type: 'quote', text: 'well met' },
        'stage >= 2': { type: 'stage', at: 2, named: false },
        'stage of wren >= "Trusted"': { type: 'stage', of: 'wren', at: 'Trusted', named: true },
        'meter trust >= 40': { type: 'meter', name: 'trust', at: 40 },
        'meter trust of wren >= -10': { type: 'meter', name: 'trust', of: 'wren', at: -10 },
    };
    for (const [text, term] of Object.entries(cases)) {
        const { ok, groups } = parseGate(text);
        assert.equal(ok, true, text);
        assert.deepEqual(groups, [[term]], text);
        assert.equal(composeGate(groups), text);
    }
});

test('the other order of a meter test is read and written in the canonical order', () => {
    const { groups } = parseGate('meter trust >= 40 of wren');
    assert.deepEqual(groups[0][0], { type: 'meter', name: 'trust', of: 'wren', at: 40 });
    assert.equal(composeGate(groups), 'meter trust of wren >= 40');
});

test('a term the grammar does not know is kept as raw, not dropped, and the gate is not ok', () => {
    for (const text of ['fact:a and stage 4', 'fired:x + 3 days', 'meter trust > 4', 'parenthesis (x)']) {
        const read = parseGate(text);
        assert.equal(read.ok, false, text);
        assert.equal(composeGate(read.groups), text);
    }
    assert.deepEqual(parseGate('   '), { ok: false, groups: [] });
    assert.deepEqual(parseGate(undefined), { ok: false, groups: [] });
    assert.equal(composeGate([[], []]), '');
});

test('anchor ids are checked against the pack', () => {
    const bad = checkGateText('fired:no-such-event', CONTENT, 'torka');
    assert.equal(bad.length, 1);
    assert.equal(bad[0].code, 'UNKNOWN_REF');
    assert.match(bad[0].message, /not an event in content\.worldEvents/);
    assert.match(checkGateText('place:nowhere', CONTENT)[0].message, /not a place of this pack/);
    assert.match(checkGateText('learned:lore/nope', CONTENT)[0].message, /not the id of a lore entry/);
    assert.match(checkGateText('died:nobody', CONTENT)[0].message, /not a cast id/);
});

test('a lore gate names the person; a secret gate is about its owner', () => {
    assert.match(checkGateText('meter trust >= 40', CONTENT)[0].message, /names the person/);
    assert.deepEqual(checkGateText('meter trust of torka >= 40', CONTENT), []);
    const owner = CONTENT.cast.find(person => (person.secrets ?? []).length).id;
    const other = CONTENT.cast.find(person => person.id !== owner).id;
    assert.match(checkGateText(`meter trust of ${other} >= 40`, CONTENT, owner)[0].message, /about its owner/);
    assert.equal(checkGateText('fact:x', CONTENT, 'not-a-person')[0].code, 'UNKNOWN_REF');
});

test('the Studio check and the game pack checker say the same about a bad gate', () => {
    const owner = CONTENT.cast.find(person => (person.secrets ?? []).length);
    const gateText = 'fired:no-such-event or meter nosuch >= 40 or stage >= 99 or place:nowhere';
    const pack = structuredClone(WORLD);
    const person = pack.content.cast.find(entry => entry.id === owner.id);
    person.secrets[0] = { id: owner.secrets[0].id, gate: gateText, text: 'x' };
    const result = validatePack(JSON.stringify(pack));
    // A bad secret gate refuses its person: the game says so as warnings, each with the same sentence after a fixed lead-in.
    const lead = /^Cast ".*?" was refused, the rest of the cast still loads: /;
    const game = (result.warnings ?? []).filter(problem => problem.path === `content.cast[${pack.content.cast.indexOf(person)}].secrets[0].gate`).map(problem => problem.message.replace(lead, ''));
    const studio = checkGateText(gateText, pack.content, owner.id).map(problem => problem.message);
    assert.equal(studio.length, 4);
    assert.deepEqual(studio, game);
});

test('a gate the game refuses for its shape is refused here too', () => {
    assert.match(checkGateText('', CONTENT)[0].message, /one non-empty string/);
    assert.match(checkGateText('fact:a and (fact:b)', CONTENT)[0].message, /no parentheses/);
    assert.match(checkGateText('meter trust > 4', CONTENT, null)[0].message, /not a stage or meter test/);
});
