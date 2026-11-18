// A Problems row follows its reply (core/turn/problem-reply.js): after a middle delete the row names the reply's new place, after a reload too.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeHost } from './turn.helpers.js';

// The real store (record IDs on each reply), not the fake one.
const realHost = () => fakeHost({ fakes: false });

const block = lines => ['Done.', '<Changes>', ...lines, '</Changes>'].join('\n');

test('a middle delete moves a later reply\'s Problems row with it; a reload keeps it there', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await realHost();
    t.after(() => host.close());
    await host.send('One.', block(['+ item Rope | qty: 2']));
    await host.send('Two.', block(['+ item Lamp']));
    await host.send('Three.', block(['+ item Oil', '- item Lantern']));
    const before = host.turn.problems().filter(row => row.code === 'NOT_ENOUGH');
    assert.equal(before.length, 1);
    assert.equal(before[0].index, 6, 'made on the third reply');
    assert.equal(typeof before[0].sid, 'string', 'stamped with the reply\'s record ID');
    // Delete the middle pair (the user message and reply at 3 and 4): the third reply is now at 4.
    await host.st.deleteMessage(4);
    await host.st.deleteMessage(3);
    await host.turn.onChatChanged();
    assert.equal(host.ctx.chat[4].mes.startsWith('Done.'), true);
    const after = host.turn.problems().filter(row => row.code === 'NOT_ENOUGH');
    assert.equal(after.length, 1);
    assert.equal(after[0].index, 4, 'the row names the reply where it is now');
    await host.st.loadChat(JSON.parse(JSON.stringify(host.ctx.chat)));
    const reloaded = host.turn.problems().filter(row => row.code === 'NOT_ENOUGH');
    assert.deepEqual(reloaded.map(row => row.index), [4], 'a reload keeps the row with its reply');
});

test('a row whose reply is where it was keeps its number; a row with no reply keeps none', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await realHost();
    t.after(() => host.close());
    await host.send('One.', block(['+ item Rope', '- item Lantern']));
    host.turn.report({ code: 'NOTE', message: 'A row of no reply.' });
    const rows = host.turn.problems();
    assert.deepEqual(rows.map(row => [row.code, row.index]), [['NOT_ENOUGH', 2], ['NOTE', undefined]]);
    assert.equal(rows[1].sid, undefined);
});
