import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildInjection,
    applyNpcStateCommand,
    createNpcRecord,
    mergeScanResult,
    setNpcArchived,
    applyStaleNpcLifecycle,
} from '../core.js';

test('stale lifecycle auto-archives at 30 and deletes only stale auto-archives at 50', () => {
    const stale = createNpcRecord('Court Herald');
    stale.id = 'npc_court_herald';
    stale.lastSeenTurn = 70;

    const manual = setNpcArchived(createNpcRecord('Old Mentor'), true, { reason: 'manual' });
    manual.id = 'npc_old_mentor';
    manual.lastSeenTurn = 1;

    const dead = setNpcArchived(createNpcRecord('Dead Baron'), true, { reason: 'deceased' });
    dead.id = 'npc_dead_baron';
    dead.lastSeenTurn = 1;

    const atThirty = applyStaleNpcLifecycle({ turn: 100, npcs: [stale, manual, dead] }, { turn: 100, archiveAfter: 30, deleteAfter: 50 });
    const herald = atThirty.state.npcs.find(npc => npc.id === stale.id);
    assert.equal(herald.archived, true);
    assert.equal(herald.archiveReason, 'stale');
    assert.deepEqual(atThirty.archived.map(item => item.id), [stale.id]);
    assert.equal(atThirty.removed.length, 0);

    herald.lastSeenTurn = 50;
    const atFifty = applyStaleNpcLifecycle({ ...atThirty.state, turn: 100 }, { turn: 100, archiveAfter: 30, deleteAfter: 50 });
    assert.deepEqual(atFifty.removed.map(item => item.id), [stale.id]);
    assert.ok(atFifty.state.npcs.some(npc => npc.id === manual.id), 'manual archives must not time out');
    assert.ok(atFifty.state.npcs.some(npc => npc.id === dead.id), 'death archives must not time out');
});

test('stale auto-archive is reversible and archived dossiers do not consume the active roster cap', () => {
    const archived = createNpcRecord('Old Courtier');
    archived.id = 'npc_old_courtier';
    archived.lastSeenTurn = 1;
    const lifecycle = applyStaleNpcLifecycle({ turn: 31, npcs: [archived] }, { turn: 31, archiveAfter: 30, deleteAfter: 50 });
    assert.equal(lifecycle.state.npcs[0].archiveReason, 'stale');

    const admitted = mergeScanResult(lifecycle.state, { npcs: [{ name: 'New Courtier', present: true }] }, { turn: 31, maxNpcs: 1 });
    assert.equal(admitted.state.npcs.filter(npc => !npc.archived).length, 1);
    assert.ok(admitted.state.npcs.some(npc => npc.name === 'New Courtier'));
    assert.equal(admitted.state.npcs.length, 2, 'archive remains stored while the active slot is reusable');

    const returned = mergeScanResult(admitted.state, { npcs: [{ id: archived.id, name: 'Old Courtier', present: true }] }, { turn: 32, maxNpcs: 1, autoReactivateArchived: true });
    assert.equal(returned.state.npcs.find(npc => npc.id === archived.id).archived, false, 'stale archive should reactivate on a clear return');
});

test('manual archive preserves dossier, blocks injection, and auto-reactivates on genuine physical return', () => {
    const npc = createNpcRecord('Yunyun');
    npc.present = true;
    npc.background = 'Crimson Demon adventurer.';
    npc.relationship.trust = 64;
    const archived = setNpcArchived(npc, true, { reason: 'manual', sourceMessageId: 12 });
    assert.equal(archived.archived, true);
    assert.equal(archived.archiveReason, 'manual');
    assert.equal(archived.present, false);
    assert.equal(archived.background, 'Crimson Demon adventurer.');
    assert.equal(archived.relationship.trust, 64);
    // Since 1.1.7 a mentioned absent NPC gets one reference line, never a dossier block.
    assert.doesNotMatch(buildInjection([archived], 'Yunyun is mentioned.', 12, 3), /IDENTITY/);

    const returned = mergeScanResult({ npcs: [archived], turn: 13 }, { npcs: [{
        id: archived.id, name: 'Yunyun', present: true, lifeState: 'unknown', mood: 'back in town',
    }] }, { turn: 13, autoReactivateArchived: true });
    const live = returned.state.npcs[0];
    assert.equal(live.archived, false, 'manual archive should lift when the NPC physically returns');
    assert.equal(live.archiveReason, '');
    assert.equal(live.present, true);
});

