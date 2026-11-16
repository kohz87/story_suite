// The command bus: ctx helpers (read, claim, rng, query, time, settings), preview/commit, run, failures.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommandBus, newId } from '../../core/commands.js';
import { apply } from '../../core/ops.js';
import { counterIds, fakeRegistry, fakeStore } from './helpers/bus-fakes.js';
import { STACK, REN, INITIAL, storyBlock, rpgBattle, director, setup, mod } from './commands.helpers.js';

test('ctx.read: deep-frozen copies of any domain, null for one that does not exist', () => {
    let seen;
    const ctx = setup([mod('reader', {
        'reader.look'(c) {
            seen = { inv: c.read('inventory'), party: c.read('party'), none: c.read('nowhere') };
        },
    })]);
    assert.equal(ctx.bus.command('reader.look', {}).ok, true);
    assert.ok(Object.isFrozen(seen.inv.stacks[STACK]));
    assert.ok(Object.isFrozen(seen.party.actors[REN].hp));
    assert.equal(seen.none, null);
    assert.deepEqual(seen.inv, INITIAL.domains.inventory);
});

test('claims: once only, across commands and within one, escaped in the op path', () => {
    const results = [];
    const ctx = setup([mod('quests', {
        'quest.pay'(c, { key }) {
            const first = c.claim(key);
            const again = c.claim(key);
            results.push([first, again]);
            if (!first) c.fail('CLAIMED', 'That reward was already paid.');
            c.call('wallet.receive', { owner: 'party', coins: 10 });
            return { summary: 'Paid 10 copper.' };
        },
        'quest.badkey': c => c.claim(''),
    })]);
    const key = 'quest:q_ab12cd34:paid/once~';
    const paid = ctx.bus.command('quest.pay', { key });
    assert.equal(paid.ok, true, paid.message);
    assert.deepEqual(results[0], [true, false]);
    assert.deepEqual(ctx.store.appended[0].ops, [
        { op: 'replace', path: '/domains/inventory/wallets/party/copper', value: 15 },
        { op: 'add', path: '/meta/claims/quest:q_ab12cd34:paid~1once~0', value: true },
        { op: 'replace', path: '/meta/rev', value: 5 },
    ]);
    assert.equal(ctx.store.head().meta.claims[key], true);
    const twice = ctx.bus.command('quest.pay', { key });
    assert.equal(twice.code, 'CLAIMED');
    assert.deepEqual(results[1], [false, false]);
    assert.equal(ctx.store.appended.length, 1);
    assert.equal(ctx.store.head().domains.inventory.wallets.party.copper, 15, 'paid once');
    assert.equal(ctx.bus.command('quest.badkey', {}).code, 'INVALID');
});

test('claims: a rejected command does not keep its claim', () => {
    const ctx = setup([mod('quests', {
        'quest.payBroken'(c) {
            c.claim('quest:q_ab12cd34:paid');
            c.call('wallet.receive', { owner: 'party', coins: -99 });
        },
        'quest.check': c => ({ data: { free: c.claim('quest:q_ab12cd34:paid') } }),
    })]);
    assert.equal(ctx.bus.command('quest.payBroken', {}).code, 'INVALID');
    assert.equal(ctx.bus.command('quest.check', {}).receipt.data.free, true);
});

test('rng and roll: the same seed gives the same results; a different seed differs', () => {
    const dice = mod('dice', {
        'dice.throw'(c, { expr }) {
            const rolled = c.roll(expr);
            return { summary: `Rolled ${rolled.total}.`, data: { rolled, float: c.rng() } };
        },
        'dice.bad': c => c.roll('banana'),
    });
    const ctx = setup([dice]);
    const a = ctx.bus.run('dice.throw', { expr: '3d6+2' }, { seed: 77 });
    const b = ctx.bus.run('dice.throw', { expr: '3d6+2' }, { seed: 77 });
    assert.equal(a.ok, true, a.message);
    assert.deepEqual(a.receipt.data, b.receipt.data);
    assert.equal(a.receipt.seed, 77);
    assert.notEqual(a.receipt.id, b.receipt.id);
    const c = ctx.bus.run('dice.throw', { expr: '3d6+2' }, { seed: 78 });
    assert.notDeepEqual(c.receipt.data, a.receipt.data);
    assert.equal(ctx.bus.run('dice.bad', {}, { seed: 1 }).code, 'INVALID');
    assert.equal(ctx.bus.run('dice.throw', { expr: 'd6' }, { seed: -1 }).code, 'INVALID');
    assert.equal(ctx.bus.run('dice.throw', { expr: 'd6' }, { seed: 1.5 }).code, 'INVALID');
});

