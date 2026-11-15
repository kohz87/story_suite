import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePack } from '../../../src/v2/packs/validate.js';
import { validateDataMigration } from '../../../src/v2/data-modules/check.js';
import { integer, change, definition, pack, ok, refuse, edit, reward, timer, clock } from './check.helpers.js';

const invalidExpressions = [
    [['missing', 1], 'DM_SCHEMA'], [['add', 1], 'DM_SCHEMA'], [['add', 1, 2, 3], 'DM_SCHEMA'],
    [['constructor'], 'DM_SCHEMA'], [{ code: 'x' }, 'DM_SCHEMA'], [0.5, 'DM_BOUNDS'],
    [['get', ['missing']], 'DM_SCHEMA'], [['get', ['points', 'missing']], 'DM_SCHEMA'],
    [['arg', 'missing'], 'DM_SCHEMA'], [['bind', 'missing'], 'DM_SCHEMA'], [['reward', 'missing'], 'DM_SCHEMA'],
    [['input', 'missing', 'minutes'], 'DM_SCHEMA'], [['timer', 'periods'], 'DM_SCHEMA'],
    [['add', 1, true], 'DM_SCHEMA'], [['eq', 1, '1'], 'DM_SCHEMA'], [['gt', 'a', 'b'], 'DM_SCHEMA'],
    [['and', true, 1], 'DM_SCHEMA'], [['not', 1], 'DM_SCHEMA'],
    [['floorDiv', 1, 0], 'DM_BOUNDS'], [['floorDiv', 1, -1], 'DM_BOUNDS'],
    [['floorDiv', 1, ['add', 1, 1]], 'DM_BOUNDS'],
    [['clamp', 1, 5, 0], 'DM_BOUNDS'], [['clamp', 1, 0, ['add', 1, 2]], 'DM_BOUNDS'],
    [['add', 1000000000, 1], 'DM_BOUNDS'], [['clamp', ['add', 1000000000, 1], 0, 100], 'DM_BOUNDS'],
];
for (const [expression, code] of invalidExpressions) test(`invalid AST ${JSON.stringify(expression)} refuses ${code}`, () => {
    refuse(edit(d => { d.kinds.gain.effects[0].value = expression; }), code);
});

for (const expression of [
    ['add', 1, 2], ['sub', 3, 2], ['mul', 2, -3], ['min', 3, 4], ['max', 3, 4],
    ['floorDiv', -7, 2], ['clamp', ['get', ['points']], 1, 90],
]) test(`valid integer AST ${expression[0]}`, () => ok(edit(d => { d.kinds.gain.effects[0].value = expression; })));

for (const expression of [
    ['eq', 1, 1], ['ne', 'a', 'b'], ['lt', 1, 2], ['le', 1, 2], ['gt', 2, 1], ['ge', 2, 1],
    ['and', true, false], ['or', true, false], ['not', false], ['eq', null, null],
]) test(`valid boolean AST ${expression[0]}`, () => ok(edit(d => { d.kinds.gain.when = expression; })));

test('enum paths cover every possible key and writes must fit every possible target', () => {
    const d = definition();
    d.state.table = { type: 'map', keys: ['a', 'b'], values: integer() };
    d.kinds.gain.labels = { key: { type: 'enum', values: ['a', 'b'] } };
    d.kinds.gain.effects = [{ op: 'set', path: ['table', ['arg', 'key']], value: 7 }];
    ok(pack([d]));
    d.kinds.gain.labels.key.values.push('c'); refuse(pack([d]));
    d.kinds.gain.labels.key = { type: 'int', min: 0, max: 1 }; refuse(pack([d]));
    d.kinds.gain.effects[0].path = ['table']; refuse(pack([d]));
});

test('text stays display-only and field type/range mismatches cannot create implicit state', () => {
    const d = definition(); d.state.note = { type: 'text', max: 8, default: '' };
    d.kinds.gain.effects = [{ op: 'set', path: ['note'], value: 'hello' }]; ok(pack([d]));
    d.kinds.gain.effects[0].value = ['get', ['note']]; refuse(pack([d]));
    d.kinds.gain.effects = [{ op: 'add', path: ['note'], value: 1 }]; refuse(pack([d]));
    refuse(edit(d => { d.kinds.gain.effects = [{ op: 'set', path: ['points'], value: true }]; }), 'DM_BOUNDS');
    refuse(edit(d => { d.kinds.gain.effects = [{ op: 'set', path: ['points'], value: 101 }]; }), 'DM_BOUNDS');
    refuse(edit(d => { d.kinds.gain.effects = [{ op: 'set', path: ['implicit'], value: 1 }]; }));
});

