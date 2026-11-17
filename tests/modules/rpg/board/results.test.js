// fightResults and the readers that draw from a settled fight: the same record answers from a port settle receipt; an rpg.resolve receipt is no roll any more.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FIGHT_KIND, fightResults, isFightReceipt, isRollReceipt } from '../../../../modules/rpg/board/results.js';
import { boardWin } from '../../../../modules/rpg/board/awards.js';
import { rollOf, usesOf } from '../../../../modules/rpg/practice-parts/uses.js';
import { openedSlots } from '../../../../modules/rpg/fight-parts/opened.js';
import { rollsOf } from '../../../../modules/rpg/rolls-read.js';
import { resolveOf } from '../../../../modules/rpg/view/battle-log/read.js';
import { legendEarned } from '../../../../modules/inventory/validate-parts/legend.js';
import { rulesOfReply } from '../../../../modules/rpg/view/changes-lines-parts/rolls.js';
import { lastFoeTouch } from '../../../../modules/rpg/board/offers.js';

const result = { v: 1, key: 'k', practice: 3, stop: 'won', legend: 1, opened: [{ slot: 2, name: 'Rats', count: 3 }], board: { id: 's:0', seed: 7, offset: 0, groups: [1] },
    checks: [], opening: [], rounds: [{ n: 1, lines: [{ kind: 'act', pc: { who: 'Astra' }, skill: 'Slash' }] }], hurts: [], summary: { exchanges: 1, acts: [], refused: 0 } };
// the port's receipt, as the 200-carrier trim leaves it: `data.v2` kept, `data.interaction` gone
const port = (extra = {}) => ({ id: 'r1', type: 'interaction.settle', summary: '', replan: { payload: { kindId: FIGHT_KIND, key: 'i:s:0:s:0' } }, data: { v2: { key: 'ia:story-block/fight:k:reply:s', result } }, ...extra });
const other = { id: 'r9', type: 'interaction.settle', replan: { payload: { kindId: 'ia-probe/probe' } }, data: { v2: { result: { v: 1, board: { groups: [9] }, legend: 1 } } } };

test('fightResults finds the settle receipts, in order, and nothing else', () => {
    const planner = { id: 'p', type: 'rpg.resolve', replan: { payload: { key: 'x', plan: {} } }, data: { v2: { result: { v: 1 } } } };
    assert.deepEqual(fightResults([planner, port(), other, port({ id: 'r2' })]).map(entry => entry.receipt.id), ['r1', 'r2']);
    assert.deepEqual(fightResults(null), []);
    assert.equal(fightResults([port({ data: {} })]).length, 0, 'a receipt with no record is left out');
    assert.equal(isFightReceipt(planner), false);
    assert.equal(isRollReceipt(planner), false, 'a planner record is no roll: nothing writes one');
    assert.equal(isRollReceipt(other), false, 'another kind is no roll');
});

test('the readers answer from a port settle', () => {
    for (const make of [port]) {
        const receipt = make();
        assert.deepEqual(rollOf([receipt]), result);
        assert.deepEqual(usesOf(rollOf([receipt])), [{ who: 'Astra', skill: 'Slash', n: 1 }]);
        assert.deepEqual(openedSlots([receipt]), [2]);
        assert.equal(rollsOf([{ index: 3, receipt }], 3).result, result);
        assert.equal(boardWin([receipt]).won, true);
        assert.equal(legendEarned({ receipts: () => [{ index: 2, receipt }], reply: { index: 4 } }), true);
        assert.equal(lastFoeTouch([{ index: 5, receipt }]), 5);
        assert.notEqual(rulesOfReply({ receipts: [receipt] }), null, 'the reply has a roll, so its rules are read');
    }
});

test('a settle of another kind is not read as a fight', () => {
    assert.equal(rollOf([other]), null);
    assert.equal(rulesOfReply({ receipts: [other] }), null);
    assert.deepEqual(openedSlots([other]), []);
    assert.equal(boardWin([other]), null);
    assert.equal(legendEarned({ receipts: () => [{ index: 1, receipt: other }], reply: { index: 4 }, query: () => null }), false);
});
