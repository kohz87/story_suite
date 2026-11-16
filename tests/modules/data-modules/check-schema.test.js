import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePack } from '../../../packs/validate.js';
import { contentOf } from '../../../packs/content.js';
import { HOST_CAPABILITIES } from '../../../packs/limits.js';
import { validatePack as oldValidatePack } from '../../packs/fixtures/old-host/validate.js';
import { validateDataModules, dataModuleDefaults, dataModuleHash,
    DM_LIMITS as L, DM_DESCRIPTORS as D, DM_DIAGNOSTICS } from '../../../modules/data-modules/check.js';
import * as packsApi from '../../../packs/index.js';
import { read, integer, change, definition, pack, ok, refuse, edit, set, reward, timer, clock } from './check.helpers.js';

for (const name of ['reputation', 'survival']) test(`worked example ${name} is the exact complete JSON from the approved spec`, () => {
    const doc = readFileSync(new URL('../../../packages/story-block/docs/v2/DATA_MODULES.md', import.meta.url), 'utf8');
    const examples = [...doc.matchAll(/```json\n([\s\S]*?)\n```/g)].map(match => JSON.parse(match[1]));
    const input = read(name);
    const installable = readFileSync(new URL(`../../../examples/packs/${input.id}/pack.json`, import.meta.url), 'utf8');
    assert.deepEqual(JSON.parse(installable), input, 'the installable pack matches the worked example');
    const installed = validatePack(installable, { capabilities: ['data-modules-v1', 'story-director'] });
    assert.equal(installed.ok, true, JSON.stringify(installed.errors));
    assert.deepEqual(input, examples.find(p => p.id === input.id));
    const before = JSON.stringify(input);
    const result = ok(input);
    assert.equal(JSON.stringify(input), before, 'the caller is untouched');
    assert.deepEqual(result.raw, input, 'raw exports retain the authored format');
    assert.equal(result.pack.content.dataModules[0].id, `pack.${input.id}/${input.content.dataModules[0].slug}`);
    assert.equal(contentOf([result.pack], 'dataModules').length, 1);
    const shared = validateDataModules(input.content.dataModules, { packId: input.id, capabilities: input.requires.capabilities });
    assert.deepEqual(shared.definitions, result.pack.content.dataModules);
    assert.match(result.packHash, /^[0-9a-f]{64}$/);
});

test('Studio can import the same frozen descriptors, diagnostics, limits and checker through packs', () => {
    assert.equal(packsApi.validateDataModules, validateDataModules);
    assert.equal(packsApi.DM_LIMITS, L);
    assert.equal(packsApi.DM_DESCRIPTORS, D);
    assert.equal(packsApi.DM_DIAGNOSTICS, DM_DIAGNOSTICS);
    assert.ok(Object.isFrozen(D.effects.add.required));
    assert.ok(Object.isFrozen(L));
    assert.ok(HOST_CAPABILITIES.includes('data-modules-v1'));
    assert.equal(Object.keys(DM_DIAGNOSTICS).length, 5);
});

for (const fixture of read('refusals')) test(`refusal fixture ${fixture.code} has stable code, path, message and Studio parity`, () => {
    const input = definition();
    set(input, fixture.target, fixture.repeat ? Array.from({ length: fixture.repeat }, change) : fixture.value);
    const file = pack([input]);
    const error = refuse(file, fixture.code, fixture.path);
    assert.equal(error.message, fixture.message);
    const standalone = validateDataModules(file.content.dataModules, { packId: file.id, capabilities: file.requires.capabilities });
    assert.deepEqual(standalone.errors, validatePack(file).errors);
});

test('capability is required even for an empty definition list; host capability availability is separate', () => {
    const input = pack([]); input.requires.capabilities = [];
    refuse(input, 'DM_SCHEMA', 'requires.capabilities');
    const missing = validatePack(pack(), { capabilities: [] });
    assert.equal(missing.ok, false);
    assert.equal(missing.errors[0].code, 'MISSING_CAPABILITY');
    ok(pack());
});

test('old packs and explicitly unused definitions retain raw bytes and detached normalization', () => {
    const old = { id: 'old', name: 'Old', version: '1.0.0', requires: { storyBlock: '^2' }, content: {} };
    assert.deepEqual(validatePack(old), oldValidatePack(old));
    const result = ok(old);
    assert.equal('dataModules' in result.pack.content, false);
    assert.equal('packHash' in result, false);
    const input = pack();
    const checked = ok(input);
    checked.pack.content.dataModules[0].state.points.default = 12;
    assert.equal(input.content.dataModules[0].state.points.default, 0);
    assert.equal(checked.raw.content.dataModules[0].state.points.default, 0);
});

test('normalization defaults belong only to this format; hashes cover semantics and presentation, not envelope versions', () => {
    const input = pack();
    const a = ok(input);
    const def = a.pack.content.dataModules[0];
    for (const [key, value] of Object.entries(D.defaults)) assert.deepEqual(def[key], value);
    assert.deepEqual(def.kinds.gain.oncePerReply, []);
    const equivalent = structuredClone(input);
    equivalent.content.dataModules[0].kinds.gain.oncePerReply = [];
    equivalent.content.dataModules[0].kinds.gain.ui = false;
    equivalent.content.dataModules[0].kinds.gain.when = true;
    assert.equal(dataModuleHash(def), dataModuleHash(ok(equivalent).pack.content.dataModules[0]));
    equivalent.version = '1.0.1';
    const b = ok(equivalent);
    assert.equal(dataModuleHash(def), dataModuleHash(b.pack.content.dataModules[0]));
    assert.notEqual(a.packHash, b.packHash);
    equivalent.content.dataModules[0].kinds.gain.effects[0].value = 2;
    assert.notEqual(dataModuleHash(def), dataModuleHash(ok(equivalent).pack.content.dataModules[0]));
    const reversed = Object.fromEntries(Object.entries(def).reverse());
    assert.equal(dataModuleHash(def), dataModuleHash(reversed));
});

