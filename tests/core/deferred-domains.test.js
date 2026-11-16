// Deferred domains and switched-off APIs (docs/v2/LIFECYCLE.md, "Deferred domains"): a module may declare a domain
// `deferred: true` (the chat holds no slice of it until one of the module's commands writes it), and may mark a
// command, query or capture kind with an `enabled` property that reads false while its API is not in use. A module
// that uses neither is unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { createRegistry, definitionProblems } from '../../core/registry.js';
import { staticParts } from '../../core/prompt.js';

const ID = 'zz-deferred';
function module({ gate, deferred = true }) {
    const gated = (fn) => Object.defineProperty(fn, 'enabled', { enumerable: true, get: () => gate.on });
    return {
        id: ID, name: 'Deferred', version: '0.0.1',
        domains: {
            base: { initial: () => ({ n: 0 }) },
            later: { initial: () => ({ chosen: false }), ...(deferred ? { deferred: true } : {}) },
        },
        commands: {
            'zz.choose'(ctx) { Object.assign(ctx.draft('later'), { chosen: true }); return { summary: 'Chosen.', narrate: false }; },
            'zz.gated': gated((ctx) => { ctx.draft('base').n += 1; return { summary: 'Gated.', narrate: false }; }),
        },
        queries: {
            'zz.chosen': state => state.domains.later?.chosen === true,
            'zz.gatedQuery': gated(() => 'answer'),
        },
        capture: {
            kinds: {
                plain: { grammar: '! plain Word' },
                gated: Object.defineProperty({ grammar: '! gated Word' }, 'enabled', { enumerable: true, get: () => gate.on }),
            },
            apply(ctx, line) { ctx.draft('base').n += line.kind === 'gated' ? 10 : 1; return { summary: `Read ${line.kind}.`, narrate: false }; },
        },
    };
}

test('a deferred domain is absent from a new chat, and a command may write it', async t => {
    const host = await createHost({ modules: [module({ gate: { on: true } })], core: false });
    t.after(() => host.close());
    assert.deepEqual(host.head().domains.base, { n: 0 });
    assert.equal(host.head().domains.later, undefined);
    assert.equal(host.sdk.query('zz.chosen'), false);
    const result = await host.bus.command('zz.choose', {}, { cause: 'ui' });
    assert.equal(result.ok, true, `${result.code}: ${result.message}`);
    assert.deepEqual(host.head().domains.later, { chosen: true });
    await host.st.loadChat(JSON.parse(JSON.stringify(host.ctx.chat)));
    assert.deepEqual(host.head().domains.later, { chosen: true }, 'it survives a reload');
});

test('without deferred the same domain is there from the start (a module that does not ask is unchanged)', async t => {
    const host = await createHost({ modules: [module({ gate: { on: true }, deferred: false })], core: false });
    t.after(() => host.close());
    assert.deepEqual(host.head().domains.later, { chosen: false });
});

test('a deferred domain missing is not a missing domain: the module is ready and its chat reads as current', async t => {
    const host = await createHost({ modules: [module({ gate: { on: true } })], core: false });
    t.after(() => host.close());
    assert.equal(host.sdk.modules().find(each => each.id === ID).status, 'ready');
    const flight = host.sdk.preflight({ module: ID });
    assert.equal(flight.deferredDomains, true, 'preflight says the host defers domains');
    assert.deepEqual(flight.domains, ['base']);
    assert.equal(flight.classification, 'current');
});

test('a command, a query and a capture kind whose `enabled` reads false are not offered, and come back when it reads true', async t => {
    const gate = { on: false };
    const host = await createHost({ modules: [module({ gate })], core: false });
    t.after(() => host.close());
    const run = () => host.bus.command('zz.gated', {}, { cause: 'ui' });
    const refused = await run();
    assert.equal(refused.ok, false);
    assert.equal(host.head().domains.base.n, 0);
    assert.equal(host.registry.query('zz.gatedQuery'), null);
    assert.throws(() => host.sdk.query('zz.gatedQuery'), /no module answers/);
    assert.equal(host.sdk.query('zz.chosen'), false, 'an API without `enabled` is always on');
    const grammar = () => staticParts(host.registry).map(part => part.text).join('\n');
    assert.match(grammar(), /! plain Word/);
    assert.doesNotMatch(grammar(), /! gated Word/);
    await host.send('Go.', 'The road.\n<Changes>\n! gated one\n! plain two\n</Changes>');
    assert.equal(host.head().domains.base.n, 1, 'only the plain line was read; the gated one is not a line of this chat');

    gate.on = true;
    assert.equal((await run()).ok, true);
    assert.equal(host.sdk.query('zz.gatedQuery'), 'answer');
    assert.match(grammar(), /! gated Word/);
    await host.send('Again.', 'The road.\n<Changes>\n! gated three\n</Changes>');
    assert.equal(host.head().domains.base.n, 12);
});

