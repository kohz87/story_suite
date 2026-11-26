// A receipt's own card line (`data.card`) reaches the reply's Changes rows: one that was done as a change, a refused one as not applied with its reason.
import test from 'node:test';
import assert from 'node:assert/strict';
import { replyChanges } from '../../../modules/scene/domains/core/reply-changes.js';
import { replyLines } from '../../../ui/select/chat.js';

const receipt = (data, cause = 'story') => ({ index: 2, receipt: { type: 'capture.nap', cause, summary: 'x', data } });
const rows = entries => replyLines({ 'reply.changes': replyChanges({}, { index: 2 }, { receipts: () => entries }, () => 2) });

test('a done line and a refused one are rows; a refused one is not applied and keeps its why', () => {
    const got = rows([receipt({ card: { line: 'The party rests.' } }), receipt({ card: { line: 'Rest refused: the fight with Hogs is still on.', detail: 'End them.', refused: true } })]);
    assert.deepEqual(got.map(row => [row.line, row.applied, row.detail]), [['The party rests.', true, null], ['Rest refused: the fight with Hogs is still on.', false, 'End them.']]);
});

test('no card, a blank one or the reader\'s own action adds nothing', () => {
    assert.equal(rows([receipt({}), receipt({ card: { line: ' ' } }), receipt({ card: { line: 'Mine.' } }, 'ui')]), null);
});