for (const type of ['check', ...D.v11Effects]) test(`v1.1 feature ${type} is refused on import with the mandated message`, () => {
    const input = edit(d => {
        if (type === 'check') d.kinds.gain.check = { skill: 'survival', stat: 'WIS', dc: 12 };
        else d.kinds.gain.effects = [{ op: type, amount: 1 }];
    });
    const result = validatePack(input);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(e => e.message.includes('needs data-modules v1.1')));
});

test('v1.1 checks cannot be read through an expression or hidden in timer/reward effects', () => {
    const checked = edit(d => { d.kinds.gain.when = ['eq', ['check', 'outcome'], 'success']; });
    assert.match(refuse(checked).message, /needs data-modules v1\.1/);
    for (const op of D.v11Effects) {
        const input = edit(d => { d.rewards = { gift: reward() }; d.rewards.gift.effects.push({ op, amount: 1 }); });
        assert.ok(validatePack(input).errors.some(e => e.message.includes('needs data-modules v1.1')));
    }
});

const unknowns = [
    [[], 'oops'], [['state', 'points'], 'oops'], [['kinds', 'gain'], 'oops'], [['kinds', 'gain', 'effects', 0], 'oops'],
    [['imports', 'clock'], 'oops'], [['rewards', 'gift'], 'oops'], [['rewards', 'gift', 'values', 'amount'], 'oops'],
    [['rules', 0], 'oops'], [['timers', 0], 'oops'], [['exports', 'score'], 'oops'], [['migrations', 0], 'oops'],
    [['screens', 0], 'oops'], [['screens', 0, 'layout', 'root'], 'oops'], [['layouts', 0], 'oops'],
];
function complete() {
    const d = definition();
    d.imports = { clock: clock() }; d.rewards = { gift: reward() };
    d.rules = [{ id: 'rule', when: true, then: [change()] }]; d.timers = [timer()];
    d.exports = { score: { fields: ['points'] } };
    d.stateVersion = 2; d.state.new = integer();
    d.migrations = [{ from: 1, to: 2, add: { new: integer() } }];
    d.screens = [{ id: 'score', title: 'Score', layout: { root: { type: 'text', value: 'Score' } } }];
    d.layouts = [{ id: 'score-layout', title: 'Score', icon: 'fa-star', root: { type: 'text', value: 'Score' } }];
    return d;
}
for (const [path, key] of unknowns) test(`unknown key at ${path.join('.') || 'definition'} refuses`, () => {
    const d = complete(); let cursor = d; for (const key of path) cursor = cursor[key]; cursor[key] = true;
    refuse(pack([d]), 'DM_SCHEMA');
});

test('closed fields accept all scalar schemas and map defaults; no nested/growing containers', () => {
    const d = definition();
    d.state = { points: integer(), huge: integer(-Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
        flag: { type: 'bool', default: true }, title: { type: 'enum', values: ['none', 'Friend'], default: 'none' },
        note: { type: 'text', max: 240, default: 'Read me' },
        scores: { type: 'map', keys: ['a', 'b'], values: integer(-1, 1, 1) } };
    const checked = ok(pack([d])).pack.content.dataModules[0];
    assert.deepEqual(dataModuleDefaults(checked.state), { points: 0, huge: 0, flag: true, title: 'none', note: 'Read me', scores: { a: 1, b: 1 } });
    for (const type of ['list', 'array', 'object', 'number', 'constructor', null]) refuse(edit(d => { d.state.points.type = type; }));
    refuse(edit(d => { d.state.points = { type: 'map', keys: ['one'], values: { type: 'map', keys: ['two'], values: integer() } }; }));
});

for (const [name, schema, code] of [
    ['fraction default', integer(0, 100, 0.5), 'DM_BOUNDS'],
    ['reversed int', integer(10, 0, 0), 'DM_BOUNDS'],
    ['unsafe integer', integer(0, Number.MAX_SAFE_INTEGER + 1, 0), 'DM_BOUNDS'],
    ['bool coercion', { type: 'bool', default: 1 }, 'DM_SCHEMA'],
    ['enum default', { type: 'enum', values: ['a'], default: 'b' }, 'DM_BOUNDS'],
    ['enum collision', { type: 'enum', values: ['a', 'ａ'], default: 'a' }, 'DM_SCHEMA'],
    ['text min', { type: 'text', max: 0, default: '' }, 'DM_BOUNDS'],
    ['text max', { type: 'text', max: 241, default: '' }, 'DM_BOUNDS'],
    ['text default', { type: 'text', max: 1, default: 'xx' }, 'DM_BOUNDS'],
]) test(`field refusal: ${name}`, () => refuse(edit(d => { d.state.points = schema; }), code));

test('schema, IDs, scope, version, text safety, normalized keys and prototype keys are checked', () => {
    for (const [key, value] of [['schema', 2], ['stateVersion', 0], ['scope', 'persona'], ['slug', 'x'.repeat(41)], ['name', 'bad\nname']]) refuse(edit(d => { d[key] = value; }));
    refuse(pack([definition(), definition()]));
    refuse(edit(d => { d.name = '<script>bad</script>'; }), 'UNSAFE_HTML');
    const unsafe = JSON.parse(JSON.stringify(pack()).replace('"points":', '"__proto__":'));
    refuse(unsafe, 'UNSAFE_KEY');
    const unsafeExpression = edit(d => { d.kinds.gain.effects[0].path = ['constructor']; });
    refuse(unsafeExpression);
    refuse(edit(d => { d.state['é'] = integer(); d.state['e\u0301'] = integer(); }));
});
