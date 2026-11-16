// The oracle's prefix memo (rebuildAt with a Map) must return exactly what a rebuild without one returns, for every
// carrier of a chat, in ascending order and in a shuffled order, so the memo cannot hide a replay bug.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { probeModule } from './helpers/probe-module.js';
import { carriers, rebuildAt } from './helpers/oracle.js';

const reply = (text, lines) => `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>`;

test('rebuildAt with a memo equals rebuildAt without one at every carrier of a sample chat', async t => {
    t.mock.method(console, 'warn', () => {});
    const h = await createHost({ modules: [probeModule()] });
    t.after(() => h.close());
    await h.send('Hello.', reply('Fenna comes in.', ['+ present Fenna']));
    await h.send('Supplies?', reply('Three torches.', ['+ item Torch | qty: 3']));
    await h.send('Bye.', reply('Fenna leaves.', ['- present Fenna']));
    await h.send('Light one.', reply('One burns out.', ['- item Torch']));
    await h.send('Back?', reply('Fenna is back with a rope.', ['+ present Fenna', '+ item Rope | qty: 2']));
    await h.st.deleteMessage(4);
    await h.send('More.', reply('Another torch.', ['+ item Torch']));

    const chat = h.ctx.chat;
    const list = carriers(chat);
    assert.ok(list.length >= 4, 'the sample chat has several carriers');
    const plain = value => JSON.parse(JSON.stringify(value));
    const orders = [list, [...list].reverse(), [list.at(-1), list[0], ...list.slice(1, -1)]];
    for (const order of orders) {
        const memo = new Map();
        for (const index of order) {
            const bare = rebuildAt(chat, index);
            const memoed = rebuildAt(chat, index, memo);
            assert.deepEqual(plain(memoed), plain(bare), `carrier ${index}: the memoized rebuild equals the plain one`);
            assert.deepEqual(plain(rebuildAt(chat, index, memo)), plain(bare), `carrier ${index}: a second read from the memo is the same`);
        }
    }
});
