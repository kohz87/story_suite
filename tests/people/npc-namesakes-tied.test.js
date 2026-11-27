// A row tied to one namesake (`settledId`) carries the shared name again; the matchers that read rows after the merge's settling must not give it to the
// other. The older journal entries that carry no mark are never tied, and rows without a tie are matched as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNpcRecord, mergeScanResult } from '../../modules/people/core/core.js';
import { mergeScanResult as mergeOnly } from '../../modules/people/core/core-mechanics.js';
import { appearanceUpdateForNpc, durableUpdateForNpc, prepareProfileDevelopmentState } from '../../modules/people/core/core-profile-development-readiness.js';
import { settleScanRows } from '../../modules/people/core/core-merge-namesakes.js';
import { relationshipChanges } from '../../modules/people/calls/runtime-scan-helpers-parts/scan-results.js';
import { rawScanMatchesExisting } from '../../modules/people/relationship/relationship-pass-parts/targets.js';
import { captureJournalEntry, recordAcceptedCapture, recordAcceptedFill, recordReadMark } from '../../modules/people/runtime/runtime-narration-parts/capture-journal.js';
import { useReplySids } from '../../modules/people/runtime/runtime-narration-parts/journal-keys.js';

const record = (id, aliases, extra = {}) => ({ ...createNpcRecord('Guard', []), id, aliases, role: 'guard', ...extra });
const guards = () => [record('npc_g1', ['the gate guard']), record('npc_g2', ['Bo'], { present: true })];
const tiedRows = row => settleScanRows(guards(), { profileUpdates: [row] }, []).scanResult;
const durable = { name: 'Guard', personality: 'Cautious', appearance: 'A scarred chin', evidence: { personality: ['Guard checks every cart twice before waving it on.'] } };

test('profile development: a tied row feeds its own namesake only', () => {
    const scan = tiedRows(durable);
    assert.equal(scan.profileUpdates[0].settledId, 'npc_g2');
    const [first, second] = guards();
    assert.deepEqual([durableUpdateForNpc(scan, first, 'personality'), appearanceUpdateForNpc(scan, first)], [null, null]);
    assert.deepEqual([durableUpdateForNpc(scan, second, 'personality').id, appearanceUpdateForNpc(scan, second).id], ['npc_g2', 'npc_g2']);
    const { plans } = prepareProfileDevelopmentState({ npcs: guards() }, scan, { turn: 4, sourceMessageId: 7 });
    assert.equal(plans.get('npc_g1')?.personality?.active ?? false, false);
    assert.equal(plans.get('npc_g2').personality.active, true);
});

test('profile development: a row with no tie is matched by id or name, as before', () => {
    const scan = { profileUpdates: [durable] };
    for (const npc of [record('npc_g1', []), record('npc_g2', [])]) {
        assert.equal(durableUpdateForNpc(scan, npc, 'personality'), durable);
        assert.equal(appearanceUpdateForNpc(scan, npc), durable);
    }
});

test('one-pass reasons: a tied row gives its reason to its own namesake only', () => {
    const row = { name: 'Guard', relationshipDelta: { trust: 2 }, relationshipEvidence: { trust: 'Bo is thanked' } };
    const after = guards();
    const prior = new Map(after.map(npc => [npc.id, structuredClone(npc)]));
    const changes = rows => relationshipChanges(prior, after, {}, 7, rows).map(change => [change.id, change.why]);
    const why = { trust: 'Bo is thanked' };
    assert.deepEqual(changes(tiedRows(row).profileUpdates), [['npc_g2', why]]);
    assert.deepEqual(changes([row]), [['npc_g1', why], ['npc_g2', why]]);
});

test('the focused relationship pass takes a tied row for its own namesake only', () => {
    const row = tiedRows({ name: 'Guard', aliases: ['the gate guard', 'Bo'], id: 'npc_g2' }).profileUpdates[0];
    assert.deepEqual(guards().map(npc => rawScanMatchesExisting(row, npc)), [false, true]);
    assert.deepEqual(guards().map(npc => rawScanMatchesExisting({ name: 'Guard' }, npc)), [true, true]);
});

for (const [what, merge] of [['the whole merge', mergeScanResult], ['the inner merge', mergeOnly]]) {
    test(`keepNamesakeRows (${what}): the rows are read as before the namesake rule`, () => {
        const out = merge({ npcs: [record('npc_g1', ['the gate guard']), record('npc_g2', ['Bo'])], candidates: [], turn: 3 },
            { npcs: [{ name: 'Guard', mood: 'angry' }] }, { turn: 4, keepNamesakeRows: true });
        assert.deepEqual(out.state.npcs.map(npc => [npc.id, npc.mood || '']).sort(), [['npc_g1', 'angry'], ['npc_g2', '']]);
        assert.ok(!out.report.skipped.includes('Guard'));
    });
}

test('journal: only entries this code writes are marked; finding an older one leaves it as it was, and a fill added to it is marked by itself', t => {
    const chat = [{ is_user: false, mes: 'one' }, { is_user: false, mes: 'two' }];
    useReplySids(index => `sid-${index}`);
    t.after(() => useReplySids(null));
    const state = {};
    assert.equal(recordReadMark(state, chat, 0).namesakes, 1);
    delete state.captureJournal[0].namesakes;   // an entry kept before the mark existed
    assert.equal(recordReadMark(state, chat, 0).namesakes, undefined);
    recordAcceptedFill(state, chat, 0, 'npc_g1', { npcs: [] }, 'refreshes');
    assert.deepEqual([captureJournalEntry(state, chat, 0).namesakes, captureJournalEntry(state, chat, 0).namesakeFills], [undefined, ['refreshes:npc_g1']]);
    recordAcceptedCapture(state, chat, 1, { parsed: { npcs: [] } });
    assert.equal(captureJournalEntry(state, chat, 1).namesakes, 1);
});
