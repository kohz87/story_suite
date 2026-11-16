// sdk `changed`: one event per reply with the touched domains, ['*'] on head moves, out-of-turn commands as one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { createEvents } from '../../../src/v2/sdk/events.js';
import { createChangedFeed } from '../../../src/v2/sdk/changed.js';
import { EVENTS } from '../../../src/v2/sdk.js';

const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const counter = {
    id: 'counter', name: 'Counter', version: '2.0.0-alpha.1',
    domains: { tally: { initial: () => ({ n: 0 }) }, other: { initial: () => ({ n: 0 }) } },
    commands: {
        'tally.add'(ctx) { ctx.draft('tally').n += 1; return {}; },
        'ab.add'(ctx) { ctx.draft('other').n += 1; return {}; },
    },
    capture: { kinds: { tally: { grammar: '+ tally Name' } }, apply(ctx) { ctx.draft('tally').n += 1; return {}; } },
};
// A cue before the reply writes the "cue" domain (a system commit on the previous reply); the reply writes "tally".
const cued = {
    id: 'cued', name: 'Cued', version: '2.0.0-alpha.1',
    domains: { cue: { initial: () => ({ n: 0 }) } },
    commands: { 'cue.bump'(ctx) { ctx.draft('cue').n += 1; return {}; } },
    hooks: { beforeGenerate: () => ({ commands: [{ type: 'cue.bump', payload: {} }] }) },
};

// A store stand-in: the head carrier's stored ops.
function rig() {
    const store = { index: 1, ops: { 1: [] }, headIndex() { return this.index; }, opsAt(i) { return this.ops[i] ?? []; } };
    const events = createEvents();
    const got = [];
    events.on('changed', value => got.push(value));
    createChangedFeed({ store, events });
    const add = (index, ...paths) => { (store.ops[index] ??= []).push(...paths.map(path => ({ op: 'replace', path, value: 1 }))); };
    return { store, events, got, add };
}

test('changed is a known event, listed last so the others keep their order', () => {
    assert.deepEqual(EVENTS, ['committed', 'head', 'turn', 'feature', 'modules', 'changed']);
});

test('a reply: its lines wait, and one changed follows turn with the touched domains', async () => {
    const { events, got, add } = rig();
    add(1, '/domains/tally/n', '/domains/a~1b/n', '/meta/rev');
    events.emit('committed', { receipt: { cause: 'story' } });
    events.emit('committed', { receipt: { cause: 'system' } });
    await tick();
    assert.deepEqual(got, []);
    events.emit('turn', { index: 1 });
    assert.deepEqual(got, [], 'after the turn listeners, not inside them');
    await tick();
    assert.deepEqual(got, [{ keys: ['a/b', 'tally'], index: 1, reason: 'turn' }]);
});

test('an out-of-turn command: several in one go are one changed, one microtask later, only the new keys', async () => {
    const { events, got, add } = rig();
    add(1, '/domains/tally/n');
    events.emit('turn', { index: 1 });
    await tick();
    got.length = 0;
    add(1, '/domains/other/x');
    events.emit('committed', { receipt: { cause: 'ui' } });
    add(1, '/domains/other/y');
    events.emit('committed', { receipt: { cause: 'ui' } });
    assert.deepEqual(got, []);
    await tick();
    assert.deepEqual(got, [{ keys: ['other'], index: 1, reason: 'command' }]);
});

test('head moves (swipe, delete, rewind, chat) tell ["*"] and the next reply starts from the new head', async () => {
    const { store, events, got, add } = rig();
    add(1, '/domains/tally/n');
    events.emit('head', { index: 1, reason: 'rewind' });
    events.emit('head', { index: 1, reason: 'chat' });
    await tick();
    assert.deepEqual(got, [{ keys: ['*'], index: 1, reason: 'chat' }]);
    store.index = 0; store.ops[0] = [];
    got.length = 0;
    events.emit('head', { index: 0 });
    await tick();
    assert.deepEqual(got.map(value => [value.keys, value.index, value.reason]), [[['*'], 0, 'head']]);
    store.index = 2; add(2, '/domains/tally/n');
    events.emit('turn', { index: 2 });
    await tick();
    assert.deepEqual(got.at(-1), { keys: ['tally'], index: 2, reason: 'turn' });
});

test('a Re-read: committed, head, turn give one changed ["*"]; an edited Re-read (fewer ops) too', async () => {
    const { store, events, got, add } = rig();
    add(1, '/domains/tally/n', '/domains/tally/m');
    events.emit('turn', { index: 1 });
    await tick();
    got.length = 0;
    store.ops[1] = [{ op: 'replace', path: '/domains/tally/n', value: 5 }];   // the edit replaced the reply's changes
    events.emit('committed', { receipt: { cause: 'story' } });
    events.emit('head', { index: 1, reason: 'reread' });
    events.emit('turn', { index: 1, type: 'reread' });
    await tick();
    assert.deepEqual(got, [{ keys: ['*'], index: 1, reason: 'reread' }]);
    // the next look starts from the shorter list, so the next reply's keys are right
    add(1, '/domains/z/n');
    events.emit('turn', { index: 1 });
    await tick();
    assert.deepEqual(got.at(-1).keys, ['z']);
});

test('a store that cannot answer tells ["*"] and a listener failure does not stop the feed', async t => {
    t.mock.method(console, 'warn', () => {});
    const events = createEvents();
    const got = [];
    events.on('changed', () => { throw new Error('bug'); });
    events.on('changed', value => got.push(value));
    createChangedFeed({ store: { headIndex() { throw new Error('gone'); }, opsAt() { return []; } }, events });
    events.emit('turn', { index: 1 });
    await tick();
    assert.deepEqual(got, [{ keys: ['*'], index: null, reason: 'turn' }]);
});

