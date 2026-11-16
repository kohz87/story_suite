// The command bus: dispatch, validation, failures, and sub-commands.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_DEPTH } from '../../core/commands.js';
import { STACK, REN, INITIAL, storyBlock, rpgBattle, setup, mod, assertNothingStored } from './commands.helpers.js';

test('command: success runs the handler on drafts, appends ops + receipt, saves and emits', () => {
    const ctx = setup();
    const result = ctx.bus.command('item.use', { stack: STACK, target: REN });
    assert.equal(result.ok, true, result.message);
    const { receipt } = result;
    assert.deepEqual(Object.keys(receipt), ['id', 'type', 'module', 'cause', 'seed', 'summary', 'narrate', 'data', 'rev']);
    assert.deepEqual(receipt, {
        id: 'rc_00000001',
        type: 'item.use',
        module: 'rpg-battle',
        cause: 'ui',
        seed: 1000,
        summary: 'Ren drinks a Minor Healing Draught: +20 HP (now 77/82).',
        narrate: true,
        data: { healed: 20, left: 1 },
        rev: 5,
    });
    assert.equal(ctx.store.appended.length, 1);
    assert.deepEqual(ctx.store.appended[0].ops, [
        { op: 'replace', path: `/domains/inventory/stacks/${STACK}/qty`, value: 1 },
        { op: 'replace', path: `/domains/party/actors/${REN}/hp/cur`, value: 77 },
        { op: 'replace', path: '/meta/rev', value: 5 },
    ]);
    assert.equal(ctx.store.appended[0].receipt, receipt);
    assert.equal(ctx.store.saves, 1);
    assert.equal(ctx.committed.length, 1);
    assert.equal(ctx.committed[0].receipt, receipt);
    assert.equal(ctx.committed[0].ops, ctx.store.appended[0].ops);
    assert.equal(ctx.store.head().meta.rev, 5);
    assert.equal(ctx.store.head().domains.inventory.stacks[STACK].qty, 1);
    assert.ok(Object.isFrozen(receipt) && Object.isFrozen(receipt.data));
});

test('command: unknown commands, top level and through ctx.call', () => {
    const top = setup();
    assertNothingStored(top, top.bus.command('item.juggle', {}), 'UNKNOWN_COMMAND');
    assertNothingStored(top, top.bus.command(undefined, {}), 'UNKNOWN_COMMAND');
    const inner = setup([mod('caller', { 'caller.go': ctx => ctx.call('nobody.home', {}) })]);
    assertNothingStored(inner, inner.bus.command('caller.go', {}), 'UNKNOWN_COMMAND');
});

test('ctx.call to a missing command can be caught: nothing ran, the command goes on', () => {
    const ctx = setup([mod('quests', {
        'quest.finish'(c) {
            let xp = 'no party module';
            try {
                c.call('party.grantXp', { xp: 10 });
            } catch (error) {
                xp = error.code;
            }
            c.call('wallet.receive', { owner: 'party', coins: 3 });
            return { summary: 'Paid.', data: { xp } };
        },
    })]);
    const result = ctx.bus.command('quest.finish', {});
    assert.equal(result.ok, true, result.message);
    assert.equal(result.receipt.data.xp, 'UNKNOWN_COMMAND');
    assert.equal(ctx.store.head().domains.inventory.wallets.party.copper, 8);
});

test('NOT_OWNER: drafting another module\'s domain or a domain nobody owns', () => {
    const other = setup([mod('thief', { 'thief.steal': c => { c.draft('inventory').stacks = {}; } })]);
    const result = other.bus.command('thief.steal', {});
    assertNothingStored(other, result, 'NOT_OWNER');
    assert.match(result.message, /thief cannot change inventory: only story-block writes it/);
    const none = setup([mod('ghost', { 'ghost.boo': c => { c.draft('haunting').n = 1; } })]);
    assertNothingStored(none, none.bus.command('ghost.boo', {}), 'NOT_OWNER');
});

