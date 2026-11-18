// Perf PB8 (docs/dev/edit-prose-only.md): an edit that adds or removes a word a capture reads from prose (a day or month name, a
// cast person's name or alias, a "#N") is not prose-only and plans the steps again; a plain prose edit still skips. Also the
// guards of the detection that the other tests do not pin: a swipe the head did not tell of, a silent length change.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { changedWords, touchesCaptureWords } from '../../core/turn/edit-words.js';
import { Q1, guarded } from './helpers/guarded.js';

async function chat(t, names = ['Brannoc the Ferryman', 'Old Wick']) {
    const module = guarded();
    module.queries = { ...module.queries, 'npc.known': () => names };
    const host = await createHost({ modules: [module], core: false });
    t.after(() => host.close());
    t.mock.method(console, 'warn', () => {});
    const replies = [];
    for (let k = 0; k < 3; k++) {
        await host.send(`Go ${k}.`, `Story ${k} goes on.\n\n<Changes>\n! tick ${30 * k}\n</Changes>`);
        replies.push(host.ctx.chat.length - 1);
        await host.bus.command('gt.attempt', { id: Q1 }, { cause: 'system' });
    }
    await host.store.flush();
    let calls = 0;
    const reconcile = host.store.reconcile;
    host.store.reconcile = (...args) => { calls += 1; return reconcile.apply(host.store, args); };
    return { host, replies, reconciles: () => calls };
}
const edit = (host, at, from, to) => host.st.editMessage(at, host.ctx.chat[at].mes.replace(from, to));

test('changedWords is the multiset difference, and touchesCaptureWords reads the lists', () => {
    assert.deepEqual(changedWords('a b b', 'a b c').sort(), ['b', 'c']);
    assert.equal(touchesCaptureWords('It rained.', 'It rained hard.', () => ['Old Wick']), false);
    assert.equal(touchesCaptureWords('It rained.', 'It rained on Monday.', () => []), true);
    assert.equal(touchesCaptureWords('See #3 "no".', 'See #4 "no".', () => []), true);
    assert.equal(touchesCaptureWords('Wick left.', 'Nobody left.', () => ['Old Wick']), true);
    assert.equal(touchesCaptureWords('A day.', 'A night.', () => { throw new Error('x'); }), true, 'no list: the full path');
    assert.equal(touchesCaptureWords('A day.', 'A night.', () => null), true);
});

test('a plain prose edit still skips; an added day name, cast name, alias part or #N runs the reconcile', async t => {
    const { host, replies, reconciles } = await chat(t);
    await edit(host, replies[0], 'goes on.', 'goes on, quietly.');
    assert.equal(reconciles(), 0, 'plain prose skips');
    let calls = 0;
    const ran = async (label, at, from, to) => { await edit(host, at, from, to); assert.equal(reconciles(), ++calls, `${label}: the reconcile runs`); };
    await ran('a day name', replies[0], 'quietly.', 'quietly, on Tuesday.');
    await ran('a month name', replies[1], 'goes on.', 'goes on in March.');
    await ran('a cast name', replies[2], 'goes on.', 'goes on; Brannoc waits.');
    await ran('part of a cast name or alias', replies[0], 'quietly,', 'quietly, Wick');
    await ran('a #N', replies[1], 'in March.', 'in March (#3).');
    await ran('a removed cast name', replies[2], 'Brannoc waits.', 'waits.');
});

test('the guards: a swipe the head did not tell of and a silent length change take the full path', async t => {
    const { host, replies, reconciles } = await chat(t);
    host.ctx.chat[replies[1]].swipe_id = 1;
    await edit(host, replies[1], 'goes on.', 'goes on, again.');
    assert.equal(reconciles(), 1, 'a swipe changed with no head');
    host.ctx.chat.push({ name: 'u', is_user: true, mes: 'Silent.', extra: {} });
    await edit(host, replies[2], 'goes on.', 'goes on, and on.');
    assert.equal(reconciles(), 2, 'the chat grew with no head');
});
