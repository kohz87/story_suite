import test from 'node:test';
import assert from 'node:assert/strict';
import { createNpcRecord, mergeScanResult, normalizeNpcRecord, setActiveCalendarConfig } from '../../modules/people/core/core.js';
import { appearanceFingerprint, resolveNpcAppearance } from '../../modules/people/appearance/appearance.js';
import { mergeImportedDossierState } from '../../modules/people/bundle/bundle.js';
import {
    BRANCH_LINEAGE_VERSION,
    ensureBranchParentAnchor,
    ensureRollbackJournalBaseline,
    recordBranchCheckpoint,
    reconcileBranchState,
} from '../../modules/people/legacy/branch.js';
import { quarantineUnreadableNpcStateDataFile } from '../../modules/people/storage/storage.js';

const CALENDAR = { era: 'CR', months: [{ name: 'Redleaf', days: 30 }, { name: 'Sunwane', days: 31 }] };
const dated = (npc, date, id) => normalizeNpcRecord(mergeScanResult({ npcs: [npc], candidates: [], turn: 3, socialGraph: { version: 1, edges: [], unresolved: [] } }, { npcs: [] },
    { sourceMessageId: id, developmentContext: `<World_State>Time | ${date} | evening</World_State> She reads.` }).state.npcs[0]);
const person = (name, age, apparentAge, year, extra = {}) => normalizeNpcRecord({ id: `npc_${name.toLowerCase()}`, name, age, apparentAge,
    birthDate: { era: 'CR', year, month: 'Redleaf', day: 16 }, birthDateSource: 'established', birthDateYearSource: 'established', ...extra });

test('A: a wrong or flashback date does not ratchet apparent age', () => {
    setActiveCalendarConfig(CALENDAR);
    try {
        let mira = person('Mira', '20', '~18', 801);
        mira = dated(mira, 'CR921, Sunwane 4', 6);
        assert.equal(mira.age, '120');
        mira = dated(mira, 'CR821, Sunwane 5', 7);
        assert.deepEqual([mira.age, mira.apparentAge], ['20', '~18'], 'correcting the year restores the offset exactly');

        let bea = person('Bea', '30', '~30', 791);
        bea = dated(bea, 'CR811, Sunwane 3', 8);
        assert.deepEqual([bea.age, bea.apparentAge], ['20', '~20'], 'a flashback follows the same offset back');
        bea = dated(bea, 'CR821, Sunwane 3', 9);
        assert.deepEqual([bea.age, bea.apparentAge], ['30', '~30'], 'returning to the present does not add the gap again');

        // A long-lived NPC seen far in the past keeps her apparent age and gets it back unchanged.
        let elf = person('Ilya', '300', '~25', 521);
        elf = dated(elf, 'CR621, Sunwane 3', 10);
        assert.equal(elf.apparentAge, '~25');
        elf = dated(elf, 'CR821, Sunwane 3', 11);
        assert.equal(elf.apparentAge, '~25');

        // Any other change of apparent age restarts the reference there.
        let tess = person('Tess', '20', '~18', 801);
        tess = dated(tess, 'CR822, Redleaf 17', 12);
        assert.equal(tess.apparentAge, '~19');
        tess = normalizeNpcRecord({ ...tess, apparentAge: '~25' });
        tess = dated(tess, 'CR823, Redleaf 17', 13);
        assert.equal(tess.apparentAge, '~26', 'a manual ~25 carries forward from 25, not from the old reference');
        // The exact-birthday and lock controls still hold.
        assert.equal(dated(person('Ana', '20', '~18', 801), 'CR822, Redleaf 16', 14).apparentAge, '~19');
        assert.equal(dated(person('Lia', '20', '~18', 801, { manualProfileFields: ['apparentAge'] }), 'CR822, Redleaf 17', 15).apparentAge, '~18');
    } finally {
        setActiveCalendarConfig(null);
    }
});

test('E: an automatic birthday carry does not mark the portrait outdated, a real change does', () => {
    setActiveCalendarConfig(CALENDAR);
    try {
        const mira = person('Mira', '20', '~18', 801, { appearance: 'Short silver hair, green coat.' });
        const older = dated(mira, 'CR822, Redleaf 17', 6);
        assert.equal(older.apparentAge, '~19');
        assert.equal(appearanceFingerprint(older), appearanceFingerprint(mira));
        assert.notEqual(appearanceFingerprint({ ...older, apparentAge: '~30' }), appearanceFingerprint(mira));
    } finally {
        setActiveCalendarConfig(null);
    }
});

test('B: importing an older copy keeps one family group with the named twin', () => {
    const slot = n => ({ id: `slot_x_child_${n}`, ownerId: 'npc_x', relation: 'daughter', groupId: 'group_x_child', sharedDescriptor: 'twins', provenance: 'explicit', confidence: 'explicit' });
    const current = {
        npcs: [normalizeNpcRecord({ id: 'npc_x', name: 'Brina' }), normalizeNpcRecord({ id: 'npc_c1', name: 'Astra' })],
        socialGraph: { edges: [{ id: 'e1', aId: 'npc_x', bId: 'npc_c1', aToB: 'mother', bToA: 'daughter', groupId: 'group_x_child', sharedDescriptor: 'twins', provenance: 'explicit', confidence: 'explicit' }], unresolved: [slot(2)] },
    };
    const merged = mergeImportedDossierState(current, { npcs: [normalizeNpcRecord({ id: 'npc_x', name: 'Brina' })], socialGraph: { edges: [], unresolved: [slot(1), slot(2)] } }, {});
    assert.deepEqual([...new Set(merged.socialGraph.unresolved.map(item => item.groupId))], ['group_x_child']);
});

