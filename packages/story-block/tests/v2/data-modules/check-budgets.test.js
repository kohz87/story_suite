import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePack } from '../../../../../packs/validate.js';
import { validateDataModules, dataModuleDefaults, DM_LIMITS as L } from '../../../src/v2/data-modules/check.js';
import { read, integer, change, definition, pack, ok, refuse, edit, set, reward, timer, clock } from './check.helpers.js';

const budgetCases = [
    ['definitions', 20, n => pack(Array.from({ length: n }, (_, i) => ({ ...definition(), slug: `module-${i}` })))],
    ['fields', 32, n => edit(d => { d.state = Object.fromEntries(Array.from({ length: n }, (_, i) => [`field-${i}`, integer()])); d.kinds.gain.effects = []; })],
    ['kinds', 16, n => edit(d => { d.kinds = Object.fromEntries(Array.from({ length: n }, (_, i) => [`kind-${i}`, { op: '!', labels: {}, effects: [] }])); })],
    ['rules', 32, n => edit(d => { d.rules = Array.from({ length: n }, (_, i) => ({ id: `rule-${i}`, when: true, then: [] })); })],
    ['timers', 8, n => edit(d => { d.imports = { clock: clock() }; d.timers = Array.from({ length: n }, (_, i) => ({ ...timer(), id: `timer-${i}` })); })],
    ['templates', 16, n => edit(d => { d.rewards = Object.fromEntries(Array.from({ length: n }, (_, i) => [`gift-${i}`, reward()])); })],
    ['effects', 16, n => edit(d => { d.kinds.gain.effects = Array.from({ length: n }, change); })],
    ['imports', 8, n => edit(d => { d.imports = Object.fromEntries(Array.from({ length: n }, (_, i) => [`clock-${i}`, clock()])); })],
];
for (const [name, limit, build] of budgetCases) test(`${name} count accepts limit-1/limit and refuses limit+1`, () => {
    ok(build(limit - 1)); ok(build(limit)); refuse(build(limit + 1), 'DM_BUDGET');
});

test('map/enum/key/text limits accept their boundary and refuse the next value', () => {
    for (const n of [31, 32]) ok(edit(d => { d.state.mode = { type: 'enum', values: Array.from({ length: n }, (_, i) => `v${i}`), default: 'v0' }; }));
    refuse(edit(d => { d.state.mode = { type: 'enum', values: Array.from({ length: 33 }, (_, i) => `v${i}`), default: 'v0' }; }));
    for (const n of [15, 16]) ok(edit(d => { d.state.map = { type: 'map', keys: Array.from({ length: n }, (_, i) => `k${i}`), values: integer() }; }));
    refuse(edit(d => { d.state.map = { type: 'map', keys: Array.from({ length: 17 }, (_, i) => `k${i}`), values: integer() }; }));
    for (const n of [39, 40]) ok(edit(d => { d.state['x'.repeat(n)] = integer(); d.state.text = { type: 'text', max: 240, default: 'x'.repeat(240) }; }));
    refuse(edit(d => { d.state['x'.repeat(41)] = integer(); }));
});

test('expression depth and node counts are checked independently at the exact boundary', () => {
    const nest = depth => depth === 1 ? true : ['not', nest(depth - 1)];
    for (const depth of [5, 6]) ok(edit(d => { d.kinds.gain.when = nest(depth); }));
    refuse(edit(d => { d.kinds.gain.when = nest(7); }), 'DM_BUDGET');
    const tree = depth => depth === 1 ? 1 : ['add', tree(depth - 1), tree(depth - 1)];
    const ast = tree(6); // 63 operator/literal visits
    ok(edit(d => { d.kinds.gain.effects[0].value = ast; }));
    ast[1][1][1][1] = ['clamp', 1, 0, 100]; // 64 visits, still depth 6
    ok(edit(d => { d.kinds.gain.effects[0].value = ast; }));
    ast[1][1][1][2] = ['clamp', 1, 0, 100]; // 65 visits
    refuse(edit(d => { d.kinds.gain.effects[0].value = ast; }), 'DM_BUDGET');
});

