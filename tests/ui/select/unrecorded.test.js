import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { withAssist } from '../../../core/capture.js';
import { unrecordedAt } from '../../../ui/select/unrecorded.js';

const record = { extra: { storySuite: { v: 2, sid: 's', ops: [], receipts: [], narrated: [] } } };
const reply = (mes, extra = {}) => ({ is_user: false, name: 'N', mes, ...record, ...extra });
const user = { is_user: true, mes: 'hi' };

describe('unrecordedAt', () => {
  it('is true for the last reply with no block and nothing stored, false with a block, with stored repair lines, for the greeting and for no record', () => {
    const greeting = reply('Hello.');
    assert.equal(unrecordedAt([greeting, user, reply('He nods.')]), true);
    assert.equal(unrecordedAt([greeting, user, reply('He nods.\n\n<!-- STORY_SUITE_V2\n<Changes>\n</Changes>\n-->')]), false, 'a block, even an empty one');
    assert.equal(unrecordedAt([greeting, user, reply(withAssist('He nods.', ['+ item Rope | qty: 1']))]), false, 'a repair is stored');
    assert.equal(unrecordedAt([greeting]), false, 'the greeting never');
    assert.equal(unrecordedAt([greeting, user, { is_user: false, mes: 'No record.' }]), false);
    assert.equal(unrecordedAt([greeting, user, reply('A.'), user, reply('B.\n<Changes>\n</Changes>')]), false, 'the last one decides');
    assert.equal(unrecordedAt([greeting, user, reply('A.'), user, reply('B.\n<Changes>\n</Changes>')], 2), true, 'reply 2 asked for');
    assert.equal(unrecordedAt(null), false);
  });
});