test('INVALID: a touched domain\'s validator refuses, the whole command is rejected', () => {
    const ctx = setup([mod('pickpocket', {
        'pickpocket.lift'(c) {
            c.call('scene.arrive', { name: 'Fenna' });
            c.call('wallet.receive', { owner: 'party', coins: -50 });
        },
    })]);
    const result = ctx.bus.command('pickpocket.lift', {});
    assertNothingStored(ctx, result, 'INVALID');
    assert.match(result.message, /The inventory would not be valid: wallets party copper must be 0 or more/);
});

test('INVALID: only touched domains are validated', () => {
    const broken = structuredClone(INITIAL);
    broken.domains.party.actors[REN].hp.cur = 999;   // party is already invalid
    const ctx = setup([], { initial: broken });
    const result = ctx.bus.command('scene.arrive', { name: 'Fenna' });
    assert.equal(result.ok, true, result.message);
    const heal = ctx.bus.command('item.use', { stack: STACK, target: REN });
    assert.equal(heal.ok, true, 'the heal caps at max, which makes party valid again');
});

test('INVALID: the generic op rules (negative qty, whole numbers, NaN, IDs, undefined)', () => {
    const cases = {
        'neg.qty': c => { c.draft('inventory').stacks[STACK].qty = -1; },
        'float.hp': c => { c.draft('party').actors[REN].hp.cur = 57.5; },
        'nan.hp': c => { c.draft('party').actors[REN].hp.cur = NaN; },
        'inf.hp': c => { c.draft('party').actors[REN].hp.max = Infinity; },
        'bad.id': c => { c.draft('inventory').stacks.it_00000002 = { id: 'Second Draught', qty: 1 }; },
        'undef': c => { c.draft('party').actors[REN].name = undefined; },
        'date': c => { c.draft('scene').when = new Date(0); },
    };
    const owners = { 'neg.qty': 'story-block', 'bad.id': 'story-block', date: 'story-block' };
    for (const [type, handler] of Object.entries(cases)) {
        const modules = [
            { ...storyBlock, commands: { ...storyBlock.commands, ...(owners[type] ? { [type]: handler } : {}) } },
            { ...rpgBattle, commands: { ...rpgBattle.commands, ...(owners[type] ? {} : { [type]: handler }) } },
        ];
        const ctx = setup([], { modules });
        const result = ctx.bus.command(type, {});
        assertNothingStored(ctx, result, 'INVALID');
        assert.match(result.message, /This change breaks the state's rules/, type);
    }
});

test('FAILED: a handler that throws, an async handler, a bad return, a broken validator', () => {
    const cases = {
        'boom': () => { throw new Error('the kettle exploded'); },
        'frozen.read': c => { c.read('party').actors[REN].hp.cur = 1; },
        'async': async () => ({ summary: 'later' }),
        'bad.return': () => 'done',
        'bad.summary': () => ({ summary: 7 }),
        'bad.narrate': () => ({ narrate: 'yes' }),
        'bad.data': () => ({ data: { when: new Date() } }),
        'array.data': () => ({ data: [1] }),
    };
    for (const [type, handler] of Object.entries(cases)) {
        const ctx = setup([mod('broken', { [type]: handler })]);
        const result = ctx.bus.command(type, {});
        assertNothingStored(ctx, result, 'FAILED');
        if (type === 'boom') assert.equal(result.message, 'Something went wrong in boom: the kettle exploded');
        if (type === 'async') assert.match(result.message, /cannot wait/);
    }
    const crashing = setup([], {
        modules: [{ ...storyBlock, domains: { ...storyBlock.domains, scene: { validate: () => { throw new Error('oops'); } } } }, rpgBattle],
    });
    const result = crashing.bus.command('scene.arrive', { name: 'Fenna' });
    assertNothingStored(crashing, result, 'FAILED');
    assert.match(result.message, /The scene check itself failed: oops/);
});

test('ctx.fail passes the code through: NOT_ENOUGH, NOT_FOUND, CLAIMED, a module code', () => {
    const empty = structuredClone(INITIAL);
    empty.domains.inventory.stacks[STACK].qty = 0;
    const ctx = setup([], { initial: empty });
    const result = ctx.bus.command('item.use', { stack: STACK, target: REN });
    assert.deepEqual(result, { ok: false, code: 'NOT_ENOUGH', message: 'There is no Minor Healing Draught left.' });
    assert.equal(ctx.store.appended.length, 0);

    const missing = setup();
    assert.equal(missing.bus.command('item.use', { stack: 'it_00000000', target: REN }).code, 'NOT_FOUND');
    const codes = setup([mod('m', {
        'm.claimed': c => c.fail('CLAIMED', 'Already paid.'),
        'm.custom': c => c.fail('TOO_HEAVY', 'The pack is too heavy.'),
        'm.weird': c => c.fail('not a code', 'Odd.'),
    })]);
    assert.deepEqual(codes.bus.command('m.claimed', {}), { ok: false, code: 'CLAIMED', message: 'Already paid.' });
    assert.equal(codes.bus.command('m.custom', {}).code, 'TOO_HEAVY');
    assert.equal(codes.bus.command('m.weird', {}).code, 'FAILED');
    assert.equal(codes.store.appended.length, 0);
});

test('sub-commands: changes merge into one receipt; the inner summary is not separate', () => {
    const ctx = setup();
    ctx.bus.command('item.use', { stack: STACK, target: REN });
    assert.equal(ctx.store.appended.length, 1, 'one append for the outer and the inner command');
    assert.equal(ctx.store.appended[0].receipt.type, 'item.use');
});

test('sub-commands are atomic: an inner failure rolls the outer back, even when caught', () => {
    const empty = structuredClone(INITIAL);
    empty.domains.inventory.stacks[STACK].qty = 0;
    const greedy = mod('greedy', {
        'greedy.try'(c) {
            c.call('scene.arrive', { name: 'Fenna' });
            try {
                c.call('item.use', { stack: STACK, target: REN });
            } catch {
                // carry on as if nothing happened
            }
            return { summary: 'Nothing to see.' };
        },
        'greedy.half'(c) {
            // the inner command writes, then throws: the half-write must not survive
            c.call('half.write', {});
        },
    });
    const half = mod('half', {
        'half.write'(c) {
            c.draft('halfdom').n = 1;
            throw new Error('midway');
        },
    }, { halfdom: {} });
    const ctx = setup([greedy, half], { initial: empty });
    const caught = ctx.bus.command('greedy.try', {});
    assert.equal(caught.ok, false);
    assert.equal(caught.code, 'NOT_ENOUGH', 'the inner failure is the reason');
    assert.equal(ctx.store.appended.length, 0);
    assert.deepEqual(ctx.store.head(), empty);
    const midway = ctx.bus.command('greedy.half', {});
    assert.equal(midway.code, 'FAILED');
    assert.match(midway.message, /half\.write: midway/);
    assert.equal(ctx.store.appended.length, 0);
});

test('sub-commands: nested calls share drafts, read sees them, depth limit is 8', () => {
    const chain = {};
    for (let i = 0; i <= 10; i++) {
        chain[`chain.${i}`] = (c, { stop }) => {
            c.draft('chain').hops.push(i);
            if (i < stop) c.call(`chain.${i + 1}`, { stop });
            return { summary: `hop ${i}`, data: { seen: c.read('chain').hops.length } };
        };
    }
    const initial = structuredClone(INITIAL);
    initial.domains.chain = { hops: [] };
    const ctx = setup([mod('chain', chain, { chain: {} })], { initial });
    const ok = ctx.bus.command('chain.0', { stop: MAX_DEPTH });
    assert.equal(ok.ok, true, ok.message);
    assert.deepEqual(ctx.store.head().domains.chain.hops, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
    assert.equal(ok.receipt.data.seen, 9, 'the outer read sees what the inner calls drafted');
    assert.deepEqual(ctx.store.appended[0].ops.slice(0, 2), [
        { op: 'add', path: '/domains/chain/hops/-', value: 0 },
        { op: 'add', path: '/domains/chain/hops/-', value: 1 },
    ]);
    const deep = ctx.bus.command('chain.0', { stop: MAX_DEPTH + 1 });
    assert.equal(deep.code, 'FAILED');
    assert.match(deep.message, /more than 8 levels deep/);
    assert.equal(ctx.store.appended.length, 1);

    const loop = setup([mod('loop', { 'loop.again': c => c.call('loop.again', {}) })]);
    assert.equal(loop.bus.command('loop.again', {}).code, 'FAILED', 'endless recursion stops');
});
