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
const WOLF = form('wolf', 'Grey fur.');
const RENAME = { id: 'npc_g1', name: 'Mira Vell', aliases: ['Mira'] };
const GUARD_ROW = { id: 'npc_g1', name: 'Guard', ...ARMOR, ...BORN };

// stored people, the scan's lists (`key`: the list under test) and the kept record that must get the row
const CASES = {
    'an older record the folded one has as an alias': {
        npcs: () => [record('npc_x', 'Tomas', { createdAt: 1 }), record('npc_g1', 'Guard', { createdAt: 2, aliases: ['Tomas'] }), record('npc_g2', 'Guard', { createdAt: 3 })],
        scan: key => ({ [key]: [GUARD_ROW] }), kept: 'npc_x', shown: 'armored',
    },
    'an older record of the same name, by a rename': {
        npcs: () => [record('npc_g1', 'Mira', { createdAt: 2 }), record('npc_g2', 'Mira', { createdAt: 1 })],
        // (the rename that makes the fold stays in `npcs`; the data is on it, or in a profile update of its own)
        scan: key => (key === 'npcs' ? { npcs: [{ ...RENAME, ...WOLF, ...BORN }] }
            : { npcs: [{ ...RENAME, sameIndividual: true }], profileUpdates: [{ id: 'npc_g1', name: 'Mira', ...WOLF, ...BORN }] }), kept: 'npc_g2', shown: 'wolf',
    },
    'a fold the same scan makes': {
        npcs: () => [record('npc_x', 'Tomas', { createdAt: 1 }), record('npc_g1', 'Guard', { createdAt: 2 }), record('npc_g2', 'Guard', { createdAt: 3 })],
        scan: key => (key === 'npcs' ? { npcs: [GUARD_ROW, { id: 'npc_x', name: 'Tomas', aliases: ['Guard'] }] }
            : { profileUpdates: [GUARD_ROW], npcs: [{ id: 'npc_x', name: 'Tomas', aliases: ['Guard'] }] }), kept: 'npc_x', shown: 'armored',
    },
};

for (const [what, { npcs, scan, kept, shown }] of Object.entries(CASES)) {
    test(`a tied row reaches the kept record: ${what}`, () => {
        for (const key of ['npcs', 'profileUpdates']) for (const options of MODES) {
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

test('a tied appearance refine reaches the kept record in the words it came in', () => {
    const text = 'a tall guard with a SCARRED chin and grey eyes';
    const refine = { appearance: text, appearanceState: 'refine' };
    const { npcs, kept } = CASES['an older record of the same name, by a rename'];
    for (const scan of [{ npcs: [{ ...RENAME, ...refine }] }, { npcs: [RENAME], profileUpdates: [{ id: 'npc_g1', name: 'Mira', ...refine }] }]) {
        for (const options of MODES) {
            const result = mergeScanResult({ npcs: npcs(), turn: 5 }, structuredClone(scan), { turn: 5, sourceMessageId: 9, ...options });
            assert.equal(result.state.npcs.find(npc => npc.id === kept).appearance, text);
        }
    }
});

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

// What the merge before the namesake rule gave the kept Mira of the rename shape: the row reached that record by its name.
const CLAIMS = ['is always gruff and curt', 'speaks in short clipped sentences'];
const GRUFF = 'Gruff and curt, short clipped sentences.';
const PROOF = 'Mira is always gruff and curt.';
const durable = (state, developmentScale) => ({
    personality: GRUFF, personalityState: state, personalityReason: PROOF, speech: GRUFF, speechState: state, speechReason: PROOF,
    developmentScale, developmentReason: PROOF, evidence: { personality: CLAIMS, speech: CLAIMS },
});
const seen = claim => ({ concept: claim, firstTurn: 6, lastTurn: 6, observationCount: 1, sourceMessageIds: [9], turns: [6], evidenceSamples: [claim], latestEvidence: claim });
const pending = (baselineKey, baseline) => ({ version: 2, epoch: 0, [baselineKey]: baseline, baselineTurn: null, baselineSourceMessageId: null, concepts: CLAIMS.map(seen) });
const miras = (older = {}) => [record('npc_g1', 'Mira', { createdAt: 2 }), record('npc_g2', 'Mira', { createdAt: 1, ...older })];
const mergeMiras = (npcs, scan, options) => mergeScanResult({ npcs, turn: 5 }, structuredClone(scan),
    { turn: 6, sourceMessageId: 9, developmentContext: `${PROOF} Mira speaks in short clipped sentences.`, ...options });

test('a tied profile update gives the kept record its Personality and Speech development', () => {
    for (const [state, scale] of [['establish', 'explicit'], ['evolve', 'explicit'], ['refine', 'gradual'], ['establish', '']]) {
        const scan = { npcs: [{ ...RENAME, sameIndividual: true }], profileUpdates: [{ id: 'npc_g1', name: 'Mira', ...durable(state, scale) }] };
        // (an explicit evolve applies the Personality at once, so its ledger starts over)
        const personality = state === 'evolve'
            ? { version: 2, epoch: 1, baselinePersonality: GRUFF, baselineTurn: 6, baselineSourceMessageId: 9, concepts: [] }
            : pending('baselinePersonality', GRUFF);
        for (const options of MODES) {
            const { state: after } = mergeMiras(miras(), scan, options);
            const label = `${state} ${scale} ${JSON.stringify(options)}`;
            assert.deepEqual(after.npcs.map(npc => npc.id), ['npc_g2'], label);
            assert.deepEqual(after.npcs[0].personalityDevelopment, personality, label);
            assert.deepEqual(after.npcs[0].speechDevelopment, pending('baselineSpeech', ''), label);
        }
    }
});

test('a tied row\'s development reaches no namesake that outlives the fold', () => {
    const { npcs } = CASES['an older record the folded one has as an alias'];
    const scan = { profileUpdates: [{ id: 'npc_g1', name: 'Guard', ...durable('refine', 'gradual') }] };
    for (const options of MODES) {
        const result = mergeMiras(npcs(), scan, options);
        assert.ok(result.report.deduplicated.some(item => item.removedId === 'npc_g1' && item.keptId === 'npc_x'));
        const other = result.state.npcs.find(npc => npc.id === 'npc_g2');
        assert.deepEqual([other.personalityDevelopment, other.speechDevelopment], [undefined, undefined], JSON.stringify(options));
    }
});

test('the kept record\'s development is its own: its earlier ledger goes on, and a row its name never answered to adds nothing', () => {
    const update = { id: 'npc_g1', name: 'Mira', ...durable('refine', 'gradual') };
    for (const options of MODES) {
        const older = { speechDevelopment: { version: 2, epoch: 3, baselineSpeech: '', concepts: [{ ...seen('talks at great length'), sourceMessageIds: [2], turns: [2] }] } };
        const kept = mergeMiras(miras(older), { npcs: [{ ...RENAME, sameIndividual: true }], profileUpdates: [update] }, options).state.npcs[0];
        assert.equal(kept.speechDevelopment.epoch, 3);
        assert.deepEqual(kept.speechDevelopment.concepts.map(concept => concept.concept), ['talks at great length', ...CLAIMS]);
        // the data on the renaming row itself ("Mira Vell"): no stored Mira answered to that name before the scan
        const renamed = mergeMiras(miras(), { npcs: [{ ...RENAME, sameIndividual: true, ...durable('refine', 'gradual') }] }, options).state.npcs[0];
        assert.deepEqual([renamed.personalityDevelopment, renamed.speechDevelopment], [undefined, undefined]);
    }
});