test('rng: a sub-command draws from the same stream as its caller', () => {
    const draws = mod('draws', {
        'draws.outer': c => ({ data: { mine: c.rng(), inner: c.call('draws.inner', {}).data.value, after: c.rng() } }),
        'draws.inner': c => ({ data: { value: c.rng() } }),
        'draws.flat': c => ({ data: { mine: c.rng(), inner: c.rng(), after: c.rng() } }),
    });
    const ctx = setup([draws]);
    assert.deepEqual(ctx.bus.run('draws.outer', {}, { seed: 5 }).receipt.data, ctx.bus.run('draws.flat', {}, { seed: 5 }).receipt.data);
});

test('preview + commit: the identical receipt and ops; nothing stored before the commit', () => {
    const ctx = setup();
    const preview = ctx.bus.preview('item.use', { stack: STACK, target: REN });
    assert.equal(preview.ok, true, preview.message);
    assert.equal(typeof preview.token, 'string');
    assert.equal(ctx.store.appended.length, 0);
    assert.equal(ctx.store.saves, 0);
    assert.equal(ctx.committed.length, 0);
    const committed = ctx.bus.commit(preview.token);
    assert.equal(committed.ok, true, committed.message);
    assert.equal(committed.receipt, preview.receipt, 'the very same receipt');
    assert.deepEqual(ctx.store.appended[0], { ops: preview.ops, receipt: preview.receipt });
    assert.equal(ctx.store.saves, 1);
    assert.equal(ctx.committed.length, 1);
    assert.equal(ctx.bus.commit(preview.token).code, 'NOT_FOUND', 'a token commits once');
    assert.equal(ctx.bus.commit('pv_nope').code, 'NOT_FOUND');
});

test('preview + commit: STALE after another commit or a changed head; failures preview as failures', () => {
    const ctx = setup();
    const preview = ctx.bus.preview('item.use', { stack: STACK, target: REN });
    assert.equal(ctx.bus.command('scene.arrive', { name: 'Fenna' }).ok, true);
    const stale = ctx.bus.commit(preview.token);
    assert.equal(stale.code, 'STALE');
    assert.equal(ctx.store.appended.length, 1, 'only the other command');

    const swiped = setup();
    const before = swiped.bus.preview('item.use', { stack: STACK, target: REN });
    const other = structuredClone(INITIAL);
    other.domains.scene.present = ['Lyra'];   // a swipe: same rev, other state
    swiped.store.replaceHead(other);
    assert.equal(swiped.bus.commit(before.token).code, 'STALE');
    assert.equal(swiped.store.appended.length, 0);

    const empty = structuredClone(INITIAL);
    empty.domains.inventory.stacks[STACK].qty = 0;
    const refused = setup([], { initial: empty });
    const result = refused.bus.preview('item.use', { stack: STACK, target: REN });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'NOT_ENOUGH');
    assert.equal(result.token, undefined);
});

test('run: no append, no save; `state` chains lines of one reply; `capture` runs a capture handler', () => {
    const ctx = setup();
    const first = ctx.bus.run('scene.arrive', { name: 'Fenna' }, { seed: 1 });
    assert.equal(first.ok, true, first.message);
    assert.equal(first.receipt.cause, 'story');
    assert.equal(first.receipt.narrate, false, 'story receipts default to not narrated');
    assert.equal(ctx.store.appended.length, 0);
    assert.equal(ctx.store.saves, 0);
    assert.equal(ctx.committed.length, 0);
    assert.deepEqual(first.state, apply(INITIAL, first.ops));
    const second = ctx.bus.run('scene.arrive', { name: 'Lyra' }, { seed: 2, state: first.state });
    assert.deepEqual(second.state.domains.scene.present, ['Fenna', 'Lyra']);
    assert.equal(second.receipt.rev, 6);

    const capture = {
        moduleId: 'story-block',
        apply(c, line) {
            c.draft('scene').place.name = line.name;
            return { summary: `Now at ${line.name}.`, narrate: true };
        },
    };
    const captured = ctx.bus.run('capture.place', { op: '~', kind: 'place', name: 'Greyford' }, { seed: 3, capture });
    assert.equal(captured.ok, true, captured.message);
    assert.equal(captured.receipt.type, 'capture.place');
    assert.equal(captured.receipt.module, 'story-block');
    assert.equal(captured.receipt.narrate, true);
    assert.deepEqual(captured.ops[0], { op: 'replace', path: '/domains/scene/place/name', value: 'Greyford' });
    const notMine = ctx.bus.run('capture.item', {}, { seed: 3, capture: { moduleId: 'rpg-battle', apply: c => { c.draft('inventory'); } } });
    assert.equal(notMine.code, 'NOT_OWNER');
    assert.equal(ctx.bus.run('capture.x', {}, { capture: { moduleId: 'x' } }).code, 'UNKNOWN_COMMAND');
    assert.equal(ctx.store.appended.length, 0);
});