test('four adjacent migrations are permitted, five or a cyclic/branching/gapped chain refuse', () => {
    function chain(count) {
        const d = definition(); d.stateVersion = count + 1;
        d.migrations = Array.from({ length: count }, (_, i) => {
            const field = `new-${i}`; d.state[field] = integer();
            return { from: i + 1, to: i + 2, add: { [field]: integer() } };
        }); return d;
    }
    ok(pack([chain(3)])); ok(pack([chain(4)])); refuse(pack([chain(5)]), 'DM_BUDGET');
    for (const from of [1, 3, 5]) { const d = chain(4); d.migrations[1].from = from; refuse(pack([d])); }
});

test('definition byte budget measures normalized UTF-8 JSON at limit-1, limit and limit+1', () => {
    const d = definition(); d.screens = [{ id: 'bytes', layout: { root: { type: 'col', children: Array.from({ length: 20 }, () => ({ type: 'text', value: '' })) } } }];
    const baseline = ok(pack([d])).pack.content.dataModules[0];
    const bytes = value => new TextEncoder().encode(JSON.stringify(value)).length;
    const remaining = L.definitionBytes - bytes(baseline);
    let rest = remaining;
    for (const child of d.screens[0].layout.root.children) {
        const take = Math.min(1800, rest); child.value = 'x'.repeat(take); rest -= take;
    }
    assert.equal(rest, 0);
    // Two UTF-16 units and four UTF-8 bytes; compensate exactly in another node.
    d.screens[0].layout.root.children[19].value += '😀';
    d.screens[0].layout.root.children[0].value = d.screens[0].layout.root.children[0].value.slice(4);
    const atLimit = ok(pack([d])).pack.content.dataModules[0];
    assert.equal(bytes(atLimit), L.definitionBytes);
    d.screens[0].layout.root.children[0].value = d.screens[0].layout.root.children[0].value.slice(1);
    assert.equal(bytes(ok(pack([d])).pack.content.dataModules[0]), L.definitionBytes - 1);
    d.screens[0].layout.root.children[0].value += 'xx';
    refuse(pack([d]), 'DM_BUDGET');
});

test('default instance byte budget uses expanded fixed maps, with exact 16 KiB boundaries', () => {
    const d = definition();
    for (let i = 0; i < 4; i++) d.state[`map-${i}`] = { type: 'map', keys: Array.from({ length: 16 }, (_, j) => String.fromCharCode(97 + j)), values: { type: 'text', max: 240, default: 'x'.repeat(240) } };
    for (let i = 0; i < 4; i++) d.state[`pad-${i}`] = { type: 'text', max: 240, default: '' };
    const size = state => new TextEncoder().encode(JSON.stringify({ fields: dataModuleDefaults(state), timers: {}, offers: {}, settled: {} })).length;
    let rest = L.instanceBytes - size(d.state);
    for (let i = 0; i < 4; i++) { const take = Math.min(rest, 239); d.state[`pad-${i}`].default = 'x'.repeat(take); rest -= take; }
    assert.equal(rest, 0);
    assert.equal(size(d.state), L.instanceBytes); ok(pack([d]));
    const pad = Object.values(d.state).find(f => f.type === 'text' && f.default.length > 0 && f.default.length < 239);
    assert.ok(pad); pad.default = pad.default.slice(1);
    assert.equal(size(d.state), L.instanceBytes - 1); ok(pack([d]));
    pad.default += 'xx'; refuse(pack([d]), 'DM_BUDGET');
});

function paths(value, path = [], out = []) {
    out.push(path);
    if (value && typeof value === 'object') for (const key of Object.keys(value)) paths(value[key], [...path, key], out);
    return out;
}
test('malformed definition/property sweep never throws, mutates input or exceeds the diagnostic budget', () => {
    const junk = [null, false, 0, '', [], {}, ['constructor'], { type: 'constructor' }, { op: 'constructor' }, { toString: 1 }, { type: 'map', keys: ['a'], values: null }];
    let vectors = 0;
    for (const example of ['reputation', 'survival']) {
        const base = read(example);
        for (const path of paths(base.content.dataModules[0])) for (const value of junk) {
            const input = structuredClone(base); set(input, ['content', 'dataModules', 0, ...path], value);
            const before = JSON.stringify(input);
            const result = validatePack(input);
            assert.equal(JSON.stringify(input), before);
            if (!result.ok) {
                assert.ok(result.errors.length > 0 && result.errors.length <= 20);
                assert.ok(result.errors.every(e => typeof e.code === 'string' && typeof e.path === 'string' && typeof e.message === 'string'));
            }
            vectors++;
        }
    }
    assert.ok(vectors >= 3000);
});

