// The `interactions` module field: one refusal sentence per bad field, unknown members warned, kinds indexed, sdk.modules() lists them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry, definitionProblems, definitionWarnings } from '../../core/registry.js';
import { createHost } from '../../packages/story-block/testkit/index.js';
import { PROBE_KIND } from './interaction/helpers/probe-kind.js';

const module = interactions => ({ id: 'test', interactions });
const probe = changes => ({ probe: { ...PROBE_KIND, ...changes } });
const problems = changes => definitionProblems(module(probe(changes)));

test('a complete kind registers; no field at all is fine', () => {
    assert.deepEqual(definitionProblems(module(probe({}))), []);
    assert.deepEqual(definitionProblems({ id: 'test' }), []);
    assert.deepEqual(definitionProblems(module({})), []);
});

test('each bad field gives exactly one sentence that names the kind and the field', () => {
    const bad = {
        version: ['0', 'version is not a whole number above zero'],
        title: [undefined, 'has no title'],
        feature: [undefined, 'feature is not a feature id'],
        screen: ['Bad Screen', 'screen is not a screen id'],
        limits: [[], 'limits is not an object'],
        changes: ['inventory.consume', 'changes is not a list of command names'],
        ready: [true, 'ready is not a function'],
        open: [undefined, 'open is not a function'],
        witness: [1, 'witness is not a function'],
        validate: [null, 'validate is not a function'],
        play: [undefined, 'play is not a function'],
        settle: ['x', 'settle is not a function'],
        note: [undefined, 'note is not a function'],
        actors: [5, 'actors is not a function'],
        auto: ['yes', 'auto is not a function'],
        opening: [{}, 'opening is not a function'],
        view: [1, 'view is not a function'],
        carry: ['yes', 'carry is not true'],
        marker: [{ word: '' }, 'marker has no word'],
    };
    for (const [field, [value, text]] of Object.entries(bad)) {
        const found = problems({ [field]: value });
        assert.equal(found.length, 1, `${field}: ${JSON.stringify(found)}`);
        assert.ok(found[0].includes(`interaction "probe"`) && found[0].includes(text), `${field}: ${found[0]}`);
    }
});

test('title length, limits, carry and next, marker feature and kind names are each refused once', () => {
    assert.match(problems({ title: 'x'.repeat(25) }).join('|'), /title is longer than 24/);
    assert.deepEqual(problems({ title: 'x'.repeat(24) }), []);
    assert.equal(problems({ limits: { steps: 0 } }).length, 1);
    assert.equal(problems({ limits: { steps: 1.5 } }).length, 1);
    assert.equal(problems({ limits: { turns: 3 } }).length, 1);
    assert.deepEqual(problems({ limits: { noteTokens: null, steps: 5 } }), []);
    assert.equal(problems({ limits: { steps: 0, stepInputs: -1 } }).length, 2, 'one sentence per bad limit');
    assert.equal(problems({ next: undefined }).length, 1, 'carry without next');
    assert.equal(problems({ carry: undefined }).length, 1, 'next without carry');
    assert.equal(problems({ carry: undefined, next: undefined }).length, 0);
    assert.equal(problems({ marker: { word: 'battle', feature: 3 } }).length, 1);
    assert.equal(definitionProblems(module({ Bad: PROBE_KIND })).length, 1);
    assert.equal(definitionProblems(module({ probe: 'x' })).length, 1);
    assert.equal(definitionProblems(module([])).length, 1);
    assert.equal(definitionProblems(module({ probe: PROBE_KIND, 'a/b': PROBE_KIND })).length, 1);
});

test('unknown interaction members and the interactions field itself are only warned about when unknown', () => {
    assert.deepEqual(definitionWarnings(module(probe({}))), []);
    assert.deepEqual(definitionWarnings(module(probe({ newer: 1 }))), ['"newer" on interaction "probe" is not an interaction field this Story Block knows; it is ignored']);
});

test('the registry refuses a bad definition and indexes kinds by full id; sdk.modules() lists them', async () => {
    const registry = createRegistry({ warn: () => {} });
    assert.throws(() => registry.register(module(probe({ version: 0 }))), /cannot be registered.*version is not a whole number/);
    assert.equal(registry.interaction('test/probe'), null);
    registry.register(module(probe({})));
    assert.equal(registry.interaction('test/probe'), registry.module('test').interactions.probe);
    for (const id of ['test/none', 'probe', '/probe', 'nope/probe', undefined]) assert.equal(registry.interaction(id), null, String(id));
    assert.deepEqual(registry.interactionIds('test'), ['test/probe']);
    assert.deepEqual(registry.interactionIds('nope'), []);

    const host = await createHost({ fakes: true, core: false, modules: [module(probe({}))] });
    try {
        const entry = host.sdk.modules().find(item => item.id === 'test');
        assert.deepEqual(entry.interactions, ['test/probe']);
        assert.ok(Object.isFrozen(entry.interactions));
    } finally { host.close(); }
});

test('the core module answers interaction.view with null until an interaction api is passed', async () => {
    const host = await createHost();
    try {
        assert.equal(host.registry.queryOwner('interaction.view'), 'story-block');
        assert.equal(host.sdk.query('interaction.view'), null);
        assert.deepEqual(host.sdk.modules().find(item => item.id === 'story-block').interactions, []);
    } finally { host.close(); }
});

test('a marker word is a plain lowercase word, and never a header the host\'s own prompt text uses', () => {
    for (const word of ['Battle', 'two words', 'a'.repeat(25), '[x]', '1st', 'happened']) assert.equal(problems({ marker: { word } }).length, 1, word);
    assert.match(problems({ marker: { word: 'happened' } })[0], /header of the host's own prompt text/);
    for (const word of ['battle', 'hard-bargain', 'a'.repeat(24)]) assert.deepEqual(problems({ marker: { word } }), [], word);
});
