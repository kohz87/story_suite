import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
    createNpcRecord,
    mergeScanResult,
    normalizeNpcRecord,
    npcCurrentlyAbsentInText,
    npcNamedInText,
    relationshipSummaryConsistent,
    setActiveCalendarConfig,
} from '../../modules/people/core/core.js';
import {
    BRANCH_LINEAGE_VERSION,
    applyRollbackUndo,
    buildRollbackUndo,
    ensureBranchParentAnchor,
    ensureRollbackJournalBaseline,
    recordBranchCheckpoint,
    reconcileBranchState,
} from '../../modules/people/legacy/branch.js';
import { preserveUserNpcMetadata } from '../../modules/people/legacy/branch-core.js';
import { mergeImportedDossierState } from '../../modules/people/bundle/bundle.js';
import { applyManualKeyRelationshipEdit, inverseSocialRelation, reconcileSocialState, socialRelationFamily } from '../../modules/people/social/social.js';
import { retireNpcStateDataFile } from '../../modules/people/storage/storage.js';

const CALENDAR = { era: 'CR', months: [{ name: 'Redleaf', days: 30 }, { name: 'Sunwane', days: 31 }], currentYear: 821, currentMonth: 'Redleaf', currentDay: 16 };

function branchState(npcs) {
    const state = {
        npcs, candidates: [], pendingBackfills: [], socialGraph: { edges: [], unresolved: [] }, dismissed: [],
        turn: 0, assistantSinceScan: 0, lastScanAt: 0, lastScannedMessageId: null, scanCount: 0, checkpoints: [], inlineCards: [],
        lineage: [], branchLineageVersion: BRANCH_LINEAGE_VERSION, portraitAssets: {}, userDismissedGroups: [],
    };
    ensureRollbackJournalBaseline(state, []);
    return state;
}

function play(state, chat, count, change = () => {}) {
    for (let i = 1; i <= count; i += 1) {
        chat.push({ is_user: true, is_system: false, name: 'User', mes: `user-${i}` }, { is_user: false, is_system: false, name: 'Narrator', mes: `assistant-${i}` });
        const messageId = chat.length - 1;
        ensureBranchParentAnchor(state, chat, messageId, 'assistant-parent');
        state.turn += 1;
        change(state, i, messageId);
        recordBranchCheckpoint(state, chat, messageId, 'scan');
    }
}