function branchState(npcs) {
    const state = {
        npcs, candidates: [], pendingBackfills: [], socialGraph: { edges: [], unresolved: [] }, dismissed: [],
        turn: 0, assistantSinceScan: 0, lastScanAt: 0, lastScannedMessageId: null, scanCount: 0, checkpoints: [], inlineCards: [],
        lineage: [], branchLineageVersion: BRANCH_LINEAGE_VERSION, portraitAssets: {}, userDismissedGroups: [],
    };
    ensureRollbackJournalBaseline(state, []);
    return state;
}

test('C: deleting the message that named a relative restores the unnamed slot it used', () => {
    const run = keepLater => {
        const state = branchState([Object.assign(createNpcRecord('Brina'), { id: 'npc_brina' })]);
        const chat = [];
        const slot = n => ({ id: `slot_brina_child_${n}`, ownerId: 'npc_brina', relation: 'daughter', groupId: 'group_brina_child', provenance: 'explicit', confidence: 'explicit' });
        for (let i = 1; i <= 6; i += 1) {
            chat.push({ is_user: true, is_system: false, name: 'User', mes: `user-${i}` }, { is_user: false, is_system: false, name: 'Narrator', mes: `assistant-${i}` });
            const id = chat.length - 1;
            ensureBranchParentAnchor(state, chat, id, 'assistant-parent');
            state.turn += 1;
            if (i === 1) state.socialGraph.unresolved.push(slot(1), slot(2));
            if (i === 2) state.npcs.push(Object.assign(createNpcRecord('Astra'), { id: 'npc_astra' }));
            if (i === 3) {
                state.socialGraph.unresolved = state.socialGraph.unresolved.filter(item => item.id !== 'slot_brina_child_1');
                state.socialGraph.edges.push({ id: 'edge_brina_astra', aId: 'npc_brina', bId: 'npc_astra', aToB: 'mother', bToA: 'daughter', groupId: 'group_brina_child', provenance: 'explicit', confidence: 'explicit' });
            }
            if (i === 5 && keepLater) state.socialGraph.edges[0].aDynamic = 'teaches her to sail';
            recordBranchCheckpoint(state, chat, id, 'scan');
        }
        return reconcileBranchState(state, chat.filter((_, index) => index !== 5), { explicitDivergence: 5, operation: 'delete' }).state.socialGraph;
    };
    const undone = run(false);
    assert.equal(undone.edges.length, 0, 'the naming bond is undone');
    assert.deepEqual(undone.unresolved.map(item => item.id).sort(), ['slot_brina_child_1', 'slot_brina_child_2'], 'Brina has two daughters again');
    const kept = run(true);
    assert.equal(kept.edges.length, 1, 'a bond a retained message changed stays');
    assert.deepEqual(kept.unresolved.map(item => item.id), ['slot_brina_child_2'], 'its slot stays consumed');
});

test('D: a form\'s own trait replaces a shared one joined by "and", and size words count as height', () => {
    const resolve = (overallAppearance, appearance) => resolveNpcAppearance({ overallAppearance, appearanceForms: [{ name: 'F', appearance }], currentForm: 'F' });
    assert.equal(resolve('Long silver hair and violet eyes', 'Crimson eyes, black horns'), 'Long silver hair; Crimson eyes, black horns');
    assert.equal(resolve('Tall and slender, long silver hair', 'Short and stocky, with a thick beard'), 'long silver hair; Short and stocky, with a thick beard');
    assert.equal(resolve('Tall and slender, long silver hair', 'Short silver hair, curved horns'), 'Tall and slender; Short silver hair, curved horns', '"short hair" is not a height and the shared wording is kept');
    assert.equal(resolve('Silver hair and blue eyes.', 'Silver hair and blue eyes are not visible beneath an opaque black veil.'), 'Silver hair and blue eyes are not visible beneath an opaque black veil.');
});

test('G (storage): a Detach marker names its backup, and a later session finds it', async () => {
    const files = new Map([['/user/files/broken.json', '{"format": not json']]);
    const fetchFn = async (url, options = {}) => {
        if (url === '/api/files/upload') {
            const body = JSON.parse(options.body);
            files.set(`/user/files/${body.name}`, Buffer.from(body.data, 'base64').toString('utf8'));
            return { ok: true, status: 200, json: async () => ({ path: `/user/files/${body.name}` }), text: async () => '' };
        }
        return files.has(url) ? { ok: true, status: 200, text: async () => files.get(url) } : { ok: false, status: 404, text: async () => '' };
    };
    const pointer = { name: 'broken.json', path: '/user/files/broken.json' };
    const first = await quarantineUnreadableNpcStateDataFile({ chatKey: 'chat:a.png:x', pointer, fetchFn });
    assert.equal(JSON.parse(files.get(pointer.path)).recoveryPath, first.path);
    const other = await quarantineUnreadableNpcStateDataFile({ chatKey: 'chat:a.png:x', pointer, fetchFn });
    assert.equal(other.alreadyDetached, true);
    assert.equal(other.path, first.path, 'another session is told where the original bytes are');
    assert.equal(files.get(other.path), '{"format": not json');
});
