import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPort } from '../../../ui/port/contract.js';
import { createSbPort, makeReader } from '../../../ui/port/sb-port.js';

function fakeSdk() {
  const handlers = new Map();
  const calls = [];
  return {
    calls,
    query(name, args) {
      calls.push(['query', name, args]);
      if (name === 'boom') throw new Error('bad query');
      if (name === 'nothing') return undefined;
      return { name, args };
    },
    command: async (type, payload, options) => { calls.push(['command', type, payload, options]); return { ok: true, receipt: 1 }; },
    preview: async (type, payload) => { calls.push(['preview', type, payload]); return { ok: true, token: 't1' }; },
    commit: async token => { calls.push(['commit', token]); if (token === 'bad') throw new Error('stale'); return { ok: true }; },
    reread: async index => { calls.push(['reread', index]); return { ok: true, receipts: [] }; },
    on(name, fn) { handlers.set(name, fn); return () => handlers.delete(name); },
    handlers,
  };
}

test('makeReader answers queries and turns a throw or undefined into null', () => {
  const sdk = fakeSdk();
  const read = makeReader(sdk);
  assert.deepEqual(read('scene.place', { a: 1 }), { name: 'scene.place', args: { a: 1 } });
  assert.equal(read('boom'), null);
  assert.equal(read('nothing'), null);
  assert.equal(makeReader(null)('x'), null);
});

test('createSbPort satisfies the port contract', () => {
  assert.equal(checkPort(createSbPort({ sdk: fakeSdk() })).ok, true);
  assert.equal(checkPort(createSbPort()).ok, true);
});

test('view runs the tab selector on the reader, and gaps come back as null', () => {
  const sdk = fakeSdk();
  const port = createSbPort({
    sdk,
    selectors: {
      card: read => ({ place: read('scene.place').name }),
      now: () => { throw new Error('selector bug'); },
      empty: () => undefined,
    },
  });
  assert.deepEqual(port.view('card'), { place: 'scene.place' });
  assert.equal(port.view('now'), null);
  assert.equal(port.view('empty'), null);
  assert.equal(port.view('party'), null);
  assert.equal(port.view('toString'), null);
});

test('command, preview, commit and reread pass through to the sdk', async () => {
  const sdk = fakeSdk();
  const port = createSbPort({ sdk });
  assert.deepEqual(await port.command('item.equip', { stack: 's' }, { background: true }), { ok: true, receipt: 1 });
  assert.equal((await port.preview('mounts.edit', { id: 'm' })).token, 't1');
  assert.equal((await port.commit('t1')).ok, true);
  assert.equal((await port.reread(4)).ok, true);
  assert.deepEqual(sdk.calls.map(c => c[0]), ['command', 'preview', 'commit', 'reread']);
  assert.deepEqual(sdk.calls[0], ['command', 'item.equip', { stack: 's' }, { background: true }]);
});

test('a rejecting or missing sdk method gives { ok:false } instead of throwing', async () => {
  const port = createSbPort({ sdk: fakeSdk() });
  const bad = await port.commit('bad');
  assert.equal(bad.ok, false);
  assert.equal(bad.code, 'FAILED');
  assert.equal(bad.message, 'stale');
  const none = await createSbPort({ sdk: {} }).command('x');
  assert.equal(none.ok, false);
  assert.match(none.message, /no command/);
});

test('on subscribes through the sdk and returns its unsubscribe', () => {
  const sdk = fakeSdk();
  const port = createSbPort({ sdk });
  const off = port.on('head', () => {});
  assert.equal(sdk.handlers.has('head'), true);
  off();
  assert.equal(sdk.handlers.has('head'), false);
  assert.equal(typeof createSbPort({ sdk: {} }).on('turn', () => {}), 'function');
  assert.throws(() => port.on('head', null), TypeError);
});

test('prefs are served from the device and chat stores when given', () => {
  const stored = {};
  const store = { get: () => ({ a: true }), set: (k, v) => { stored[k] = v; } };
  const port = createSbPort({ sdk: fakeSdk(), prefs: { device: store, chat: store } });
  assert.deepEqual(port.prefs.getDevice(), { a: true });
  assert.deepEqual(port.prefs.getChat('c1'), { a: true });
  port.prefs.setDevice('fold', true);
  port.prefs.setChat('c1', 'scene', false);
  assert.deepEqual(stored, { fold: true, scene: false });
  assert.equal(createSbPort({ sdk: fakeSdk() }).prefs, undefined);
  const empty = createSbPort({ sdk: fakeSdk(), prefs: {} });
  assert.deepEqual(empty.prefs.getDevice(), {});
  assert.deepEqual(empty.prefs.getChat('c'), {});
});