test('confirmed death archives instead of deleting, and no later scan output revives the NPC (C05)', () => {
    const npc = createNpcRecord('Luna');
    npc.present = true;
    const death = mergeScanResult({ npcs: [npc], turn: 4 }, { npcs: [{
        id: npc.id, name: 'Luna', present: true,
        lifeState: 'deceased', lifeStateCertainty: 'explicit', lifeStateReason: 'The healer confirmed there was no pulse.',
        status: 'Deceased',
    }] }, { turn: 4, sourceMessageId: 4, autoArchiveDeaths: true });
    const dead = death.state.npcs[0];
    assert.equal(death.state.npcs.length, 1, 'death must preserve the dossier');
    assert.equal(dead.archived, true);
    assert.equal(dead.archiveReason, 'deceased');
    assert.equal(dead.lifeState, 'deceased');
    assert.equal(dead.present, false, 'death-archived NPC should not create a live presence card');

    const ghost = mergeScanResult(death.state, { npcs: [{
        id: dead.id, name: 'Luna', present: true, lifeState: 'deceased', lifeStateCertainty: 'explicit',
        lifeStateReason: 'Her ghost appeared in the room.',
    }] }, { turn: 5, autoReactivateArchived: true });
    assert.equal(ghost.state.npcs[0].archived, true, 'ghost/continued deceased presence must not revive the NPC');
    assert.equal(ghost.state.npcs[0].present, false);

    // (audit C-1) Even an explicit "alive" row cannot undo a confirmed death; only the reader's own
    // correction (manual Restore, life state in the editor) or owned rollback can.
    const revived = mergeScanResult(ghost.state, { npcs: [{
        id: dead.id, name: 'Luna', present: true, lifeState: 'alive', lifeStateCertainty: 'explicit',
        lifeStateReason: 'Luna was resurrected and spoke in person.',
    }] }, { turn: 6, autoReactivateArchived: true });
    assert.equal(revived.state.npcs[0].archived, true);
    assert.equal(revived.state.npcs[0].archiveReason, 'deceased');
    assert.equal(revived.state.npcs[0].lifeState, 'deceased');
    assert.equal(revived.state.npcs[0].present, false);
    const corrected = setNpcArchived(revived.state.npcs[0], false, { allowDeathCorrection: true });
    assert.equal(corrected.archived, false);
    assert.equal(corrected.lifeState, 'alive', 'the reader\'s correction still revives');
});

test('ambiguous or inferred death never triggers automatic archive', () => {
    const npc = createNpcRecord('Dust');
    const result = mergeScanResult({ npcs: [npc], turn: 2 }, { npcs: [{
        id: npc.id, name: 'Dust', present: true,
        lifeState: 'deceased', lifeStateCertainty: 'inferred', lifeStateReason: 'He was left for dead.',
    }] }, { turn: 2, autoArchiveDeaths: true });
    assert.equal(result.state.npcs[0].archived, false);
    assert.equal(result.state.npcs[0].present, true);
});

test('manual add restores an archived dossier instead of creating a duplicate', () => {
    const original = setNpcArchived(createNpcRecord('Wiz'), true, { reason: 'manual' });
    const result = applyNpcStateCommand({ npcs: [original], turn: 5, dismissed: [] }, { action: 'add', name: 'Wiz' }, { turn: 5 });
    assert.equal(result.state.npcs.length, 1);
    assert.equal(result.report.status, 'restored');
    assert.equal(result.state.npcs[0].archived, false);
});

