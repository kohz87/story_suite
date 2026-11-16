import assert from 'node:assert/strict';
import { createCommandBus } from '../../core/commands.js';
import { int, record } from '../../core/registry/check.js';
import { counterIds, fakeRegistry, fakeStore } from './helpers/bus-fakes.js';

export const STACK = 'it_k3f9a2qz';
export const REN = 'ac_k3f9a2qz';

export const INITIAL = {
    v: 2,
    meta: { rev: 4, claims: {} },
    domains: {
        inventory: {
            stacks: { [STACK]: { id: STACK, def: 'story/minor-healing-draught', qty: 2, owner: 'party' } },
            wallets: { party: { copper: 5 } },
        },
        party: { actors: { [REN]: { id: REN, name: 'Ren', hp: { cur: 57, max: 82 } } } },
        scene: { place: { name: 'Bluewatch', kind: 'settlement', region: '' }, present: [] },
        director: { time: { minutes: 600 } },
    },
};

export const storyBlock = {
    id: 'story-block',
    domains: {
        inventory: {
            validate: slice => {
                const error = record(wallet => record(coins => int(coins, { min: 0 }))(wallet))(slice.wallets);
                return error ? [`wallets ${error}`] : [];
            },
        },
        scene: {},
    },
    commands: {
        'inventory.consume'(ctx, { stack, qty }) {
            const inv = ctx.draft('inventory');
            const found = inv.stacks[stack];
            if (!found) ctx.fail('NOT_FOUND', 'There is no such item.');
            if (found.qty < qty) ctx.fail('NOT_ENOUGH', 'There is no Minor Healing Draught left.');
            found.qty -= qty;
            return { summary: `Used ${qty}.`, data: { left: found.qty } };
        },
        'wallet.receive'(ctx, { owner, coins }) {
            const inv = ctx.draft('inventory');
            inv.wallets[owner].copper += coins;
            return { summary: `Got ${coins} copper.` };
        },
        'scene.arrive'(ctx, { name }) {
            ctx.draft('scene').present.push(name);
            return { summary: `${name} arrives.` };
        },
    },
};

export const rpgBattle = {
    id: 'rpg-battle',
    domains: { party: { validate: slice => (slice.actors[REN].hp.cur > slice.actors[REN].hp.max ? ['Ren has more HP than her maximum'] : []) } },
    commands: {
        'item.use'(ctx, { stack, target }) {
            const used = ctx.call('inventory.consume', { stack, qty: 1 });
            const party = ctx.draft('party');
            const actor = party.actors[target];
            actor.hp.cur = Math.min(actor.hp.max, actor.hp.cur + 20);
            return {
                summary: `Ren drinks a Minor Healing Draught: +20 HP (now ${actor.hp.cur}/${actor.hp.max}).`,
                data: { healed: 20, left: used.data.left },
            };
        },
    },
};

export const director = {
    id: 'story-director',
    domains: { director: {} },
    commands: {},
    queries: { 'director.time': state => state.domains.director.time.minutes },
};

export function setup(extra = [], { modules = [storyBlock, rpgBattle], initial = INITIAL, settings } = {}) {
    const store = fakeStore(initial);
    const registry = fakeRegistry([...modules, ...extra]);
    const committed = [];
    let seedCount = 1000;
    const bus = createCommandBus({
        store, registry, settings, id: counterIds(), seed: () => seedCount++,
        onCommitted: event => committed.push(event),
    });
    return { store, registry, bus, committed };
}

/** A one-module extra with a single command handler. */
export function mod(id, commands, domains = {}, queries = {}) {
    return { id, domains, commands, queries };
}

export function assertNothingStored(ctx, result, code) {
    assert.equal(result.ok, false);
    assert.equal(result.code, code, result.message);
    assert.equal(typeof result.message, 'string');
    assert.ok(result.message.length > 0);
    assert.equal(ctx.store.appended.length, 0, 'nothing appended');
    assert.equal(ctx.store.saves, 0, 'no save scheduled');
    assert.equal(ctx.committed.length, 0, 'nothing emitted');
    assert.deepEqual(ctx.store.head(), INITIAL, 'head untouched');
}