test('receipts: cause, narrate defaults, receiptId, a command that changes nothing still bumps rev', () => {
    let id;
    const ctx = setup([mod('quiet', {
        'quiet.note': c => { id = c.receiptId; return { summary: 'Nothing happens.' }; },
        'quiet.tell': () => ({ narrate: true }),
        'quiet.hush': () => ({ narrate: false }),
    })]);
    const ui = ctx.bus.command('quiet.note', {});
    assert.equal(ui.receipt.id, id);
    assert.match(id, /^rc_[0-9a-z]{8}$/);
    assert.equal(ui.receipt.narrate, true, 'ui default');
    assert.deepEqual(ui.receipt.data, {});
    assert.deepEqual(ctx.store.appended[0].ops, [{ op: 'replace', path: '/meta/rev', value: 5 }]);
    assert.equal(ctx.bus.command('quiet.note', {}, { cause: 'system' }).receipt.narrate, false, 'system default');
    assert.equal(ctx.bus.command('quiet.tell', {}, { cause: 'story' }).receipt.narrate, true, 'the handler decides');
    assert.equal(ctx.bus.command('quiet.hush', {}).receipt.narrate, false);
    assert.equal(ctx.store.head().meta.rev, 8);
    assert.equal(ctx.bus.command('quiet.note', {}, { cause: 'dream' }).code, 'INVALID');
});

test('ctx.query sees the transaction\'s own drafts; unknown queries are NOT_FOUND', () => {
    const counting = {
        id: 'story-block',
        domains: storyBlock.domains,
        commands: {
            ...storyBlock.commands,
            'inventory.check'(c) {
                const before = c.query('inventory.count', { stack: STACK });
                c.call('inventory.consume', { stack: STACK, qty: 1 });
                const after = c.query('inventory.count', { stack: STACK });
                return { data: { before, after } };
            },
            'inventory.ask': c => ({ data: c.query('inventory.nothing', {}) }),
        },
        queries: { 'inventory.count': (state, { stack }) => state.domains.inventory.stacks[stack].qty },
    };
    const ctx = setup([], { modules: [counting, rpgBattle] });
    const result = ctx.bus.command('inventory.check', {});
    assert.equal(result.ok, true, result.message);
    assert.deepEqual(result.receipt.data, { before: 2, after: 1 });
    assert.equal(ctx.bus.command('inventory.ask', {}).code, 'NOT_FOUND');

    // A registry with a query(name) accessor is used first.
    const store = fakeStore(INITIAL);
    const registry = { ...fakeRegistry([counting, rpgBattle]), query: name => (name === 'inventory.nothing' ? () => ({ fine: true }) : null) };
    const bus = createCommandBus({ store, registry, id: counterIds(), seed: () => 1 });
    const asked = bus.run('inventory.ask', {}, { seed: 1 });
    assert.deepEqual(asked.receipt.data, { fine: true });
});

test('ctx.time: the director.time query, else the director domain, else null', () => {
    const timed = mod('timer', { 'timer.now': c => ({ data: { time: c.time() } }) });
    const withQuery = setup([timed, { ...director, queries: { 'director.time': () => 725 } }]);
    assert.equal(withQuery.bus.run('timer.now', {}, { seed: 1 }).receipt.data.time, 725);
    const fromDomain = setup([timed]);
    assert.equal(fromDomain.bus.run('timer.now', {}, { seed: 1 }).receipt.data.time, 600);
    const noClock = structuredClone(INITIAL);
    delete noClock.domains.director;
    const none = setup([timed], { initial: noClock });
    assert.equal(none.bus.run('timer.now', {}, { seed: 1 }).receipt.data.time, null);
    const objectTime = setup([timed, { ...director, queries: { 'director.time': () => ({ minutes: 61 }) } }]);
    assert.equal(objectTime.bus.run('timer.now', {}, { seed: 1 }).receipt.data.time, 61);
});

