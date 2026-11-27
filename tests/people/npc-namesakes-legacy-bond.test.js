// A legacy meters entry kept under a shared name belongs to one dossier (ownerOf's, a living one before a dead one): the other namesake's dossier
// reads nothing of it, no locked or opened note's title or text.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ID, DEATH, cast, note, person } from './npc-alias-lines.helpers.js';
import { ownersOf } from '../../modules/people/meters/npc-meters-parts/owners.js';

const guard = (id, who, extra = {}) => person(id, 'Guard', [], { secrets: [note(who)], ...extra });
const legacy = unlocked => ({ name: 'Guard', meters: { trust: 70, affection: 0, desire: 0, tension: 0 }, stages: {}, unlocked });
const { archived: _flag, ...dead } = DEATH;   // (a stored dossier carries no archive flag)

for (const order of ['the living first', 'the dead first']) {
    test(`the dead namesake's dossier shows nothing of the living one's entry (${order})`, async () => {
        const living = guard('npc_guard-a', 'Living');
        const gone = guard('npc_guard-b', 'Gone', dead);
        const h = await cast(...(order === 'the living first' ? [living, gone] : [gone, living]));
        const stored = h.store.head().domains.people.npcs;
        for (const unlocked of [[ID], []]) {
            const state = structuredClone(h.store.head());
            state.domains.people.bonds = { npcs: { guard: legacy(unlocked) } };
            const owners = ownersOf(stored);
            assert.equal(owners.ownerOf(state.domains.people.bonds.npcs, 'guard').id, 'npc_guard-a');
            assert.equal(owners.entryKey(state.domains.people.bonds.npcs, stored['npc_guard-a']), 'guard');
            assert.equal(owners.entryKey(state.domains.people.bonds.npcs, stored['npc_guard-b']), null);
            assert.deepEqual(h.runQuery('npc.cast', { departed: true }, state), [], 'nothing of the dead');
            assert.equal(h.runQuery('npc.meters', { id: 'npc_guard-b', name: 'Guard' }, state), null);
            const [row, ...more] = h.runQuery('npc.cast', {}, state);
            assert.deepEqual([row.name, more.length, row.bars.find(bar => bar.id === 'trust').value], ['Guard', 0, 70]);
            assert.ok(!JSON.stringify(row).includes('Gone '), JSON.stringify(row));
        }
    });
}

test('of two living namesakes only the one the entry is assigned to reads it; another entry of their own is still found', () => {
    const stored = { 'npc_guard-a': { name: 'Guard' }, 'npc_guard-b': { name: 'Guard' } };
    const owners = ownersOf(stored);
    const npcs = { guard: legacy([ID]) };
    assert.deepEqual(Object.keys(stored).map(id => owners.entryKey(npcs, { id, ...stored[id] })), ['guard', null]);
    const own = { ...npcs, 'npc_guard-b': legacy([]) };
    assert.deepEqual(Object.keys(stored).map(id => owners.entryKey(own, { id, ...stored[id] })), ['guard', 'npc_guard-b']);
});
