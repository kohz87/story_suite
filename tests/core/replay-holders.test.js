// Replay rule (i) (core/ops/holders.js): a domain's keyed holder entry a deleted first reply made is remade when a later replayed block
// writes under it, and replayed writes inside an entry are fitted to what is there. Never for a live command.
import test from 'node:test';
import assert from 'node:assert/strict';
import { apply, rebaseOps } from '../../core/ops.js';
import { createRegistry } from '../../core/registry-parts/create.js';

const make = (key, slice) => (slice?.names?.[key] ? { name: slice.names[key], meters: {}, stages: {} } : null);
const holders = name => (name === 'd' ? { 'bonds/npcs': make } : null);
const base = () => ({ meta: { rev: 1 }, domains: { d: { names: { npc_a: 'Ana' }, bonds: { npcs: {} } } } });
const replay = (state, ops) => apply(state, rebaseOps(state, ops, { replayed: true, holders }).ops);

test('a write under an entry that is not there remakes it, makes the objects on the way and adds what a replace set', () => {
    const ops = [
        { op: 'replace', path: '/domains/d/bonds/npcs/npc_a/turn/at', value: 4 },
        { op: 'replace', path: '/domains/d/bonds/npcs/npc_a/meters/trust', value: 2 },
        { op: 'add', path: '/domains/d/bonds/npcs/npc_a/turn/story/-', value: 'trust' },
        { op: 'remove', path: '/domains/d/bonds/npcs/npc_a/progress/trust' },
    ];
    assert.throws(() => apply(base(), ops), 'as stored, the block does not apply');
    assert.deepEqual(replay(base(), ops).domains.d.bonds.npcs.npc_a, { name: 'Ana', meters: { trust: 2 }, stages: {}, turn: { at: 4, story: ['trust'] } });
});

test('an entry that is there: a part a deleted reply made is fitted; what is there applies as written', () => {
    const state = base();
    state.domains.d.bonds.npcs.npc_a = { name: 'Ana', meters: { trust: 1 }, turn: { at: 2 } };
    const ops = [
        { op: 'replace', path: '/domains/d/bonds/npcs/npc_a/impactDay/d0:ordinary', value: 2 },
        { op: 'replace', path: '/domains/d/bonds/npcs/npc_a/turn/at', value: 6 },
        { op: 'remove', path: '/domains/d/bonds/npcs/npc_a/meters/trust' },
    ];
    assert.deepEqual(replay(state, ops).domains.d.bonds.npcs.npc_a, { name: 'Ana', meters: {}, turn: { at: 6 }, impactDay: { 'd0:ordinary': 2 } });
    const plain = [{ op: 'replace', path: '/domains/d/bonds/npcs/npc_a/turn/at', value: 6 }];
    assert.deepEqual(rebaseOps(state, plain, { replayed: true, holders }).ops, plain, 'a block that fits is replayed exactly as stored');
});

test('no remake: the maker gives nothing, the block wrote the entry whole, a live command, or a domain without holders', () => {
    const ops = [{ op: 'replace', path: '/domains/d/bonds/npcs/npc_b/turn/at', value: 4 }];
    assert.throws(() => replay(base(), ops), 'someone the maker cannot remake: the block fails as before');
    const whole = [{ op: 'add', path: '/domains/d/bonds/npcs/npc_a', value: { name: 'Ana', meters: { trust: 5 } } }, { op: 'add', path: '/domains/d/bonds/npcs/npc_a/turn', value: { at: 1 } }];
    assert.deepEqual(rebaseOps(base(), whole, { replayed: true, holders }).ops, whole, 'an entry the block makes itself stands as written');
    const leaf = [{ op: 'replace', path: '/domains/d/bonds/npcs/npc_a/turn/at', value: 4 }];
    assert.deepEqual(rebaseOps(base(), leaf, { replayed: false, holders }).ops, leaf, 'a live command is never fitted');
    assert.deepEqual(rebaseOps(base(), leaf, { replayed: true }).ops, leaf, 'a store without holders replays as before');
    const marked = [{ op: 'replace', path: '/domains/d/bonds/npcs/npc_a/turn/at', value: 4, within: '/domains/d/bonds/npcs/npc_a/turn' }];
    assert.deepEqual(rebaseOps(base(), marked, { replayed: true, holders }).ops, [], 'an op marked within a thing is left to rule (d)');
});

test('a domain declares holders as paths to makers; they key the replay rules', () => {
    const registry = createRegistry({ warn() {} });
    assert.throws(() => registry.register({ id: 'bad', domains: { bad: { initial: () => ({}), holders: { '/abs': make } } } }), /holders must map paths/);
    assert.throws(() => registry.register({ id: 'bad2', domains: { bad2: { initial: () => ({}), holders: { 'bonds/npcs': 'no' } } } }), /holders must map paths/);
    const before = registry.rulesSignature();
    registry.register({ id: 'good', domains: { good: { initial: () => ({ bonds: { npcs: {} } }), holders: { 'bonds/npcs': make } } } });
    assert.equal(typeof registry.holders('good')['bonds/npcs'], 'function');
    assert.equal(registry.holders('nothing'), null);
    assert.match(registry.rulesSignature(), /good@good@::::bonds\/npcs;/);
    assert.notEqual(registry.rulesSignature(), before);
});
