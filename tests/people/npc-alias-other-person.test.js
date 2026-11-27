// An alias that is another person's name never lands on that person's meters entry (the owner's dossier alias leak, 27 Nov): Bo, with no
// entry of his own and "Ana" among his aliases, must not read or write Ana's meters, stages or opened notes. The record helpers alone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNpcRecords } from '../../modules/people/meters/npc-meters-parts/records.js';
import { ownersOf } from '../../modules/people/meters/npc-meters-parts/owners.js';
import { resolveDossierTarget } from '../../modules/people/npc-api/dossier-target.js';
import { findNpcKey } from '../../modules/people/meters/npc-meters-slice.js';

const people = (ana = {}) => ({
    npc_ana: { id: 'npc_ana', name: 'Ana', aliases: [], ...ana },
    npc_bo: { id: 'npc_bo', name: 'Bo', aliases: ['ana'] },
});
// The live lookup as the host has it: the dead and archived are out of reach, even by id.
const identifier = stored => {
    const list = Object.values(stored);
    const resolve = label => stored[resolveDossierTarget(list, label)] ?? null;
    const { identify } = createNpcRecords({ resolve, setupFor: () => ({}), rulesFor: () => [], rungsFor: () => [] });
    return (npcs, label) => identify(npcs, label, ownersOf(stored));
};
const entry = name => ({ name, meters: { trust: 5 }, stages: {}, unlocked: [], milestones: {} });
const states = [['alive', {}], ['archived', { archived: true }], ['confirmed dead', { archived: true, lifeState: 'deceased', lifeStateCertainty: 'explicit' }]];

for (const [state, ana] of states) {
    test(`Ana ${state}: Bo never gets her entry, and her name never gets his`, () => {
        const identify = identifier(people(ana));
        assert.equal(identify({ npc_ana: entry('Ana') }, 'Bo').key, 'npc_bo');
        assert.equal(identify({ npc_ana: entry('Ana') }, 'Ana').key, 'npc_ana');
        assert.equal(identify({ npc_bo: entry('Bo') }, 'Ana').key, 'npc_ana');
    });
    test(`Ana ${state}, her entry under an older key: Bo's alias does not take it, her name does`, () => {
        const identify = identifier(people(ana));
        assert.equal(identify({ npc_old: entry('Ana') }, 'Bo').key, 'npc_bo');
        assert.equal(identify({ npc_old: entry('Ana') }, 'Ana').key, 'npc_old');
    });
}

test('an entry found by a person\'s own name or another alias, under a key that is no dossier\'s id, is still used', () => {
    const stored = people();
    stored.npc_bo.aliases.push('The Ferryman');
    const identify = identifier(stored);
    assert.equal(identify({ npc_old: entry('Bo') }, 'Bo').key, 'npc_old');
    assert.equal(identify({ npc_older: entry('The Ferryman') }, 'Bo').key, 'npc_older');
    assert.equal(identify({ npc_older: entry('The Ferryman') }, 'npc_older').key, 'npc_older', 'a key asked for outright');
});

test('an entry under another dossier\'s id is that dossier\'s, whatever name it carries', () => {
    const owners = ownersOf(people());
    assert.equal(owners.entryKey({ npc_ana: entry('Bo') }, people().npc_bo), null);
});

test('a new key is never a stored dossier\'s id (a renamed dossier keeps its own)', () => {
    const identify = identifier({ npc_ana: { id: 'npc_ana', name: 'Annie', aliases: [] } });
    assert.notEqual(identify({}, 'Ana').key, 'npc_ana');
});

test('findNpcKey skips a taken key when matching names and aliases, and still takes an id given outright', () => {
    const npcs = { npc_ana: entry('Ana') };
    assert.equal(findNpcKey(npcs, ['Bo', 'Ana']), 'npc_ana');
    assert.equal(findNpcKey(npcs, ['Bo', 'Ana'], new Set(['npc_ana'])), null);
    assert.equal(findNpcKey(npcs, ['npc_ana'], new Set(['npc_ana'])), 'npc_ana');
});
