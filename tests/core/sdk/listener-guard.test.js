// sdk.on(name, fn, { module }): with suite.isolatedApply on, a listener's throw or rejection becomes that module's Problem on the reply; off, it is as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../packages/story-block/testkit/index.js';
import { createEvents } from '../../../core/sdk/events.js';
import { guardListener } from '../../../core/sdk/listener-guard.js';
import { FLAGS } from '../../../core/runtime/flags.js';

const ON = { flags: { [FLAGS.isolatedApply]: true } };
const reply = (text, lines) => `${text}\n\n<Changes>\n${lines.join('\n')}\n</Changes>`;
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

function rig(on) {
    const reports = [];
    const events = createEvents({ flag: () => on, report: entry => { reports.push(entry); return entry; }, problems: id => reports.filter(item => item.module === id) });
    return { events, reports };
}

test('guardListener: a listener without a module is returned as it is', () => {
    const fn = () => {};
    assert.equal(guardListener(fn, {}), fn);
});

test('flag off: a throw is only logged, a rejection is not touched, no Problem', async t => {
    const warn = t.mock.method(console, 'warn', () => {});
    const { events, reports } = rig(false);
    const rejected = Promise.reject(new Error('later'));
    rejected.catch(() => {});
    events.on('turn', () => { throw new Error('now'); }, { module: 'm1' });
    events.on('turn', () => rejected, { module: 'm1' });
    events.emit('turn', { index: 3 });
    await tick();
    assert.equal(warn.mock.callCount(), 1);
    assert.deepEqual(reports, []);
});

test('flag on: a sync throw and a rejected promise each become one Problem for the module, once per index', async t => {
    t.mock.method(console, 'warn', () => {});
    const { events, reports } = rig(true);
    events.on('turn', () => { throw new Error('now'); }, { module: 'm1' });
    events.on('head', async () => { throw new Error('later'); }, { module: 'm2' });
    events.emit('turn', { index: 3 });
    events.emit('turn', { index: 3 });
    events.emit('head', { index: 3 });
    await tick();
    assert.deepEqual(reports, [
        { module: 'm1', index: 3, code: 'FAILED', message: 'turn failed: now' },
        { module: 'm2', index: 3, code: 'FAILED', message: 'head failed: later' },
    ]);
    events.emit('turn', { index: 4 });
    assert.equal(reports.length, 3);
});

test('flag on: a listener that does not fail reports nothing, and one failing listener leaves the next one running', async t => {
    t.mock.method(console, 'warn', () => {});
    const { events, reports } = rig(true);
    const seen = [];
    events.on('turn', () => { throw new Error('x'); }, { module: 'm1' });
    events.on('turn', payload => { seen.push(payload.index); return Promise.resolve(); }, { module: 'm2' });
    events.on('turn', payload => { seen.push(`plain${payload.index}`); throw new Error('plain'); });
    events.emit('turn', { index: 1 });
    await tick();
    assert.deepEqual(seen, [1, 'plain1']);
    assert.deepEqual(reports.map(item => item.module), ['m1']);
});

test('off() removes a guarded listener', () => {
    const { events } = rig(true);
    let calls = 0;
    const off = events.on('turn', () => { calls += 1; }, { module: 'm1' });
    events.emit('turn', { index: 1 });
    off();
    events.emit('turn', { index: 2 });
    assert.equal(calls, 1);
});

test('host: a module\'s turn listener that fails is that module\'s Problem on the reply with the flag on, and nothing with it off', async t => {
    t.mock.method(console, 'warn', () => {});
    for (const [settings, listed] of [[null, 0], [ON, 1]]) {
        const host = await createHost({ ...(settings ? { settings } : {}) });
        t.after(() => host.close());
        // (off: a rejection nobody handles is today's behaviour and would fail the runner, so the off run throws instead)
        host.sdk.on('turn', () => { if (!listed) throw new Error('tick refused'); return Promise.reject(new Error('tick refused')); }, { module: 'guard-test' });
        await host.send('Go.', reply('The road.', ['~ place Cellar']));
        await tick();
        const mine = host.turn.problems('guard-test');
        assert.equal(mine.length, listed);
        if (listed) assert.deepEqual([mine[0].code, mine[0].index, mine[0].message], ['FAILED', host.store.headIndex(), 'turn failed: tick refused']);
        assert.equal(host.api.get('scene.place'), 'Cellar');
    }
});
