// 'pending' (a v2 host on the page that has not accepted the module) is time-bound: when the host's `ready` never settles, the adapter counts it as refused after the
// bound, so the sidecar is given back instead of being held for the whole session.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorySuiteV2Adapter } from '../../packages/npc-state-delta/src/storysuite-v2.js';

test('a host whose ready never settles: pending first, refused once the bound passes', async t => {
    t.mock.method(console, 'warn', () => {});
    const box = { ready: new Promise(() => {}), sdk: { registerModule: async () => {} } };
    const adapter = createStorySuiteV2Adapter({
        host: () => box, doc: { documentElement: { dataset: {} }, getElementById: () => null, addEventListener() {}, dispatchEvent() { return true; } },
        delta: () => ({ isEnabled: () => true, chatKey: () => 'chat:x' }), loadEmptyCast: async () => null, logger: { warn() {} },
        retryMs: 10, attempts: 4,
        timers: { setTimeout: (fn, ms) => { const id = setTimeout(fn, ms); id.unref?.(); return id; }, clearTimeout, setInterval: () => ({ unref() {} }), clearInterval() {} },
    });
    t.after(() => adapter.stop());
    adapter.start();
    await new Promise(resolve => setTimeout(resolve, 15));
    assert.equal(adapter.storeOwns(), 'pending', 'within the bound nothing is written to a sidecar');
    await new Promise(resolve => setTimeout(resolve, 60));
    assert.equal(adapter.storeOwns(), false, 'past the bound the host counts as refused');
});