test('World State off-screen activity reactivates a manually archived NPC without making them present or injectable', () => {
    const archived = setNpcArchived(createNpcRecord('Yunyun'), true, { reason: 'manual', sourceMessageId: 20 });
    const result = mergeScanResult({ npcs: [archived], turn: 21 }, { npcs: [{
        id: archived.id,
        name: 'Yunyun',
        present: false,
        worldActive: true,
        location: 'Forest outside Axel',
        goal: 'Train with a new party',
        status: 'Training',
    }] }, { turn: 21, autoReactivateArchived: true });
    const npc = result.state.npcs[0];
    assert.equal(npc.archived, false, 'current off-screen activity should restore a manually archived living dossier');
    assert.equal(npc.present, false, 'World State must not imply physical scene presence');
    assert.equal(npc.worldActive, true);
    assert.equal(npc.location, 'Forest outside Axel');
    // Since 1.1.7 a mentioned absent NPC gets one reference line, never a dossier block.
    assert.doesNotMatch(buildInjection([npc], 'Yunyun is training outside Axel.', 21, 3), /IDENTITY/, 'off-screen active NPCs get no dossier block');
});

test('death archive ignores off-screen activity, an explicit living return included (C05)', () => {
    const dead = setNpcArchived(createNpcRecord('Beldia'), true, { reason: 'deceased', sourceMessageId: 30 });
    const legacyActivity = mergeScanResult({ npcs: [dead], turn: 31 }, { npcs: [{
        id: dead.id,
        name: 'Beldia',
        present: false,
        worldActive: true,
        lifeState: 'deceased',
        lifeStateCertainty: 'explicit',
        lifeStateReason: 'His ghost continues to haunt the castle.',
    }] }, { turn: 31, autoReactivateArchived: true });
    assert.equal(legacyActivity.state.npcs[0].archived, true);
    assert.equal(legacyActivity.state.npcs[0].worldActive, false, 'archived deceased records cannot become off-screen active from ghost activity');

    const revived = mergeScanResult(legacyActivity.state, { npcs: [{
        id: dead.id,
        name: 'Beldia',
        present: false,
        worldActive: true,
        lifeState: 'alive',
        lifeStateCertainty: 'explicit',
        lifeStateReason: 'Beldia was resurrected and is rebuilding his fortress.',
        location: 'Demon King territory',
    }] }, { turn: 32, autoReactivateArchived: true });
    const npc = revived.state.npcs[0];
    assert.equal(npc.archived, true);
    assert.equal(npc.lifeState, 'deceased');
    assert.equal(npc.present, false);
    assert.equal(npc.worldActive, false, 'scan output cannot bring a confirmed-dead NPC back, even off-screen');
});

// ---- Dossiers that matter are archived, never auto-deleted by the stale pass ----
import { applyStaleLifecycleAfterScan as staleAfterScan } from '../runtime-scan-stale.js';

const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const awayNpc = (name, extra = {}) => ({ ...createNpcRecord(name), id: `npc_${name.toLowerCase()}`, lastSeenTurn: 1, ...extra });
const staleRun = (npcs, options = {}) => applyStaleNpcLifecycle({ turn: 100, npcs }, { turn: 100, archiveAfter: 30, deleteAfter: 50, ...options });

test('stale pass: a dossier that matters, away past the delete age, is archived with its portrait; an incidental one is deleted as before', () => {
    const cases = {
        portrait: awayNpc('Pia', { portrait: { dataUrl: PNG_1PX } }),
        cast: awayNpc('Cas', { castFrom: { key: 'pack:cas' } }),
        meter: awayNpc('Mel', { relationship: { ...createNpcRecord('x').relationship, trust: 2 } }),
        director: awayNpc('Dir'),
    };
    const incidental = awayNpc('Inc');
    const result = staleRun([...Object.values(cases), incidental], { keepIds: [cases.director.id] });
    assert.deepEqual(result.removed.map(item => item.id), [incidental.id], 'only the incidental dossier is deleted');
    for (const [label, npc] of Object.entries(cases)) {
        const kept = result.state.npcs.find(item => item.id === npc.id);
        assert.ok(kept, `${label}: kept`);
        assert.equal(kept.archived, true, `${label}: archived`);
        assert.equal(kept.archiveReason, 'stale');
    }
    assert.equal(result.state.npcs.find(item => item.id === cases.portrait.id).portrait.dataUrl, PNG_1PX, 'the portrait stays');
    // An already stale-archived one that matters stays through later passes (no timed delete).
    const again = staleRun(result.state.npcs.filter(npc => npc.id !== cases.director.id));
    assert.equal(again.removed.length, 0, 'matter-bearing archives stay on later passes');
});