test('a data pack hash changes when its definition changes', () => {
    const input = pack();
    const first = ok(input);
    assert.match(first.packHash, /^[0-9a-f]{64}$/);
    assert.equal(ok(structuredClone(input)).packHash, first.packHash);
    input.content.dataModules[0].kinds.gain.effects[0].value = 2;
    assert.notEqual(ok(input).packHash, first.packHash);
});

test('enum scalar literals are exact, with finite numeric/bool membership and case-sensitive text', () => {
    const d = definition();
    d.state.number = { type: 'enum', values: [1, 3], default: 1 };
    d.state.flag = { type: 'enum', values: [true], default: true };
    d.state.name = { type: 'enum', values: ['a', 'A', ''], default: '' };
    d.state.none = { type: 'enum', values: [null], default: null };
    d.kinds.gain.effects = [{ op: 'set', path: ['number'], value: 3 }, { op: 'set', path: ['flag'], value: true }];
    d.kinds.gain.when = ['gt', ['get', ['number']], 0]; ok(pack([d]));
    d.kinds.gain.effects[0].value = 2; refuse(pack([d]), 'DM_BOUNDS');
    d.kinds.gain.effects[0].value = 3; d.kinds.gain.effects[1].value = false; refuse(pack([d]), 'DM_BOUNDS');
});

test('template command names and screen nested records are checked by shared renderer contracts', () => {
    const d = definition();
    d.screens = [{ id: 'template', mounts: ['dialog'], template: '<b>Counter</b>', data: { values: { query: 'dataModules.view', args: { module: 'pack.dm-test/counter' } } } }];
    ok(pack([d]));
    d.screens[0].template = '<button data-command="inventory.add">Grant</button>'; refuse(pack([d]));
    d.screens[0].template = '<form data-submit="inventory&#46;add"></form>'; refuse(pack([d]));
    d.screens[0].template = '<b>Counter</b>'; d.screens[0].data.values.unknown = true; refuse(pack([d]));
    delete d.screens[0].data.values.unknown;
    d.screens[0].steps = [{ id: 'one', template: '<b>Step</b>', unknown: true }]; refuse(pack([d]));
});

test('standalone checker retains pack nesting and hostile JSON safety diagnostics', () => {
    const d = definition(); let expr = true; for (let i = 0; i < 15; i++) expr = ['not', expr]; d.kinds.gain.when = expr;
    const input = pack([d]);
    const whole = validatePack(input);
    const standalone = validateDataModules(input.content.dataModules, { packId: input.id, capabilities: input.requires.capabilities });
    assert.deepEqual(standalone.errors, whole.errors);
    const getter = definition(); Object.defineProperty(getter, 'sideEffect', { enumerable: true, get() { throw new Error('must never run'); } });
    const checked = validatePack(pack([getter])); assert.equal(checked.ok, false); assert.equal(checked.errors[0].code, 'NOT_PLAIN');
});

test('a timer/view/export-only module may declare an empty kinds object', () => {
    const d = definition(); d.kinds = {}; d.imports = { clock: clock() }; d.timers = [timer()];
    ok(pack([d]));
});