test('RB87-01 (storage): a lost or unreadable retirement acknowledgement is uncertain; a 4xx rejection is not', async () => {
    const pointer = { name: 'x.json', path: '/user/files/x.json', revision: 0 };
    const run = upload => retireNpcStateDataFile({
        chatKey: 'chat:a.png:x', pointer,
        fetchFn: async url => (url === '/api/files/upload' ? upload() : { ok: false, status: 404, text: async () => '' }),
    });
    await assert.rejects(run(() => { throw new TypeError('network connection lost'); }), error => error.retirementUncertain === true);
    await assert.rejects(run(() => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad json'); }, text: async () => '' })), error => error.retirementUncertain === true);
    await assert.rejects(run(() => ({ ok: false, status: 502, text: async () => 'bad gateway' })), error => error.retirementUncertain === true);
    await assert.rejects(run(() => ({ ok: false, status: 403, text: async () => 'forbidden' })), error => error.retirementUncertain !== true);
});

test('RB87-05: an evolve label cannot carry a protected morality reversal, but still admits reworded development', () => {
    const run = (personality, reason = 'Her confidence has become a recurring habit.') => {
        const npc = createNpcRecord('Kessa');
        npc.id = 'npc_kessa';
        npc.personality = 'Kind and compassionate; avoids needless harm.';
        let state = { npcs: [npc], candidates: [], turn: 1 };
        const observations = [
            'confidence: speaks up first at the council table.',
            'confidence: takes charge of the caravan without being asked.',
            'confidence: argues her case plainly before the magistrate.',
        ];
        let report;
        observations.forEach((observation, index) => {
            const result = mergeScanResult(state, {
                npcs: [],
                profileUpdates: [{
                    id: npc.id,
                    evidence: { personality: [`[m${10 + index * 2}] ${observation}`] },
                    personalityState: 'evolve', personality, personalityReason: reason,
                    developmentScale: 'gradual', developmentReason: 'Recurring scenes show the change.',
                }],
            }, { turn: 2 + index * 2, sourceMessageId: 10 + index * 2 });
            state = result.state;
            report = result.report;
        });
        return { npc: state.npcs[0], report };
    };
    assert.equal(run('Cruel and sadistic; enjoys needless suffering.').npc.personality, 'Kind and compassionate; avoids needless harm.');
    const reworded = run('Self-assured and forthright; kind and compassionate.');
    assert.equal(reworded.npc.personality, 'Self-assured and forthright; kind and compassionate.', 'a reworded non-moral evolve still develops');
    const applied = JSON.stringify(reworded.report || {});
    assert.doesNotMatch(applied, /"authority":"model-evolve"[^}]*"candidateGrounded":true/, 'a label-only admission is not reported as grounded');
});

test('RB87-06: Speech ignores another person\'s voice and negated traits, and keeps plain attributed voice', () => {
    const scan = (speech, context, speechState = 'refine') => {
        const mira = createNpcRecord('Mira');
        mira.id = 'npc_mira';
        mira.speech = speech;
        const noela = createNpcRecord('Noela');
        noela.id = 'npc_noela';
        return mergeScanResult({ npcs: [mira, noela], candidates: [], turn: 3 }, {
            npcs: [{ id: 'npc_mira', name: 'Mira', speech: 'Speaks quietly, warmly and gently.', speechState }],
        }, { developmentContext: context }).state.npcs[0].speech;
    };
    assert.equal(scan('Speaks quietly.', 'Mira does not speak warmly or gently.'), 'Speaks quietly.');
    assert.equal(scan('Speaks quietly.', 'Mira listens to Noela, who always speaks warmly and gently.'), 'Speaks quietly.');
    assert.equal(scan('', 'Mira is reserved. Noela always speaks warmly and gently.'), '');
    assert.match(scan('', 'Mira speaks quietly, warmly and gently to the child.'), /warmly and gently/, 'her own voice still seeds');
    assert.match(scan('Speaks quietly.', '"Rest now," Mira says quietly, warmly and gently.'), /warmly and gently/, 'her own voice still refines');
});

test('RB87-07: a birth correction needs an affirmative birth fact about the NPC, which may span two sentences', () => {
    setActiveCalendarConfig(CALENDAR);
    try {
        const scan = text => {
            const npc = createNpcRecord('Mira');
            npc.id = 'npc_mira';
            npc.age = '20';
            npc.birthDate = { era: 'CR', year: 801, month: 'Redleaf', day: 1 };
            npc.birthDateSource = 'established';
            npc.birthDateYearSource = 'established';
            return mergeScanResult({ npcs: [npc], candidates: [], turn: 3 }, {
                npcs: [{ id: 'npc_mira', name: 'Mira', birthDate: { era: 'CR', year: 790, month: 'Redleaf', day: 2 }, birthDateState: 'correct' }],
            }, { developmentContext: text }).state.npcs[0];
        };
        for (const text of [
            'Mira visits Noela, who was born on Redleaf 2 in CR790.',
            'Mira signed a contract on Redleaf 2 in CR790.',
            'If Mira had been born on Redleaf 2 in CR790, she would be older.',
            'Mira shows a forged record saying she was born on Redleaf 2 in CR790.',
        ]) {
            assert.equal(scan(text).birthDate.year, 801, text);
            assert.equal(scan(text).age, '20', text);
        }
        assert.equal(scan('Mira was born in CR790. Her birthday is Redleaf 2.').birthDate.year, 790, 'split affirmative facts are supported');
        assert.equal(scan('Mira was born on Redleaf 2 in CR790.').birthDate.year, 790);
    } finally {
        setActiveCalendarConfig(null);
    }
});

test('RB87-08: only an affirmative current birthday of the NPC rolls a yearless age over', () => {
    setActiveCalendarConfig({ era: CALENDAR.era, months: CALENDAR.months });
    try {
        const run = text => {
            const npc = normalizeNpcRecord({
                id: 'npc_mira', name: 'Mira', age: '20', apparentAge: '~20',
                birthDate: { era: '', year: null, month: 'Redleaf', day: 16 }, birthDateSource: 'established',
            });
            return mergeScanResult({ npcs: [npc], candidates: [], turn: 3, socialGraph: { version: 1, edges: [], unresolved: [] } }, { npcs: [] },
                { sourceMessageId: 9, developmentContext: `<World_State>Time | CR822, Redleaf 16 | evening</World_State> ${text}` }).state.npcs[0];
        };
        for (const text of [
            'Mira celebrates Noela\'s birthday.',
            'Mira says today is not her birthday.',
            'Is it Mira\'s birthday today?',
            'Mira remembers her birthday last year.',
            'Mira says Noela turns 18 today.',
        ]) assert.equal(run(text).age, '20', text);
        assert.equal(run('Mira celebrates her birthday.').age, '21');
    } finally {
        setActiveCalendarConfig(null);
    }
});

test('RB87-09: another person\'s absence and a resolved absence do not keep a participating NPC away', () => {
    const mira = { name: 'Mira Deep' };
    assert.equal(npcCurrentlyAbsentInText(mira, 'Mira Deep smiles because Noela is not here, then greets you at the records counter.'), false);
    assert.equal(npcCurrentlyAbsentInText(mira, 'Mira Deep was not here an hour ago, but now steps inside.'), false);
    assert.equal(npcCurrentlyAbsentInText(mira, 'Mira Deep has already left. Then she returns and sits beside you.'), false);
    assert.equal(npcCurrentlyAbsentInText(mira, 'Mira Deep remains at her distant home and is not here.'), true);
});

test('RB87-10: manual sibling suppression survives an unrelated import and an unrelated rollback', () => {
    const npc = (name, gender, bonds) => normalizeNpcRecord({ id: `npc_${name.toLowerCase()}`, name, gender, species: 'human', keyRelationships: bonds });
    let state = reconcileSocialState({ npcs: [npc('Mira', 'female', ['Orson — father']), npc('Noela', 'female', ['Orson — father']), npc('Orson', 'male', [])], socialGraph: { edges: [], unresolved: [] } }, {}).state;
    const before = [...state.npcs[0].keyRelationships];
    state.npcs[0].keyRelationships = ['Orson — father'];
    applyManualKeyRelationshipEdit(state, 'npc_mira', before, state.npcs[0].keyRelationships, {});
    state = reconcileSocialState(state, {}).state;
    assert.ok(state.socialGraph.suppressed?.length, 'suppression recorded');

    const imported = mergeImportedDossierState(state, { npcs: [npc('Keeper', 'male', [])], socialGraph: { edges: [], unresolved: [] } });
    assert.ok(imported.socialGraph.suppressed?.length, 'an unrelated import keeps the suppression');
    const afterImport = reconcileSocialState(imported, {}).state;
    assert.ok(!afterImport.npcs.find(item => item.name === 'Mira').keyRelationships.some(entry => /^Noela/.test(entry)));

    const later = structuredClone(state);
    later.socialGraph.edges.push({ id: 'edge_keeper_orson', aId: 'npc_orson', bId: 'npc_keeper', aToB: 'friend', bToA: 'friend', provenance: 'explicit' });
    const undo = buildRollbackUndo(structuredClone(state), later);
    const rolledBack = applyRollbackUndo(structuredClone(later), undo).state;
    assert.ok(!rolledBack.socialGraph.edges.some(edge => edge.id === 'edge_keeper_orson'), 'the later edge is undone');
    assert.ok(rolledBack.socialGraph.suppressed?.length, 'an unrelated graph undo keeps the suppression');
});

test('RB87-11: in-law ties are not parenthood and do not infer siblings', () => {
    assert.equal(socialRelationFamily('father-in-law'), 'parent-in-law');
    assert.equal(inverseSocialRelation('father-in-law'), 'child-in-law');
    assert.equal(inverseSocialRelation('brother-in-law'), 'sibling-in-law');
    const npc = (name, gender, bonds) => normalizeNpcRecord({ id: `npc_${name.toLowerCase()}`, name, gender, species: 'human', keyRelationships: bonds });
    const state = reconcileSocialState({ npcs: [npc('Mira', 'female', ['Orson — father-in-law']), npc('Noela', 'female', ['Orson — father-in-law']), npc('Orson', 'male', [])], socialGraph: { edges: [], unresolved: [] } }, {}).state;
    const [mira, noela, orson] = state.npcs;
    assert.ok(!mira.keyRelationships.some(entry => /^Noela/.test(entry)), mira.keyRelationships.join(' | '));
    assert.ok(!noela.keyRelationships.some(entry => /^Mira/.test(entry)));
    assert.ok(!orson.keyRelationships.some(entry => /— child(?!-in-law)\b/.test(entry)), orson.keyRelationships.join(' | '));
    const control = reconcileSocialState({ npcs: [npc('Mira', 'female', ['Orson — father']), npc('Noela', 'female', ['Orson — father']), npc('Orson', 'male', [])], socialGraph: { edges: [], unresolved: [] } }, {}).state;
    assert.ok(control.npcs[0].keyRelationships.some(entry => /^Noela — sibling/.test(entry)), 'a shared father still infers siblings');
});

test('RB87-12: rollback keeps a manually saved portrait seed, including zero', () => {
    for (const seed of [999, 0]) {
        const restored = preserveUserNpcMetadata([{ id: 'npc_mira', name: 'Mira', portraitSeed: 417 }], [{ id: 'npc_mira', name: 'Mira', portraitSeed: seed }]);
        assert.equal(restored[0].portraitSeed, seed);
    }
});

test('RB87-13: a long alias does not hide a separately named short-name NPC', () => {
    const mira = Object.assign(createNpcRecord('Mira'), { id: 'npc_mira' });
    const valen = Object.assign(createNpcRecord('Mira Valen'), { id: 'npc_valen', aliases: ['Lady Mira Valen'] });
    const roster = [mira, valen];
    const named = text => roster.filter(npc => npcNamedInText(npc, text, roster)).map(npc => npc.name);
    assert.deepEqual(named('I ask Lady Mira Valen and Mira to join me.'), ['Mira', 'Mira Valen']);
    assert.deepEqual(named('I ask Lady Mira Valen to join me.'), ['Mira Valen']);
    assert.deepEqual(named('I ask Mira to join me.'), ['Mira']);
});

test('RB87-14: another NPC\'s full name does not keep a deleted NPC that shares its alias', () => {
    const run = laterMemory => {
        const mira = createNpcRecord('Mira');
        const hale = Object.assign(createNpcRecord('Tomas Hale'), { aliases: ['Tomas'] });
        const state = branchState([mira, hale]);
        const history = [];
        play(state, history, 6, (s, n) => {
            if (n === 3) {
                const reed = Object.assign(createNpcRecord('Tomas Reed'), { aliases: ['Tomas'], lifeState: 'deceased', lifeStateCertainty: 'explicit' });
                s.npcs.push(reed);
            }
            if (n === 5 && laterMemory) s.npcs[0].memories = [laterMemory];
        });
        return reconcileBranchState(state, history.filter((_, i) => i !== 5), { explicitDivergence: 5, operation: 'delete' }).state.npcs.map(npc => npc.name);
    };
    assert.ok(!run('Mira comforted Tomas Hale by the hearth.').includes('Tomas Reed'));
    assert.ok(run('Mira mourned Tomas Reed by the hearth.').includes('Tomas Reed'), 'naming Reed directly keeps him');
});

test('RB87-15: a refused obligation is a boundary, an affirmative one still needs standing', () => {
    const rel = { trust: 15, affection: 11, desire: 0, tension: 0 };
    assert.equal(relationshipSummaryConsistent('Does not feel she must repay him and maintains firm boundaries.', rel, '', []), true);
    assert.equal(relationshipSummaryConsistent('Feels no obligation to repay him and maintains firm boundaries.', rel, '', []), true);
    assert.equal(relationshipSummaryConsistent('Feels she must repay him for everything.', rel, '', []), false);
    assert.equal(relationshipSummaryConsistent('A loyal servant who must serve him.', rel, '', []), false, 'a word ending in "nt" is not a negation');
    assert.equal(relationshipSummaryConsistent("Doesn't think she must repay him.", rel, '', []), true);
});

test('RB87-17 (controller): native export checks the freshness result and its originating chat', () => {
    const source = fs.readFileSync(new URL('../../modules/people/legacy/dossier-tools.js', import.meta.url), 'utf8');
    const exporter = source.slice(source.indexOf('export async function exportNativeTools'), source.indexOf('// What the roleplay model receives'));
    assert.match(exporter, /if \(!await api\(\)\?\.ensureFresh\?\.\(\{ reason: 'dossier-export' \}\) \|\| !sameChat\(\)\)/);
    assert.match(exporter, /exportBytes\?\.\(\{ chatKey \}\)/);
});
