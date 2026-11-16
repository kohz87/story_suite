import test from 'node:test';
import assert from 'node:assert/strict';
import { createNpcRecord, mergeScanResult, npcNamedInText, normalizeNpcRecord, setActiveCalendarConfig } from '../../modules/people/core/core.js';
import {
    BRANCH_LINEAGE_VERSION,
    ensureBranchParentAnchor,
    ensureRollbackJournalBaseline,
    recordBranchCheckpoint,
    reconcileBranchState,
} from '../../modules/people/legacy/branch.js';
import { narrativeLineage } from '../../modules/people/core/destructive-settlement-core.js';
import { applyManualKeyRelationshipEdit, reconcileSocialState } from '../../modules/people/social/social.js';
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

test('RB84-03: hiding a message is not a narrative change, and a stale event index cannot move recovery earlier', () => {
    const chat = [{ is_user: true, is_system: false, mes: 'a' }, { is_user: false, is_system: false, mes: 'b' }];
    const hidden = chat.map((message, i) => ({ ...message, is_system: i === 0 }));
    assert.deepEqual(narrativeLineage(hidden), narrativeLineage(chat));

    const mira = createNpcRecord('Mira');
    mira.mood = 'calm';
    mira.goal = 'wait';
    const state = branchState([mira]);
    const history = [];
    play(state, history, 5, (s, n) => {
        if (n === 3) s.npcs[0].mood = 'angry';   // retained message 5
        if (n === 4) s.npcs[0].goal = 'leave';   // retained message 7
    });
    const result = reconcileBranchState(state, history.slice(0, 9), { explicitDivergence: 2, operation: 'delete' });
    const after = result.state.npcs[0];
    assert.equal(after.mood, 'angry');
    assert.equal(after.goal, 'leave');
});

test('RB84-06: a birthday correction needs one sentence about the NPC that supports every date part', () => {
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
            'Mira keeps the books. Noela was born long ago.',
            'Mira keeps the books on Redleaf 2.',
            'Mira says she was born on Redleaf 2 in an unknown year.',
            'Mira was born on Redleaf 2 in CR801, not CR790.',
            'Admiral Noela was born on Redleaf 2 in CR790.',
        ]) {
            const npc = scan(text);
            assert.equal(npc.birthDate.year, 801, text);
            assert.equal(npc.age, '20', text);
        }
        assert.equal(scan('Mira was born on Redleaf 2 in CR790.').birthDate.year, 790);
    } finally {
        setActiveCalendarConfig(null);
    }
});

test('RB84-07: another NPC\'s birthday does not age a yearless dossier', () => {
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
        assert.equal(run('Noela celebrates her birthday.').age, '20');
        assert.equal(run('Mira celebrates her birthday.').age, '21', 'her own birthday still rolls over');
    } finally {
        setActiveCalendarConfig(null);
    }
});

test('RB84-09: a shared alias selects nobody; a full name selects only its NPC', () => {
    const make = (name, aliases = []) => Object.assign(createNpcRecord(name), { aliases });
    const roster = [make('Tomas Reed', ['Tomas']), make('Tomas Hale', ['Tomas']), make('Mira'), make('Lady Mira'), make('Wren Vale', ['Wren'])];
    const named = text => roster.filter(npc => npcNamedInText(npc, text, roster)).map(npc => npc.name);
    assert.deepEqual(named('I ask Tomas Hale to join me.'), ['Tomas Hale']);
    assert.deepEqual(named('Tomas, come here.'), []);
    assert.deepEqual(named('I ask Lady Mira to sit.'), ['Lady Mira']);
    assert.deepEqual(named('Wren, help me.'), ['Wren Vale'], 'a unique alias still counts');
});

test('RB84-10: a manually removed inferred sibling bond is not recreated from the same parents', () => {
    const npc = (name, gender, bonds) => normalizeNpcRecord({ id: `npc_${name.toLowerCase()}`, name, gender, species: 'human', keyRelationships: bonds });
    let state = reconcileSocialState({ npcs: [npc('Mira', 'female', ['Orson — father']), npc('Noela', 'female', ['Orson — father']), npc('Orson', 'male', [])], socialGraph: { edges: [], unresolved: [] } }, {}).state;
    const before = [...state.npcs[0].keyRelationships];
    assert.ok(before.some(entry => /^Noela — sibling/.test(entry)));
    state.npcs[0].keyRelationships = ['Orson — father'];
    applyManualKeyRelationshipEdit(state, 'npc_mira', before, state.npcs[0].keyRelationships, {});
    for (let i = 0; i < 3; i += 1) state = reconcileSocialState(state, { provenance: 'manual', confidence: 'manual' }).state;
    assert.deepEqual(state.npcs[0].keyRelationships, ['Orson — father']);
    assert.ok(!state.npcs[1].keyRelationships.some(entry => /^Mira/.test(entry)));
    // New parent evidence (a second shared parent) is genuinely new and may infer the pair again.
    state.npcs[0].keyRelationships.push('Ilse — mother');
    state.npcs[1].keyRelationships.push('Ilse — mother');
    state.npcs.push(npc('Ilse', 'female', []));
    state = reconcileSocialState(state, {}).state;
    assert.ok(state.npcs[0].keyRelationships.some(entry => /^Noela — sibling/.test(entry)));
});

test('RB84-11: later references match whole names and aliases, not substrings', () => {
    const run = (stranger, laterMemory) => {
        const mira = createNpcRecord('Mira');
        const state = branchState([mira]);
        const history = [];
        play(state, history, 6, (s, n) => {
            if (n === 3) {
                const npc = createNpcRecord(stranger.name);
                npc.aliases = stranger.aliases || [];
                npc.lifeState = 'deceased';
                npc.lifeStateCertainty = 'explicit';
                s.npcs.push(npc);
            }
            if (n === 5 && laterMemory) s.npcs[0].memories = [laterMemory];
        });
        return reconcileBranchState(state, history.filter((_, i) => i !== 5), { explicitDivergence: 5, operation: 'delete' }).state.npcs.map(npc => npc.name);
    };
    assert.ok(run({ name: 'Fallen Stranger', aliases: ['Wayfarer'] }, 'Mira buried the Wayfarer by the road.').includes('Fallen Stranger'));
    assert.ok(!run({ name: 'Dan' }, 'Mira crossed a dangerous road alone.').includes('Dan'));
});

test('RB84-01 (storage): a retirement whose verification fails after upload is marked uncertain', async () => {
    let uploaded = false;
    const fetchFn = async (url, options = {}) => {
        if (url === '/api/files/upload') { uploaded = true; return { ok: true, status: 200, json: async () => ({ path: '/user/files/x.json' }), text: async () => '' }; }
        if (uploaded) return { ok: false, status: 403, text: async () => 'forbidden' };
        return { ok: false, status: 404, text: async () => '' };
    };
    await assert.rejects(
        retireNpcStateDataFile({ chatKey: 'chat:a.png:x', pointer: { name: 'x.json', path: '/user/files/x.json', revision: 0 }, fetchFn }),
        error => error.retirementUncertain === true,
    );
});