test('stale pass: a stale archive that matters is never timed out, and the director criterion needs the id', () => {
    const kept = setNpcArchived(awayNpc('Cas', { castFrom: { key: 'pack:cas' } }), true, { reason: 'stale' });
    assert.equal(staleRun([kept]).removed.length, 0);
    const plain = setNpcArchived(awayNpc('Dir'), true, { reason: 'stale' });
    assert.equal(staleRun([plain], { keepIds: [plain.id] }).removed.length, 0, 'key person / away: kept');
    assert.equal(staleRun([plain]).removed.length, 1, 'not named by the director: deleted as before');
});

test('stale pass at the roster cap: archives what matters, deletes the incidental one first, and never deletes a protected dossier', () => {
    const settings = { autoPruneStale: true, maxNpcs: 2, staleArchiveAfter: 30, staleDeleteAfter: 50 };
    const heldA = awayNpc('Cas', { castFrom: { key: 'pack:cas' } });
    const heldB = awayNpc('Pia', { portrait: { dataUrl: PNG_1PX } });
    const onlyProtected = staleAfterScan({ turn: 100, npcs: [heldA, heldB] }, {}, '', settings, { onlyWhenAtCap: true });
    assert.equal(onlyProtected.removed.length, 0);
    assert.equal(onlyProtected.state.npcs.length, 2, 'the cap is never met by deleting a protected dossier');
    assert.ok(onlyProtected.state.npcs.every(npc => npc.archived), 'they are archived, which frees the active slots for a new candidate');
    const incidental = awayNpc('Inc');
    const mixed = staleAfterScan({ turn: 100, npcs: [heldA, incidental] }, {}, '', settings, { onlyWhenAtCap: true });
    assert.deepEqual(mixed.removed.map(item => item.id), [incidental.id]);
    const recent = awayNpc('Rec', { lastSeenTurn: 99, castFrom: { key: 'pack:rec' } });
    const nonStale = staleAfterScan({ turn: 100, npcs: [recent, { ...heldA, lastSeenTurn: 99 }] }, {}, '', settings, { onlyWhenAtCap: true });
    assert.equal(nonStale.state.npcs.length, 2, 'only protected and recent: nothing is deleted, the cap simply holds (a new candidate waits)');
});

// ---- Keep dossiers, second round: form portraits, fail safe, starting-value meters, replay clock, snapshot size ----
import { snapshotBranchState as snapshotOf } from '../branch-core.js';
import { utf8Bytes as bytesOf } from '../branch-util.js';
import { BRANCH_SNAPSHOT_MAX_BYTES as SNAPSHOT_MAX } from '../branch-constants.js';

test('stale pass: a dossier with only a form portrait is archived, and its form image stays', () => {
    const formOnly = awayNpc('Fay');
    const state = { turn: 100, npcs: [formOnly, awayNpc('Inc')], formPortraitAssets: { [formOnly.id]: { wolf: { dataUrl: PNG_1PX } } } };
    const result = applyStaleNpcLifecycle(state, { turn: 100, archiveAfter: 30, deleteAfter: 50 });
    assert.deepEqual(result.removed.map(item => item.name), ['Inc']);
    assert.equal(result.state.npcs.find(npc => npc.id === formOnly.id).archived, true);
    assert.equal(result.state.formPortraitAssets[formOnly.id].wolf.dataUrl, PNG_1PX);
});

