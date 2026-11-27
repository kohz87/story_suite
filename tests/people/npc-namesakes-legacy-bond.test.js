// A legacy meters entry kept under a shared name belongs to one dossier (ownerOf's, a living one before a dead one): the other namesake's dossier
// reads nothing of it, no locked or opened note's title or text.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ID, DEATH, cast, note, person } from './npc-alias-lines.helpers.js';
import { dossierMap } from '../../ui/select/people-parts.js';
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
            state.domains.people.bonds = { npcs: { npc_guard: legacy(unlocked) } };
            const owners = ownersOf(stored);
            assert.equal(owners.ownerOf(state.domains.people.bonds.npcs, 'npc_guard').id, 'npc_guard-a');
            assert.equal(owners.entryKey(state.domains.people.bonds.npcs, stored['npc_guard-a']), 'npc_guard');
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
    const npcs = { npc_guard: legacy([ID]) };
    assert.deepEqual(Object.keys(stored).map(id => owners.entryKey(npcs, { id, ...stored[id] })), ['npc_guard', null]);
    const own = { ...npcs, 'npc_guard-b': legacy([]) };
    assert.deepEqual(Object.keys(stored).map(id => owners.entryKey(own, { id, ...stored[id] })), ['npc_guard', 'npc_guard-b']);
});

test('the dead namesake\'s dossier page shows no meter change, ladder or note of the living one\'s entry', async () => {
    const h = await cast(guard('npc_guard-a', 'Living'), guard('npc_guard-b', 'Gone', dead));
    const state = structuredClone(h.store.head());
    const recent = { at: 1, n: 1, mv: { trust: 5 }, held: false, why: 'shared the watch' };
    state.domains.people.bonds = { npcs: { npc_guard: { ...legacy([ID]), lastEvent: { at: 1, events: [], log: [recent] } } } };
    const read = (name, args) => (h.registry.query(name) ? h.runQuery(name, args, state) : null);
    const asked = [];
    const pages = dossierMap((name, args) => { const out = read(name, args); if (name === 'npc.meters' || name === 'npc.next') asked.push([name, args.id, out?.key ?? out]); return out; });
    assert.deepEqual(asked.filter(([, id]) => id === 'npc_guard-b').map(row => row[2]), [null, null], JSON.stringify(asked));
    assert.equal(asked.find(([name, id]) => name === 'npc.meters' && id === 'npc_guard-a')[2], 'npc_guard', 'the living one still reads it');
    const gone = JSON.stringify(pages['npc_guard-b']);
    assert.ok(!/shared the watch|Living title|"trust":70/.test(gone), gone);
});
