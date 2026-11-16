// The readers of `data.v2.result` meet a v1 fight's record (rounds are arrays of rows, `board.v1`): none throws, and the two that would pay or practise on the old shape stand aside.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fightKind } from '../../../../modules/rpg/board/interaction.js';
import { dice } from '../../../../core/interaction/dice.js';
import { boardWin } from '../../../../modules/rpg/board/awards.js';
import { fightResults } from '../../../../modules/rpg/board/results.js';
import { exchangesOf } from '../../../../modules/rpg/view/changes-lines-parts/rolls.js';
import { resolveOf } from '../../../../modules/rpg/view/battle-log.js';
import { rollOf, usesOf } from '../../../../modules/rpg/practice-parts/uses.js';
import { boardGroups, openedSlots } from '../../../../modules/rpg/fight-parts/opened.js';
import { fightHook } from '../../../../modules/rpg/fight-parts/hook.js';
import { receiptCue } from '../../../../modules/rpg/cue.js';
import { readSheet } from '../../../../modules/rpg/read.js';
import { step, v1Host } from './v1.helpers.js';

const receiptOf = (result, id = 'rc_1') => ({ id, type: 'interaction.settle', summary: 'note', replan: { payload: { kindId: 'story-block/fight', setup: { v1: 1 } } }, data: { v2: { key: 'k', result } } });

test('a settled v1 fight is read by every reader of the record without a throw, and pays no XP and no practice on the old shape', async () => {
    const host = (await v1Host({ count: 1 })).host;
    try {
        const { setup } = fightKind.open(host.head(), { anchor: 'a', seed: 9, args: { rules: {} } });
        const won = fightKind.settle(host.head(), setup, Array.from({ length: 30 }, () => step()), dice(9, 0)).result;
        assert.equal(won.stop, 'won');
        const receipt = receiptOf(won), record = { receipts: [receipt] };
        assert.equal(fightResults([receipt]).length, 1);
        assert.equal(exchangesOf(record).exchanges, won.rounds.length);
        assert.doesNotThrow(() => resolveOf(record));
        assert.doesNotThrow(() => receiptCue(receipt));
        assert.deepEqual(usesOf(won), [], 'no practice is drawn from the rows (v1 practice comes with the v1 roll)');
        assert.equal(rollOf([receipt])?.practice, won.practice);
        assert.doesNotThrow(() => openedSlots([receipt]));
        const view = { feature: () => true, state: host.head(), before: () => host.head(), settings: () => ({}) };
        assert.equal(boardWin([receipt]).v1, true);
        assert.equal(fightHook(view, { type: 'normal', receipts: [receipt] }), undefined, 'the old XP step is not asked for a v1 win');
        assert.equal(readSheet(host.head()).foes.some(foe => foe.filled), true);
        assert.ok(boardGroups, 'imported');
    } finally { host.close(); }
});