test('ctx.time sees a time the same transaction drafted', () => {
    const clock = {
        ...director,
        commands: { 'time.pass': (c, { minutes }) => { c.draft('director').time.minutes += minutes; return { data: { now: c.time() } }; } },
    };
    const ctx = setup([clock]);
    assert.equal(ctx.bus.run('time.pass', { minutes: 30 }, { seed: 1 }).receipt.data.now, 630);
});

test('ctx.settings: frozen copies of a module\'s settings, its own by default', () => {
    let seen;
    const ctx = setup([mod('cfg', { 'cfg.read': c => { seen = { mine: c.settings(), other: c.settings('rpg-battle') }; } })], {
        settings: id => ({ cfg: { level: 3 }, 'rpg-battle': { hard: true } })[id],
    });
    assert.equal(ctx.bus.command('cfg.read', {}).ok, true);
    assert.deepEqual(seen, { mine: { level: 3 }, other: { hard: true } });
    assert.ok(Object.isFrozen(seen.mine));
    const plain = setup([mod('cfg', { 'cfg.read': c => ({ data: c.settings('unknown') }) })]);
    assert.deepEqual(plain.bus.command('cfg.read', {}).receipt.data, {});
});

test('payloads are frozen copies; a ctx kept after its command ends refuses to work', () => {
    let kept;
    const ctx = setup([mod('keeper', {
        'keeper.touch'(c, payload) {
            kept = c;
            payload.list.push(2);
        },
        'keeper.keep'(c) {
            kept = c;
        },
    })]);
    const payload = { list: [1] };
    assert.equal(ctx.bus.command('keeper.touch', payload).code, 'FAILED');
    assert.deepEqual(payload, { list: [1] }, 'the caller\'s payload is untouched');
    assert.equal(ctx.bus.command('keeper.keep', {}).ok, true);
    assert.throws(() => kept.read('scene'), /already finished/);
    assert.throws(() => kept.claim('late'), /already finished/);
});

test('store failures and listener failures', () => {
    const store = fakeStore(INITIAL);
    store.append = () => { throw new Error('disk full'); };
    const bus = createCommandBus({ store, registry: fakeRegistry([storyBlock, rpgBattle]), id: counterIds(), seed: () => 1 });
    const result = bus.command('scene.arrive', { name: 'Fenna' });
    assert.equal(result.code, 'FAILED');
    assert.match(result.message, /could not be stored: disk full/);
    assert.equal(store.saves, 0);

    const warn = console.warn;
    const warnings = [];
    console.warn = (...args) => warnings.push(args);
    try {
        const ok = createCommandBus({
            store: fakeStore(INITIAL), registry: fakeRegistry([storyBlock, rpgBattle]), id: counterIds(), seed: () => 1,
            onCommitted: () => { throw new Error('listener broke'); },
        }).command('scene.arrive', { name: 'Fenna' });
        assert.equal(ok.ok, true, 'a broken listener does not undo a commit');
        assert.equal(warnings.length, 1);
    } finally {
        console.warn = warn;
    }

    const noSeed = createCommandBus({ store: fakeStore(INITIAL), registry: fakeRegistry([storyBlock]), seed: () => { throw new Error('no crypto'); } });
    assert.equal(noSeed.command('scene.arrive', { name: 'Fenna' }).code, 'FAILED');
});

test('default receipt IDs and seeds come from crypto', () => {
    assert.match(newId('rc'), /^rc_[0-9a-z]{8}$/);
    const store = fakeStore(INITIAL);
    const bus = createCommandBus({ store, registry: fakeRegistry([storyBlock, rpgBattle]) });
    const result = bus.command('scene.arrive', { name: 'Fenna' });
    assert.equal(result.ok, true, result.message);
    assert.match(result.receipt.id, /^rc_[0-9a-z]{8}$/);
    assert.ok(Number.isInteger(result.receipt.seed) && result.receipt.seed >= 0 && result.receipt.seed <= 0xFFFFFFFF);
    assert.throws(() => newId('rc', {}), /crypto/);
});

test('a domain missing from the head is added whole by its owner', () => {
    const initial = structuredClone(INITIAL);
    const ctx = setup([mod('late', { 'late.init': c => { c.draft('fishing').caught = 0; } }, { fishing: {} })], { initial });
    const result = ctx.bus.command('late.init', {}, { cause: 'system' });
    assert.equal(result.ok, true, result.message);
    assert.deepEqual(ctx.store.appended[0].ops[0], { op: 'add', path: '/domains/fishing', value: { caught: 0 } });
    assert.deepEqual(ctx.store.head().domains.fishing, { caught: 0 });
});