test('live: a reply, an out-of-turn command, a swipe and a delete; committed and turn keep their count', async () => {
    const host = await createHost({ fakes: true, core: false, modules: [counter] });
    const seen = [];
    for (const name of ['committed', 'turn', 'head', 'changed']) host.sdk.on(name, value => seen.push([name, value?.keys, value?.receipt?.cause, value?.receipt?.type]));
    const names = () => seen.map(entry => entry[0]);
    await host.send('Go.', 'Done.\n\n<Changes>\n+ tally Name\n</Changes>');
    await tick();
    assert.deepEqual(seen.filter(entry => entry[0] === 'changed').map(entry => entry[1]), [['tally']], 'the reply tells its own domain');
    assert.ok(names().indexOf('turn') < names().indexOf('changed'), 'changed follows turn');
    seen.length = 0;
    await Promise.all([host.sdk.command('tally.add'), host.sdk.command('ab.add')]);
    await tick();
    assert.deepEqual(seen.filter(entry => entry[0] === 'changed').map(entry => entry[1]), [['other', 'tally']]);
    assert.equal(names().filter(name => name === 'committed').length, 2);
    seen.length = 0;
    await host.swipe('Other.\n\n<Changes>\n+ tally Name\n</Changes>');
    await tick();
    assert.deepEqual(seen.filter(entry => entry[0] === 'changed').map(entry => entry[1]), [['*'], ['tally']], 'a swipe tells ["*"] (the head moved), then its reply');
    seen.length = 0;
    await host.st.swipeTo(host.ctx.chat.length - 1, 0);
    await tick();
    assert.deepEqual(seen.filter(entry => entry[0] === 'changed').map(entry => entry[1]), [['*']], 'a swipe back tells ["*"] once');
    seen.length = 0;
    await host.cont('More.\n\n<Changes>\n+ tally Name\n</Changes>');
    await tick();
    assert.deepEqual(seen.filter(entry => entry[0] === 'changed').map(entry => entry[1]), [['tally']], 'a Continue tells only its new ops');
    host.close();
});

test('live: a Re-read, an edited Re-read and a middle delete each tell, and the keys after them are right', async () => {
    const host = await createHost({ core: false, modules: [counter] });
    const got = [];
    host.sdk.on('changed', value => got.push(value));
    const last = () => host.ctx.chat.length - 1;
    await host.send('One.', 'A.\n\n<Changes>\n+ tally Name\n</Changes>');
    await host.send('Two.', 'B.\n\n<Changes>\n+ tally Name\n</Changes>');
    await tick();
    got.length = 0;
    const first = await host.turn.reread(last());
    assert.equal(first.ok, true, JSON.stringify(first));
    await tick();
    assert.equal(got.length, 1, 'a Re-read is one changed');
    assert.deepEqual(got[0].keys, ['*']);
    got.length = 0;
    host.ctx.chat[last()].mes = 'B2.\n\n<Changes>\n+ tally Name\n+ tally Name\n</Changes>';
    assert.equal((await host.turn.reread(last())).ok, true);
    await tick();
    assert.equal(got.length, 1, 'an edited Re-read is one changed');
    assert.deepEqual(got[0].keys, ['*']);
    got.length = 0;
    await host.st.deleteMessage(1);
    await tick();
    assert.ok(got.length >= 1 && got.every(value => value.keys[0] === '*'), 'a middle delete tells ["*"]');
    got.length = 0;
    await host.sdk.command('tally.add');
    await tick();
    assert.deepEqual(got.map(value => value.keys), [['tally']], 'the next command tells only its own keys');
    host.close();
});

test('live: a cue before the reply and a module set up mid-chat are told, not only the reply\'s own domain', async () => {
    const host = await createHost({ fakes: true, core: false, modules: [counter, cued] });
    const got = [];
    host.sdk.on('changed', value => got.push(value));
    await host.send('One.', 'A.\n\n<Changes>\n+ tally Name\n</Changes>');
    await tick();
    got.length = 0;
    await host.send('Two.', 'B.\n\n<Changes>\n+ tally Name\n</Changes>');
    await tick();
    const told = new Set(got.flatMap(value => value.keys));
    assert.ok(told.has('cue') && told.has('tally'), `both domains told: ${JSON.stringify(got)}`);
    got.length = 0;
    await host.sdk.registerModule({ id: 'late', name: 'Late', version: '2.0.0-alpha.1', domains: { lt: { initial: () => ({ n: 0 }) } } });
    await tick();
    assert.ok(got.some(value => value.keys.includes('lt') || value.keys.includes('*')), `a module set up mid-chat is told: ${JSON.stringify(got)}`);
    host.close();
});

test('a change that stored nothing is not told (keys are never empty)', async () => {
    const { events, got } = rig();
    events.emit('turn', { index: 1 });
    events.emit('committed', { receipt: { cause: 'ui' } });
    await tick();
    assert.deepEqual(got, []);
});

test('a standalone system commit is told; the old carrier\'s growth joins the next reply', async () => {
    const { store, events, got, add } = rig();
    add(1, '/domains/a/n');
    events.emit('turn', { index: 1 });
    await tick();
    got.length = 0;
    add(1, '/domains/late/n');
    events.emit('committed', { receipt: { cause: 'system' }, standalone: true });
    await tick();
    assert.deepEqual(got, [{ keys: ['late'], index: 1, reason: 'command' }]);
    got.length = 0;
    add(1, '/domains/cue/n');
    events.emit('committed', { receipt: { cause: 'system' } });   // a cue: waits for its reply
    store.index = 2; add(2, '/domains/tally/n');
    events.emit('turn', { index: 2 });
    await tick();
    assert.deepEqual(got, [{ keys: ['cue', 'tally'], index: 2, reason: 'turn' }]);
});
