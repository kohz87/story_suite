// An alias that is another person's name never lands on that person's meters entry (the owner's dossier alias leak, 27 Nov): Bo, with no
// entry of his own and "Ana" among his aliases, must not read or write Ana's meters, stages or opened notes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNpcRecords } from '../../modules/people/meters/npc-meters-parts/records.js';
import { findNpcKey } from '../../modules/people/meters/npc-meters-slice.js';

const dossiers = {
    npc_ana: { id: 'npc_ana', name: 'Ana', aliases: [] },
    npc_bo: { id: 'npc_bo', name: 'Bo', aliases: ['Ana'] },
};
const resolve = label => dossiers[label] ?? Object.values(dossiers).find(d => d.name === label) ?? Object.values(dossiers).find(d => d.aliases.includes(label)) ?? null;
const records = () => createNpcRecords({ resolve, setupFor: () => ({}), rulesFor: () => [], rungsFor: () => [] });
const bonds = () => ({ npc_ana: { name: 'Ana', meters: { trust: 20 }, stages: {}, unlocked: ['sec_cccccccc'], milestones: {} } });

test('Bo, with no entry of his own and Ana as an alias, gets his own key, not Ana\'s', () => {
    const { identify } = records();
    assert.equal(identify(bonds(), 'Bo').key, 'npc_bo');
    assert.equal(identify(bonds(), 'Ana').key, 'npc_ana', 'Ana still finds her own entry');
});

test('an entry found by name under a key that is no dossier\'s own id (an older record) is still used', () => {
    const { identify } = records();
    const npcs = { npc_old: { name: 'Bo', meters: { trust: 5 }, stages: {}, unlocked: [], milestones: {} } };
    assert.equal(identify(npcs, 'Bo').key, 'npc_old');
});

test('findNpcKey skips a taken key when matching names and aliases, and still takes an id given outright', () => {
    assert.equal(findNpcKey(bonds(), ['Bo', 'Ana']), 'npc_ana');
    assert.equal(findNpcKey(bonds(), ['Bo', 'Ana'], new Set(['npc_ana'])), null);
    assert.equal(findNpcKey(bonds(), ['npc_ana'], new Set(['npc_ana'])), 'npc_ana');
});
