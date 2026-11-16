import test from 'node:test';
import assert from 'node:assert/strict';
import { createNpcRecord, mergeScanResult, npcNamedInText, setActiveCalendarConfig } from '../core.js';
import {
    BRANCH_LINEAGE_VERSION,
    ensureBranchParentAnchor,
    ensureRollbackJournalBaseline,
    recordBranchCheckpoint,
    reconcileBranchState,
} from '../branch.js';

const user = turn => ({ is_user: true, is_system: false, name: 'User', mes: `user-${turn}` });
const bot = turn => ({ is_user: false, is_system: false, name: 'Narrator', mes: `assistant-${turn}` });

function makeState() {
    const mira = createNpcRecord('Mira');
    mira.mood = 'calm';
    mira.goal = 'wait';
    const state = {
        npcs: [mira], candidates: [], pendingBackfills: [], socialGraph: { edges: [], unresolved: [] }, dismissed: [],
        turn: 0, assistantSinceScan: 0, lastScanAt: 0, lastScannedMessageId: null, scanCount: 0, checkpoints: [], inlineCards: [],
        lineage: [], branchLineageVersion: BRANCH_LINEAGE_VERSION, portraitAssets: {}, userDismissedGroups: [],
    };
    ensureRollbackJournalBaseline(state, []);
    return state;
}

// Exchange n: user at 2n-2, assistant at 2n-1; `change` acts as that assistant's scan.
function play(state, chat, count, change = () => {}) {
    for (let i = 1; i <= count; i += 1) {
        chat.push(user(i), bot(i));
        const messageId = chat.length - 1;
        ensureBranchParentAnchor(state, chat, messageId, 'assistant-parent');
        state.turn += 1;
        change(state, i, messageId);
        recordBranchCheckpoint(state, chat, messageId, 'scan');
    }
}

const deleteAt = (state, chat, index) => reconcileBranchState(state, chat.filter((_, i) => i !== index), { explicitDivergence: index, operation: 'delete' });
const mira = result => result.state.npcs.find(npc => npc.name === 'Mira');

test('BUG-03: without the exact boundary before the deleted block, earlier accepted facts are kept', () => {
    const state = makeState();
    const chat = [];
    play(state, chat, 6, (s, n) => {
        if (n === 1) s.npcs[0].mood = 'angry';          // retained message 1
        if (n === 3) s.npcs[0].goal = 'leave';          // deleted message 5
        if (n === 5) s.npcs[0].location = 'harbor';     // retained later message
    });
    state.rollbackJournalFloorMessageId = chat.length;  // the journal no longer reaches back
    const sparse = structuredClone(state);
    sparse.checkpoints = sparse.checkpoints.filter(item => item.messageId === 0 || item.messageId === 5);
    const result = deleteAt(sparse, chat, 5);
    assert.equal(mira(result).mood, 'angry', 'the retained message 1 mood survives');
    assert.equal(mira(result).goal, 'leave', 'nothing is reverted without proof of the exact boundary');
    assert.deepEqual(result.deletedEffects.reverted, []);

    const exact = structuredClone(state);
    exact.checkpoints = exact.checkpoints.filter(item => item.messageId === 0 || item.messageId === 4 || item.messageId === 5);
    const proven = deleteAt(exact, chat, 5);
    assert.equal(mira(proven).goal, 'wait', 'with the exact boundary the deleted goal change is undone');
    assert.equal(mira(proven).mood, 'angry');
    assert.equal(mira(proven).location, 'harbor');
});

test('BUG-09: an NPC introduced and killed only in the deleted block is removed', () => {
    const run = laterMention => {
        const state = makeState();
        const chat = [];
        play(state, chat, 6, (s, n) => {
            if (n === 3) {
                const stranger = createNpcRecord('Fallen Stranger');
                stranger.lifeState = 'deceased';
                stranger.lifeStateCertainty = 'explicit';
                stranger.archived = true;
                s.npcs.push(stranger);
            }
            if (n === 5 && laterMention) s.npcs[0].memories = ['Buried the Fallen Stranger by the road.'];
        });
        return deleteAt(state, chat, 5);
    };
    const removed = run(false);
    assert.deepEqual(removed.deletedEffects.removed.map(item => item.name), ['Fallen Stranger']);
    assert.equal(removed.state.npcs.some(npc => npc.name === 'Fallen Stranger'), false);
    const kept = run(true);
    assert.ok(kept.state.npcs.some(npc => npc.name === 'Fallen Stranger'), 'a retained later message used the dead NPC');
});

test('BUG-08: a shared title or first name does not pull in other NPCs', () => {
    const roster = ['Lady Mira', 'Lady Noela', 'Lady Vera', 'Linnea Vael', 'Tomas Reed', 'Tomas Hale'].map(name => createNpcRecord(name));
    const named = text => roster.filter(npc => npcNamedInText(npc, text, roster)).map(npc => npc.name);
    assert.deepEqual(named('I ask Lady Mira to join me.'), ['Lady Mira']);
    assert.deepEqual(named('Lady, a word?'), []);
    assert.deepEqual(named('Linnea, come here.'), ['Linnea Vael'], 'a unique first name still counts');
    assert.deepEqual(named('Tomas, over here.'), [], 'an ambiguous first name selects nobody');
    assert.deepEqual(named('Tomas Hale waves.'), ['Tomas Hale']);
});

test('BUG-05: a scanned birthday correction needs support in the scanned text', () => {
    setActiveCalendarConfig({ era: 'CR', months: [{ name: 'Redleaf', days: 30 }, { name: 'Sunwane', days: 31 }], currentYear: 821, currentMonth: 'Redleaf', currentDay: 16 });
    try {
        const npc = createNpcRecord('Mira');
        npc.id = 'npc_mira';
        npc.age = '20';
        npc.birthDate = { era: 'CR', year: 801, month: 'Redleaf', day: 1 };
        npc.birthDateSource = 'established';
        npc.birthDateYearSource = 'established';
        const state = { npcs: [npc], candidates: [], turn: 3 };
        const correction = { npcs: [{ id: 'npc_mira', name: 'Mira', birthDate: { era: 'CR', year: 790, month: 'Redleaf', day: 2 }, birthDateState: 'correct', birthDateReason: 'Invented.' }] };
        const rejected = mergeScanResult(state, correction, { sourceMessageId: 9, developmentContext: 'Mira silently checks the account book.' }).state.npcs[0];
        assert.equal(rejected.birthDate.year, 801);
        assert.equal(rejected.age, '20');
        const grounded = mergeScanResult(state, correction, { sourceMessageId: 9, developmentContext: 'Mira admits she was born on Redleaf 2 in CR790, not CR801.' }).state.npcs[0];
        assert.equal(grounded.birthDate.year, 790, 'a stated correction still applies');
    } finally {
        setActiveCalendarConfig(null);
    }
});