test('deferred must be true or false, and enabled is a key a command entry may carry', () => {
    const def = module({ gate: { on: true } });
    def.domains.later.deferred = 'yes';
    assert.match(definitionProblems(def).join(' '), /domain "later" deferred must be true or false/);
    const ok = module({ gate: { on: true } });
    assert.deepEqual(definitionProblems(ok), []);
    const entry = module({ gate: { on: true } });
    entry.commands['zz.entry'] = { handler: () => ({ summary: 'x', narrate: false }), enabled: false };
    assert.deepEqual(definitionProblems(entry), []);
    const registry = createRegistry();
    registry.register(entry);
    assert.equal(registry.command('zz.entry'), null, 'an entry that says it is off is not found');
});

// Rule (g) (REPLAY.md "Deferred domains"): the reply that made a deferred domain deleted, a later reply's leaf writes under it land on
// its initial value instead of being skipped; a later block of removes alone does not make it; replay equals the oracle.
function tally() {
    const draft = ctx => {
        const slice = ctx.draft('later');
        if (slice.chosen === undefined) Object.assign(slice, { chosen: false, tally: {} });
        return slice;
    };
    return {
        id: 'zz-tally', name: 'Tally', version: '0.0.1',
        domains: { later: { initial: () => ({ chosen: false, tally: {} }), deferred: true } },
        commands: {
            'zz.tally'(ctx, payload) { const slice = draft(ctx); slice.tally[payload.key] = (slice.tally[payload.key] ?? 0) + 1; return { summary: 'Counted.', narrate: false }; },
            'zz.untally'(ctx, payload) { delete ctx.draft('later').tally?.[payload.key]; return { summary: 'Dropped.', narrate: false }; },
        },
    };
}
async function tallyHost(t) {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ modules: [tally()], core: false });
    t.after(() => host.close());
    return host;
}
const runs = (host, type, key) => host.bus.command(type, { key }, { cause: 'ui' });
const lastCarrierBut = (host, back) => host.ctx.chat.map((message, index) => (message.is_user ? -1 : index)).filter(index => index >= 0).at(-1 - back);

test('rule (g): deleting the reply that made a deferred domain keeps a later reply\'s writes on it, laid on its initial value', async t => {
    const host = await tallyHost(t);
    await host.send('One.', 'First.');
    assert.equal((await runs(host, 'zz.tally', 'a')).ok, true);
    await host.send('Two.', 'Second.');
    assert.equal((await runs(host, 'zz.tally', 'b')).ok, true);
    assert.equal((await runs(host, 'zz.tally', 'a')).ok, true);
    assert.deepEqual(host.head().domains.later, { chosen: false, tally: { a: 2, b: 1 } });
    await host.st.deleteMessage(lastCarrierBut(host, 1));
    assert.deepEqual(host.head().domains.later, { chosen: false, tally: { a: 2, b: 1 } }, 'the later writes stand on the initial value (a\'s replace is an add of the value the later reply set, rule c)');
    assert.deepEqual(host.store.problems(), [], 'nothing is skipped');
    await host.store.rebuild();
    assert.deepEqual(host.head().domains.later, { chosen: false, tally: { a: 2, b: 1 } }, 'a rebuild gives the same');
});

test('rule (g): a later block of removes alone does not make the deferred domain, and a chat that never writes it has none', async t => {
    const host = await tallyHost(t);
    await host.send('One.', 'First.');
    assert.equal((await runs(host, 'zz.tally', 'a')).ok, true);
    await host.send('Two.', 'Second.');
    assert.equal((await runs(host, 'zz.untally', 'a')).ok, true);
    await host.st.deleteMessage(lastCarrierBut(host, 1));
    assert.equal(host.head().domains.later, undefined, 'the remove is passed over (rule a) and makes nothing');
    const quiet = await tallyHost(t);
    await quiet.send('One.', 'First.');
    await quiet.send('Two.', 'Second.');
    await quiet.st.deleteMessage(lastCarrierBut(quiet, 1));
    await quiet.store.rebuild();
    assert.equal(quiet.head().domains.later, undefined);
    assert.doesNotMatch(JSON.stringify(quiet.ctx.chat), /domains\/later/, 'nothing about it is stored');
});
