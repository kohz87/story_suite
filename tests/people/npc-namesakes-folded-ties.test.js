// A row tied to a record that the merge then folds into another is the kept record's row from there on; it still reaches no other namesake. Also the two
// "own row" lookups of the tie steps: a row tied to one namesake is not the other's.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNpcRecord, mergeScanResult } from '../../modules/people/core/core.js';
import { followFoldedTies, settleScanRows } from '../../modules/people/core/core-merge-namesakes.js';
import { applyKeyRelationshipEdges } from '../../modules/people/core/core-keyrel.js';
import { reconcileSocialState } from '../../modules/people/social/social.js';
import { scanMoodNumbers } from '../../modules/people/calls/runtime-scan-helpers-parts/scan-results.js';

const record = (id, name, extra = {}) => ({ ...createNpcRecord(name, []), id, role: 'guard', ...extra });
const MODES = [{}, { keepNamesakeRows: true }, { historicalRead: true }];
const form = (name, appearance) => ({ appearanceForms: [{ name, appearance }], currentForm: name, currentFormState: 'select' });
const ARMOR = form('armored', 'A tall man in black plate armor.');
const BORN = { birthDate: { month: '05', day: 5, year: 1980 }, birthDateState: 'establish' };
const GUARD_ROW = { id: 'npc_g1', name: 'Guard', ...ARMOR, ...BORN };

// stored people, the scan's lists (`key`: the list under test) and the kept record that must get the row
const CASES = {
    'an older record the folded one has as an alias': {
        npcs: () => [record('npc_x', 'Tomas', { createdAt: 1 }), record('npc_g1', 'Guard', { createdAt: 2, aliases: ['Tomas'] }), record('npc_g2', 'Guard', { createdAt: 3 })],
        scan: key => ({ [key]: [GUARD_ROW] }), kept: 'npc_x', shown: 'armored',
    },
    'an older record of the same name, by a rename': {
        npcs: () => [record('npc_g1', 'Mira', { createdAt: 2 }), record('npc_g2', 'Mira', { createdAt: 1 })],
        scan: () => ({ npcs: [{ id: 'npc_g1', name: 'Mira Vell', aliases: ['Mira'], ...form('wolf', 'Grey fur.'), ...BORN }] }), kept: 'npc_g2', shown: 'wolf',
    },
    'a fold the same scan makes': {
        npcs: () => [record('npc_x', 'Tomas', { createdAt: 1 }), record('npc_g1', 'Guard', { createdAt: 2 }), record('npc_g2', 'Guard', { createdAt: 3 })],
        scan: key => (key === 'npcs' ? { npcs: [GUARD_ROW, { id: 'npc_x', name: 'Tomas', aliases: ['Guard'] }] }
            : { profileUpdates: [GUARD_ROW], npcs: [{ id: 'npc_x', name: 'Tomas', aliases: ['Guard'] }] }), kept: 'npc_x', shown: 'armored',
    },
};

for (const [what, { npcs, scan, kept, shown }] of Object.entries(CASES)) {
    test(`a tied row reaches the kept record: ${what}`, () => {
        for (const key of what.includes('rename') ? ['npcs'] : ['npcs', 'profileUpdates']) for (const options of MODES) {
            const input = structuredClone(scan(key));
            const result = mergeScanResult({ npcs: npcs(), turn: 5 }, input, { turn: 5, sourceMessageId: 9, ...options });
            const label = `${key} ${JSON.stringify(options)}`;
            assert.ok(result.report.deduplicated.some(item => item.removedId === 'npc_g1' && item.keptId === kept), label);
            const npc = result.state.npcs.find(item => item.id === kept);
            assert.deepEqual([npc.currentForm, npc.appearanceForms.length, npc.birthDate?.year, npc.birthDateSource], [shown, 1, 1980, 'established'], label);
            assert.match(npc.appearance, shown === 'wolf' ? /grey fur/i : /plate armor/i, label);
            for (const other of result.state.npcs.filter(item => item.id !== kept)) {
                assert.deepEqual([other.currentForm, other.appearanceForms.length, other.birthDateSource], ['', 0, 'generated'], `${label} ${other.id}`);
            }
            assert.deepEqual(input, scan(key), 'the scan handed in is not rewritten');
        }
    });
}

test('after the fold the runtime reads the row as the kept record\'s, chains followed, and the journaled rows stay as they were', () => {
    const npcs = [record('npc_x', 'Tomas'), record('npc_g1', 'Guard', { aliases: ['Tomas'] }), record('npc_g2', 'Guard')];
    const settled = settleScanRows(npcs, { npcs: [{ id: 'npc_g1', name: 'Guard', mood: 'wary', moodV: 1, moodA: 1, moodD: 1 }] }, []).scanResult;
    const before = structuredClone(settled);
    const folded = [{ keptId: 'npc_y', removedId: 'npc_g1' }, { keptId: 'npc_x', removedId: 'npc_y' }];
    const read = followFoldedTies(settled, folded);
    assert.equal(read.npcs[0].settledId, 'npc_x');
    assert.deepEqual([npcs[0], npcs[2]].map(npc => Boolean(scanMoodNumbers(read.npcs, npc, row => row?.mood))), [true, false]);
    assert.deepEqual(settled, before);
    for (const none of [[], undefined, [{ keptId: 'npc_x', removedId: 'npc_other' }]]) assert.equal(followFoldedTies(settled, none), settled);
});

const guards = () => [record('npc_g1', 'Guard'), record('npc_g2', 'Guard'), record('npc_m', 'Mara')];
const TIE = 'Mara — sister | trusts her';

test('edge application: a row tied to one Guard is not the other Guard\'s own row', () => {
    const next = { npcs: guards() };
    const scan = { npcs: [{ id: 'npc_g1', settledId: 'npc_g1', name: 'Guard', keyRelationships: [TIE] }],
        keyRelationshipEdges: ['npc_g1', 'npc_g2'].map(aId => ({ aId, bId: 'npc_m', aToB: 'sister' })) };
    applyKeyRelationshipEdges(next, scan, new Set(), { updated: [] });
    // g1's own row already holds the detailed tie, so the terse edge is held back for g1 alone
    assert.deepEqual(next.npcs.slice(0, 2).map(npc => npc.keyRelationships.length), [0, 1]);
});

test('social reconcile: a summary edge takes its detail from the row tied to its owner, also after a fold', () => {
    for (const [settledId, expected] of [['npc_g2', /trusts her/], ['npc_g1', null]]) {
        // (the row keeps its own id; only the tie says whose it is)
        const row = { id: settledId === 'npc_g2' ? 'npc_old' : 'npc_g2', settledId, name: 'Guard', keyRelationships: [TIE] };
        const { socialGraph } = reconcileSocialState({ npcs: guards() }, { scanResult: { npcs: [row], keyRelationshipEdges: [{ aId: 'npc_g2', bId: 'npc_m', aToB: 'sister' }] } });
        const edge = socialGraph.edges.find(item => [item.aId, item.bId].includes('npc_g2'));
        const detail = [edge.aDynamic, edge.bDynamic].join(' ');
        if (expected) assert.match(detail, expected);
        else assert.doesNotMatch(detail, /trusts her/);
    }
});