test('stale pass: with the host unreadable (noDelete) nothing is deleted, the stale ones are archived', () => {
    const inc = awayNpc('Inc');
    const archivedBefore = setNpcArchived(awayNpc('Old'), true, { reason: 'stale' });
    const result = staleRun([inc, archivedBefore], { noDelete: true });
    assert.equal(result.removed.length, 0);
    assert.equal(result.state.npcs.length, 2);
    assert.equal(result.state.npcs.find(npc => npc.id === inc.id).archived, true);
    const viaScan = staleAfterScan({ turn: 100, npcs: [inc] }, {}, '', { autoPruneStale: true, maxNpcs: 40, staleArchiveAfter: 30, staleDeleteAfter: 50 }, { noDelete: true });
    assert.equal(viaScan.removed.length, 0);
});

test('stale pass: a meter equal to a non-zero starting value does not protect; one off it does', () => {
    const baseline = { trust: 10, affection: 5, desire: 0, tension: 0 };
    const rel = { ...createNpcRecord('x').relationship, trust: 10, affection: 5 };
    const fresh = awayNpc('Fre', { relationship: rel });
    const moved = awayNpc('Mov', { relationship: { ...rel, trust: 11 } });
    const result = staleRun([fresh, moved], { baseline });
    assert.deepEqual(result.removed.map(item => item.name), ['Fre']);
    assert.equal(result.state.npcs.find(npc => npc.id === moved.id).archived, true);
});

test('stale pass: the archive timestamps are the supplied clock, so a replay stores the same bytes as the live scan', () => {
    const npcs = [awayNpc('Cas', { castFrom: { key: 'pack:cas' } }), awayNpc('Mid', { portrait: { dataUrl: PNG_1PX }, lastSeenTurn: 60 })];
    const run = () => staleRun(npcs, { now: 1234567 });
    const first = run();
    assert.equal(JSON.stringify(first.state), JSON.stringify(run().state));
    assert.ok(first.state.npcs.every(npc => npc.archivedAt === 1234567 && npc.updatedAt === 1234567));
    assert.equal(setNpcArchived(awayNpc('Z'), true, { reason: 'stale', now: 9 }).archivedAt, 9);
});

test('stale pass: stored memories alone do not protect a dossier', () => {
    const talky = awayNpc('Tal', { memories: ['Shared a secret.', 'Owes a favour.'] });
    const result = staleRun([talky, awayNpc('Cas', { castFrom: { key: 'pack:cas' } })]);
    assert.deepEqual(result.removed.map(item => item.id), [talky.id]);
});

test('stale pass: there is no bound, a 200th protected archive is not deleted, and the snapshot size is measured', () => {
    const many = Array.from({ length: 200 }, (_, i) => awayNpc(`N${i}`, { castFrom: { key: `pack:n${i}` }, lastSeenTurn: i % 20 }));
    const kept = staleRun(many).state.npcs;
    assert.equal(kept.length, 200, 'all 200 stay');
    assert.ok(kept.every(npc => npc.archived));
    assert.equal(staleRun(kept).removed.length, 0, 'later passes keep them too');
    const bytes = bytesOf(snapshotOf({ npcs: kept }));
    assert.ok(bytes > 0 && SNAPSHOT_MAX > 0, `200 small archived records: ${bytes} of ${SNAPSHOT_MAX} bytes`);
});

test('stale pass: with Story Director absent (no key list) incidental dossiers are deleted; a real read failure deletes nothing', () => {
    const inc = awayNpc('Inc');
    const cas = awayNpc('Cas', { castFrom: { key: 'pack:cas' } });
    const absent = staleAfterScan({ turn: 100, npcs: [inc, cas] }, {}, '', { autoPruneStale: true, maxNpcs: 40, staleArchiveAfter: 30, staleDeleteAfter: 50 }, { keepIds: [], noDelete: false });
    assert.deepEqual(absent.removed.map(item => item.id), [inc.id]);
    const failed = staleAfterScan({ turn: 100, npcs: [inc, cas] }, {}, '', { autoPruneStale: true, maxNpcs: 40, staleArchiveAfter: 30, staleDeleteAfter: 50 }, { keepIds: [], noDelete: true });
    assert.equal(failed.removed.length, 0);
});