test('screen action label names and literals use the same local kind schema', () => {
    const d = definition(); d.kinds.gain.ui = true; d.kinds.gain.labels = { amount: { type: 'int', min: 1, max: 3 } };
    const payload = { module: 'pack.dm-test/counter', kind: 'gain', labels: {} };
    d.screens = [{ id: 'action', layout: { root: { type: 'button', label: 'Gain', command: 'dm.act', payload } } }];
    refuse(pack([d]), 'DM_LABEL');
    payload.labels.amount = 2; ok(pack([d]));
    payload.labels.amount = 4; refuse(pack([d]), 'DM_LABEL');
    payload.labels.amount = '2'; refuse(pack([d]), 'DM_LABEL');
    payload.labels.amount = '$item.amount';
    // Row references need a list as in the existing renderer contract.
    d.screens[0].layout.root = { type: 'list', bind: { query: 'dataModules.view', args: { module: 'pack.dm-test/counter' }, path: 'chat' }, item: d.screens[0].layout.root };
    ok(pack([d]));
    payload.labels.unknown = 1; refuse(pack([d]), 'DM_LABEL');
});

// Review findings on the checker (early review of 22a3976): label payloads are plain data, and a template button's payload is
// held to the same closed shape as a layout action's.
const askKind = () => {
    const d = definition();
    d.kinds.ask = { op: '!', ui: true, labels: { query: { type: 'enum', values: ['hello', 'bye'] }, command: { type: 'enum', values: ['hello', 'bye'] } }, effects: [change()] };
    return d;
};
const action = payload => ({ type: 'button', label: 'Ask', command: 'dm.act', payload });
const withLayout = (d, payload) => { d.screens = [{ id: 'ask-screen', title: 'Ask', mounts: ['tab'], layout: { root: { type: 'col', children: [action(payload)] } } }]; return pack([d]); };
const GOOD = { module: 'pack.dm-test/counter', kind: 'ask', labels: { query: 'hello', command: 'bye' } };

test('a label may be called query or command and hold any text of its type: a payload is data, not a binding or an action', () => {
    ok(withLayout(askKind(), GOOD));
    // The label's value still has to be of its declared type.
    refuse(withLayout(askKind(), { ...GOOD, labels: { query: 'nope', command: 'bye' } }), 'DM_LABEL');
    // And a real binding or foreign action beside it is still held to the rules.
    const d = askKind();
    withLayout(d, GOOD);
    d.screens[0].layout.root.children.push({ type: 'text', label: 'x', bind: { query: 'inventory.items', args: {} } });
    refuse(pack([d]), 'DM_SCHEMA');
});

test('a template button carries the closed dm.act payload only: foreign, unknown, extra, unlabelled and form payloads are refused', () => {
    const page = (button, extra = {}) => { const d = askKind(); d.screens = [{ id: 'ask-screen', title: 'Ask', mounts: ['tab'], template: button, ...extra }]; return pack([d]); };
    const payload = value => `<button data-command="dm.act" data-payload='${JSON.stringify(value)}'>Ask</button>`;
    ok(page(payload(GOOD)));
    ok(page('<button data-command="dm.act" data-payload=\'{"module":"pack.dm-test/counter","kind":"ask","labels":{"query":"{{ item.q }}","command":"bye"}}\'>Ask</button>'));
    refuse(page(payload({ ...GOOD, module: 'pack.other/counter' })));
    refuse(page(payload({ ...GOOD, kind: 'gain' })), 'DM_SCHEMA');                                     // not a ui kind
    refuse(page(payload({ ...GOOD, kind: 'nope' })));
    refuse(page(payload({ ...GOOD, extra: 1 })));                                                       // outside the closed shape
    refuse(page(payload({ module: GOOD.module, kind: 'ask' })), 'DM_LABEL');                           // labels missing
    refuse(page(payload({ ...GOOD, labels: { query: 'hello', command: 'bye', more: 'x' } })), 'DM_LABEL');
    refuse(page(payload({ ...GOOD, who: 'Wessel' })), 'DM_LABEL');                                     // chat scope has no who
    refuse(page('<button data-command="dm.act">Ask</button>'));                                         // no payload at all
    refuse(page('<button data-command="dm.act" data-payload=\'[1]\'>Ask</button>'));
    refuse(page('<button data-command="dm.act" data-payload=\'{"module":"{{ x }}","kind":"ask","labels":{"query":"hello","command":"bye"}}\'>Ask</button>'));
    refuse(page('<form data-submit="dm.act"><input data-draft="x"></form>'));
    refuse(page(payload(GOOD), { steps: [{ id: 's', template: payload({ ...GOOD, module: 'pack.other/counter' }) }] }));
});