for (const [name, changeDefinition, code] of [
    ['arbitrary commands', d => { d.kinds.gain.effects = [{ op: 'command', type: 'inventory.add', payload: {} }]; }, 'DM_SCHEMA'],
    ['raw patch', d => { d.kinds.gain.effects = [{ op: 'replace', path: '/domains/coin', value: 1 }]; }, 'DM_SCHEMA'],
    ['add bounds', d => { d.kinds.gain.effects[0].bounds = 'partial'; }, 'DM_SCHEMA'],
    ['clamp reversal', d => { d.kinds.gain.effects = [{ op: 'clamp', path: ['points'], min: 50, max: 0 }]; }, 'DM_BOUNDS'],
    ['clamp wider', d => { d.kinds.gain.effects = [{ op: 'clamp', path: ['points'], min: 0, max: 101 }]; }, 'DM_BOUNDS'],
    ['kind op', d => { d.kinds.gain.op = '='; }, 'DM_SCHEMA'],
    ['reserved labels', d => { d.kinds.gain.labels.kind = { type: 'bool' }; }, 'DM_LABEL'],
    ['label word', d => { d.kinds.gain.labels['two-words'] = { type: 'bool' }; }, 'DM_LABEL'],
    ['claim int', d => { d.kinds.gain.labels.count = { type: 'int', min: 1, max: 3 }; d.kinds.gain.oncePerReply = ['count']; }, 'DM_LABEL'],
    ['claim unknown', d => { d.kinds.gain.oncePerReply = ['missing']; }, 'DM_LABEL'],
    ['condition coercion', d => { d.kinds.gain.when = 1; }, 'DM_CONDITION'],
]) test(`effects/kinds refusal: ${name}`, () => refuse(edit(changeDefinition), code));

test('rewards validate frozen range pickers and exhaustively covered enum range tables', () => {
    const d = definition();
    d.rewards = { gift: reward() };
    d.kinds.gain.effects = [{ op: 'reward', template: 'gift', bind: {} }];
    for (const pick of ['min', 'max', 'midpoint']) { d.rewards.gift.values.amount.pick = pick; ok(pack([d])); }
    d.rewards.gift.values.amount.pick = 'random'; refuse(pack([d]));
    d.rewards.gift.bindings = { tier: { type: 'enum', values: ['low', 'high'] } };
    d.rewards.gift.values.amount = { binding: 'tier', table: { low: { min: 1, max: 2, pick: 'min' }, high: { min: 3, max: 5, pick: 'midpoint' } } };
    d.kinds.gain.effects[0].bind = { tier: 'low' }; ok(pack([d]));
    d.kinds.gain.effects[0].bind.tier = 'other'; refuse(pack([d]), 'DM_BOUNDS');
    d.kinds.gain.effects[0].bind.tier = 'low';
    delete d.rewards.gift.values.amount.table.high; refuse(pack([d]));
});

test('reward/offer references and bindings are closed and templates cannot recurse', () => {
    const d = definition(); d.rewards = { gift: reward() };
    d.kinds.gain.effects = [{ op: 'offer', template: 'gift', key: 'prize', bind: {} }, { op: 'award', offer: 'prize' }];
    ok(pack([d]));
    d.kinds.gain.effects[1].offer = 'missing'; refuse(pack([d]));
    d.kinds.gain.effects.pop(); d.kinds.gain.effects[0].template = 'missing'; refuse(pack([d]));
    d.kinds.gain.effects[0].template = 'gift'; d.kinds.gain.effects[0].bind = { unknown: 1 }; refuse(pack([d]));
    d.kinds.gain.effects[0].bind = {}; d.rewards.gift.effects = [{ op: 'reward', template: 'gift', bind: {} }]; refuse(pack([d]));
});

test('timers require witnessed SD minutes, additive effects and proven bounded arithmetic', () => {
    const d = definition(); d.imports = { clock: clock() }; d.timers = [timer()]; ok(pack([d]));
    d.timers[0].every = 0; refuse(pack([d]), 'DM_BOUNDS');
    d.timers[0].every = 525601; refuse(pack([d]), 'DM_BOUNDS');
    d.timers[0].every = 1; d.timers[0].effects[0].value = ['mul', ['timer', 'periods'], 1902]; ok(pack([d]));
    d.timers[0].effects[0].value[2] = 1903; refuse(pack([d]), 'DM_BOUNDS');
    d.timers[0].effects = [{ op: 'set', path: ['points'], value: 1 }]; refuse(pack([d]));
    d.timers[0].effects = [change()]; d.imports.clock.mode = 'recorded'; refuse(pack([d]));
    d.imports.clock.mode = 'prefix'; d.imports.clock.projection = ['text']; refuse(pack([d]));
});

