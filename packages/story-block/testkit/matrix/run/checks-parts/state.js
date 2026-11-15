// Store-state checks for the matrix runner: no store problems, a cold rebuild, changed facts and the fresh-host oracle.

import assert from 'node:assert/strict';
import { createStore } from '../../../../src/v2/store.js';
import { createCommandBus } from '../../../../src/v2/commands.js';
import { keysOf, activeOf, label, factsOf, withHost, runSetups, play } from '../host.js';

const noProblems = host => assert.deepEqual(host.store.problems(), [], 'the store reports problems');
/**
 * A cold rebuild: a second store over the same chat, set up the way a reload does it (the registry's
 * initial state for a first carrier that lacks one), must read the state the live store has.
 */
function replayed(host, when = '') {
    assert.ok(host.ctx.chat.some(message => !message.is_user && message.extra?.storySuite?.ops?.length), 'no reply was recorded, so there is nothing to replay');
    const registry = host.registry;
    const validate = (state, names) => names.flatMap(name => {
        const fn = registry.validator(name);
        const errors = typeof fn === 'function' ? fn(state?.domains?.[name], state) : [];
        return Array.isArray(errors) ? errors.map(String) : [];
    });
    const chat = structuredClone(host.ctx.chat);
    const metadata = structuredClone(host.ctx.chatMetadata ?? {});
    const fresh = createStore({ chat: () => chat, metadata: () => metadata, save: () => {}, validate, scratch: name => registry.scratch(name) });
    // As on a real reload, the bus attaches the owners' replay guards before the first store read.
    createCommandBus({ store: fresh, registry, settings: id => host.sdk.settings(id) });
    fresh.ensureInitial(registry.initialState());
    assert.deepEqual(fresh.head().domains, host.head().domains, `a cold rebuild from the chat's records is not the live state${when}`);
    assert.deepEqual(fresh.problems(), [], `a cold rebuild reports problems${when}`);
}
function changed(before, after, keys, what) {
    for (const key of keysOf({}, keys)) assert.notDeepEqual(after[key], before[key], `${label(key)}: ${what} changed nothing it keeps`);
}

/** The facts a fresh host ends with after `plays` ([{ set, keys? }]), the oracle for the swipe, re-read, delete and late cases. */
async function oracle(env, row, plays, { keys = activeOf(row) } = {}) {
    return withHost(env, row.modules, {}, async host => {
        await runSetups(host, keys);
        for (const entry of plays) await play(host, entry.keys ?? keys, entry.set);
        return factsOf(host, keys);
    });
}
export { noProblems, replayed, changed, oracle };
