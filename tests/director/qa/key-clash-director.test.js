// QA: the key-clash check (Story Block's qa helpers/key-clash.js) sees Story Director's keys: a problem keyed `<sid>.<n>`
// (reply-keys.js) that a later reply's stored add lands on again fails it; the same chat without the forced clash does not.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readRecord, writeRecord } from '../../../core/persist.js';
import { keyClashes } from '../../../packages/story-block/tests/v2/qa/helpers/key-clash.js';
import { makeDirectorHost } from './helpers/reread-host.js';

const bad = '<Changes>\n~ quest a1 | step:\n</Changes>';

test('keyClashes fails a forced clash on a Story Director problem key, and passes the chat without it', async t => {
    const host = await makeDirectorHost();
    t.after(() => host.close());
    await host.send('one', `Text.\n${bad}`);
    await host.send('two', `Text.\n${bad}`);
    const problemAdds = () => host.ctx.chat.flatMap((message, index) => (readRecord(message)?.ops ?? []).filter(op => op.op === 'add' && /^\/domains\/director\/problems\//.test(op.path)).map(op => ({ index, op })));
    const adds = problemAdds();
    assert.ok(adds.length >= 2 && adds[0].index !== adds.at(-1).index, 'each reply stored a problem');
    assert.match(adds[0].op.path, /\/[A-Za-z][\w:-]*\.\d+$/, 'the key is `<sid>.<n>`');
    assert.deepEqual(keyClashes(host.ctx.chat), [], 'no clash on the chat as told');
    const last = adds.at(-1);
    const record = readRecord(host.ctx.chat[last.index]);
    const same = record.ops.find(op => op.op === 'add' && op.path === last.op.path);
    same.path = adds[0].op.path;
    same.value = { ...same.value, forced: true };
    writeRecord(host.ctx.chat[last.index], record);
    const clashes = keyClashes(host.ctx.chat);
    assert.equal(clashes.length, 1);
    assert.equal(clashes[0].kind, 'rev');
    assert.equal(clashes[0].path, adds[0].op.path);
});