function exportedPair() {
    const a = definition(), b = definition(); b.slug = 'reader'; b.kinds.gain.effects[0].value = ['input', 'score', 'points'];
    a.exports = { score: { fields: ['points'] } };
    b.imports = { score: { query: 'dataModules.public', mode: 'prefix', args: { module: 'pack.dm-test/counter', export: 'score' }, projection: ['points'] } };
    return [a, b];
}

test('data imports resolve typed public exports, reject private fields/cycles, support checked external catalogs', () => {
    const defs = exportedPair(); ok(pack(defs));
    defs[1].imports.score.projection = ['private']; refuse(pack(defs));
    defs[1].imports.score.projection = ['points'];
    defs[1].exports = { score: { fields: ['points'] } };
    defs[0].imports = { back: { ...defs[1].imports.score, args: { module: 'pack.dm-test/reader', export: 'score' } } };
    assert.match(refuse(pack(defs)).message, /cycle/);
    const pair = exportedPair();
    const target = ok(pack([pair[0]])).pack.content.dataModules[0];
    const input = pack([pair[1]]); input.id = 'external';
    const checked = validatePack(input, { dataModuleDefinitions: [target] });
    assert.equal(checked.ok, true, JSON.stringify(checked.errors));
    refuse(input);
});

test('public import adapters reject private paths, unknown queries/arguments and actor aliases', () => {
    for (const entry of [
        { ...clock(), query: 'director.private' }, { ...clock(), args: { state: true } },
        { ...clock(), projection: ['formatted'] }, { ...clock(), projection: ['minutes', 'minutes'] },
        { ...clock(), mode: 'live' }, { query: 'checks.policy', mode: 'prefix', projection: ['settings'] },
        { query: 'dataModules.public', mode: 'prefix', args: { module: 'pack.dm-test/counter', export: 'score', who: 'ac_fake' }, projection: ['points'] },
    ]) refuse(edit(d => { d.imports = { alias: entry }; }));
    const defs = exportedPair(); defs[0].scope = 'character'; refuse(pack(defs));
    defs[1].imports.score.args.who = 'ca_wessel'; ok(pack(defs));
});

test('module presentation uses the existing renderer validator and checks own view/command references', () => {
    const d = definition(); d.kinds.gain.ui = true;
    d.screens = [{ id: 'counter', layout: { root: { type: 'text', bind: { query: 'dataModules.view', args: { module: 'pack.dm-test/counter' }, path: 'chat.points' } } } }];
    ok(pack([d]));
    d.screens[0].layout.root.bind.path = 'chat.secret'; refuse(pack([d]));
    d.screens[0].layout.root.bind.path = 'chat.points';
    d.screens[0].layout.root.bind.args.module = 'pack.other/counter'; refuse(pack([d]));
    d.screens[0].layout.root = { type: 'button', label: 'Gain', command: 'dm.act', payload: { module: 'pack.dm-test/counter', kind: 'gain' } }; ok(pack([d]));
    d.kinds.gain.ui = false; refuse(pack([d]));
    d.kinds.gain.ui = true; d.screens[0].layout.root.command = 'inventory.add'; refuse(pack([d]));
    // Ordinary layout acceptance still allows renderer warnings.
    const old = { id: 'old', version: '1.0.0', requires: { storyBlock: '^2' }, layouts: [{ arbitrary: true }] }; ok(old);
});

test('additive migration checks old semantics, consecutive versions, exact schemas and defaults', () => {
    const old = ok(pack()).pack.content.dataModules[0];
    const next = definition(); next.stateVersion = 2; next.state.flag = { type: 'bool', default: false };
    next.migrations = [{ from: 1, to: 2, add: { flag: { type: 'bool', default: false } } }];
    const target = ok(pack([next])).pack.content.dataModules[0];
    assert.deepEqual(validateDataMigration(old, target), { ok: true, add: { flag: { type: 'bool', default: false } } });
    for (const mutate of [
        d => { d.kinds.gain.effects[0].value = 2; }, d => { d.state.points.max = 200; },
        d => { delete d.state.points; }, d => { d.state.points.default = 1; }, d => { d.scope = 'character'; },
        d => { d.rules.push({ id: 'new', when: true, then: [] }); }, d => { d.imports.new = clock(); },
    ]) {
        const changed = structuredClone(target); mutate(changed);
        assert.equal(validateDataMigration(old, changed).ok, false);
    }
    assert.equal(validateDataMigration(target, old).ok, false);
    next.migrations[0].to = 3; refuse(pack([next]));
    next.migrations[0].to = 2; next.migrations[0].add.flag.default = true; refuse(pack([next]));
});
