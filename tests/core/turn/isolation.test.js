// Isolated apply (flag `suite.isolatedApply`, default off): with it on, one core part that throws in afterCapture costs only its own steps,
// the problems a hook answers reach the reply's Problems, and a reply whose lines could not be kept still tells the other modules.
// With it off each of these is exactly as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { mergeParts } from '../../../src/v2/domains/core/merge.js';
import { FLAGS, flagOn } from '../../../src/v2/flags.js';

const ON = { flags: { [FLAGS.isolatedApply]: true } };
const reply = (text, lines) => `${text}\n\n<Changes>\n${lines.join('\n')}\n</Changes>`;

function noting({ seen = [] } = {}) {
    return {
        id: 'noting-test', name: 'Noting test', version: '0.0.0',
        hooks: {
            afterCapture() { return { problems: [{ code: 'LIMITED', message: 'The note could not be used.' }] }; },
            afterReceive(_view, info) { seen.push(info.index); },
        },
    };
}

const part = hooks => ({ hooks: { afterCapture: hooks } });
const step = type => ({ commands: [{ type, payload: {} }] });

test('flags: the isolated-apply flag is off unless stored as true', () => {
    assert.equal(flagOn({ storySuite: {} }, FLAGS.isolatedApply), false);
    assert.equal(flagOn({ storySuite: { flags: { [FLAGS.isolatedApply]: 'yes' } } }, FLAGS.isolatedApply), false);
    assert.equal(flagOn(() => ({ storySuite: ON }), FLAGS.isolatedApply), true);
});

test('merged afterCapture, flag off: one part throwing loses the whole answer, as before', () => {
    const merged = mergeParts([part(() => step('a.one')), part(() => { throw new Error('torn'); })]);
    assert.throws(() => merged.hooks.afterCapture({}, {}), /torn/);
});

test('merged afterCapture, flag on: the other parts\' commands are kept and a problem names the failing part', async () => {
    const merged = mergeParts([part(() => step('a.one')), part(function broken() { throw new Error('torn'); }), part(async () => step('c.three')), part(async () => { throw new Error('late'); })], { flagOn: name => name === FLAGS.isolatedApply });
    const out = await merged.hooks.afterCapture({}, {});
    assert.deepEqual(out.commands.map(command => command.type), ['a.one', 'c.three']);
    assert.equal(out.problems.length, 2);
    assert.match(out.problems[0].message, /afterCapture failed \(broken\): torn/);
    assert.match(out.problems[1].message, /afterCapture failed \(part 4\): late/);
});

test('merged afterCapture, flag on: with no failure the answer is as before (sync stays sync)', () => {
    const merged = mergeParts([part(() => step('a.one')), part(() => undefined)], { flagOn: () => true });
    assert.deepEqual(merged.hooks.afterCapture({}, {}), step('a.one'));
    const none = mergeParts([part(() => undefined), part(() => null)], { flagOn: () => true });
    assert.equal(none.hooks.afterCapture({}, {}), undefined);
});

test('hook problems: dropped with the flag off, the module\'s Problems with it on', async t => {
    t.mock.method(console, 'warn', () => {});
    for (const [settings, kept] of [[null, false], [ON, true]]) {
        const host = await createHost({ modules: [noting()], ...(settings ? { settings } : {}) });
        t.after(() => host.close());
        const turns = [];
        host.events.on('turn', done => turns.push(done));
        await host.send('Hello.', reply('The road.', ['~ place Guild Office | kind: settlement']));
        const found = turns.at(-1).problems.filter(item => item.module === 'noting-test');
        assert.equal(found.length, kept ? 1 : 0, `flag ${kept ? 'on' : 'off'}`);
        if (kept) assert.deepEqual([found[0].code, found[0].message], ['LIMITED', 'The note could not be used.']);
    }
});

test('a reply whose lines could not be kept: flag off stops there; flag on still runs afterReceive and sends the turn with the Problem', async t => {
    t.mock.method(console, 'warn', () => {});
    for (const [settings, tail] of [[null, false], [ON, true]]) {
        const seen = [];
        const host = await createHost({ modules: [noting({ seen })], ...(settings ? { settings } : {}) });
        t.after(() => host.close());
        const turns = [];
        host.events.on('turn', done => turns.push(done));
        host.store.batch = () => { throw new Error('the batch broke'); };
        await host.send('Hello.', reply('The road.', ['~ place Guild Office | kind: settlement']));
        const failure = host.turn.problems().find(item => /could not be kept: the batch broke/.test(item.message));
        assert.ok(failure, 'the Problem is there either way');
        assert.equal(turns.length, tail ? 1 : 0, `flag ${tail ? 'on' : 'off'}: turn event`);
        assert.equal(seen.length, tail ? 1 : 0, `flag ${tail ? 'on' : 'off'}: afterReceive`);
        if (tail) assert.deepEqual(turns[0].problems.map(item => item.message), [failure.message]);
    }
});
