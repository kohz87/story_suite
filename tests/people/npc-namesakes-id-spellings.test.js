// A scan row that writes a stored id in another spelling (NPC_GUARD_B for npc_guard-b, as the profile reader takes it) stays that person's: namesake
// settling never hands it to the namesake the scene has.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNpcRecord, mergeScanResult } from '../../modules/people/core/core.js';
import { settleScanRows } from '../../modules/people/core/core-merge-namesakes.js';

const guard = (id, aliases, extra = {}) => ({ ...createNpcRecord('Guard', []), id, aliases, role: 'guard', ...extra });
const pairs = {
    'with nicknames': () => [guard('npc_guard-a', ['Old Tom'], { present: true }), guard('npc_guard-b', ['the gate guard'])],
    'without': () => [guard('npc_guard-a', [], { present: true }), guard('npc_guard-b', [])],
};
const ROW = { id: 'NPC_GUARD_B', name: 'Guard', appearance: 'A short man with a split lip.', appearanceState: 'establish', appearanceEvidence: 'a split lip', memories: ['Lost the gate key.'] };

for (const [what, pair] of Object.entries(pairs)) {
    test(`a row for NPC_GUARD_B is tied to npc_guard-b, ${what}`, () => {
        for (const list of ['npcs', 'profileUpdates']) {
            const [row] = settleScanRows(pair(), { [list]: [ROW] }, ['Guard']).scanResult[list];
            assert.deepEqual([row.settledId, row.id], ['npc_guard-b', 'npc_guard-b'], list);
        }
    });
    test(`its memories and looks are saved on npc_guard-b, ${what}`, () => {
        for (const list of ['npcs', 'profileUpdates']) {
            const before = pair();
            const after = Object.fromEntries(mergeScanResult({ npcs: before, turn: 5 }, { [list]: [ROW] }, { turn: 5, sourceMessageId: 9, scenePresent: { present: ['Guard'] } }).state.npcs.map(npc => [npc.id, npc]));
            assert.ok(!/split lip|gate key/.test(JSON.stringify(after['npc_guard-a'])), `${list}: ${JSON.stringify(after['npc_guard-a'])}`);
            assert.match(JSON.stringify(after['npc_guard-b']), /split lip|gate key/i, list);
        }
    });
}
