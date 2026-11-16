// The guard mark: with no interaction kind registered it is byte-identical to what it was before kinds; a kind registering,
// leaving, changing version or changing readiness moves it (so checkpoints made while its blocks were off are checked again).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry } from '../../../src/v2/registry.js';
import { createGuards } from '../../../src/v2/commands/guards.js';
import { createHost } from '../../../testkit/index.js';
import { growKind, kindModule } from './helpers/core-kind.js';

const BEFORE_KINDS = ({ registry, rpg = true }) => `${registry.modules()
    .filter(def => typeof def?.hooks?.replayGuard === 'function' && def.hooks.replayGuard.hostOwned !== true && registry.held?.(def.id) !== true).map(def => `${def.id}@${def.version ?? ''}`).join(',')}${rpg ? '' : ';rpg:missing'}`;

const realMark = host => createGuards({ registry: host.registry, findQuery: () => null }).guardMark();

// The mark over a registry we can change: the modules, their readiness, and held state.
function markOf(modules, held = () => false) {
    const registry = { modules: () => modules, held };
    return createGuards({ registry, findQuery: () => null }).guardMark();
}

test('no kind registered: the mark is the mark it was, with no suffix', async () => {
    const host = await createHost();
    try {
        assert.equal(realMark(host), BEFORE_KINDS({ registry: host.registry }));
        assert.ok(!realMark(host).includes('kinds'));
    } finally { host.close(); }
    assert.equal(markOf([]), '');
    assert.equal(markOf([{ id: 'plain', version: '1', interactions: {} }]), '');
    assert.equal(markOf([{ id: 'plain', version: '1' }]), '');
});

test('a module without a kind keeps the real mark when another module registers one: the suffix is the only change', async () => {
    const plain = await createHost();
    const kind = await createHost({ modules: [kindModule(growKind())] });
    try {
        const was = realMark(plain);
        assert.equal(realMark(kind), `${was};kinds:test/probe@1.0.0:1`);
    } finally { plain.close(); kind.close(); }
});

test('a kind registering, leaving, changing version or readiness moves the mark; the same state reads the same', () => {
    const mod = (version, ready, held = false) => ({ id: 'test', version, interactions: { probe: growKind({ ready: () => ready }) }, held });
    const hold = list => id => list.find(def => def.id === id)?.held === true;
    const read = list => markOf(list, hold(list));
    const none = read([]);
    const ready = read([mod('1', true)]);
    assert.equal(ready, ';kinds:test/probe@1:1');
    assert.notEqual(ready, none, 'registering');
    assert.equal(read([mod('1', true)]), ready, 'the same state, the same mark');
    assert.equal(read([]), none, 'leaving');
    assert.notEqual(read([mod('2', true)]), ready, 'a new module version');
    assert.equal(read([mod('1', false)]), ';kinds:test/probe@1:0', 'not ready');
    assert.notEqual(read([mod('1', false)]), ready, 'readiness');
    assert.equal(read([mod('1', true, true)]), ';kinds:test/probe@1:0', 'a held module counts as not ready');
    const broken = { id: 'test', version: '1', interactions: { probe: growKind({ ready: () => { throw new Error('no'); } }) } };
    assert.equal(read([broken]), ';kinds:test/probe@1:0', 'a throwing ready() is not ready');
});

test('kinds are listed by id, whatever the order modules or kinds were declared in', () => {
    const a = { id: 'zed', version: '1', interactions: { b: growKind(), a: growKind() } };
    const b = { id: 'alpha', version: '3', interactions: { x: growKind({ ready: () => false }) } };
    assert.equal(markOf([a, b]), ';kinds:alpha/x@3:0,zed/a@1:1,zed/b@1:1');
    assert.equal(markOf([b, a]), markOf([a, b]));
});

test('the mark moves on a real registry when the kind module registers, and the new mark is the old one plus the suffix', () => {
    const registry = createRegistry({ warn: () => {} });
    const read = () => createGuards({ registry, findQuery: () => null }).guardMark();
    const before = read();
    registry.register(kindModule(growKind()));
    assert.equal(read(), `${before};kinds:test/probe@1.0.0:1`);
    assert.ok(!BEFORE_KINDS({ registry }).includes('kinds'));
});
