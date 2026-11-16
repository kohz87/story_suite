// Features (MODULES §F100, SPEC §6): a module's optional mechanics as reader switches.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../packages/story-block/testkit/index.js';
import { createRegistry, definitionProblems, definitionWarnings } from '../../core/registry.js';
import { FEATURE_OFF } from '../../core/features.js';
import { refusedFrom } from '../../packages/story-block/src/v2/reply-notes.js';
import { BASE_STATIC, WEAR_GRAMMAR, WEAR_STATIC, WEATHER_LINE, gear, statics, tails } from './features.helpers.js';

// ---------------------------------------------------------------------------------------------------
// The definition

test('features: a well-formed list registers, and its lookups describe each feature', () => {
    assert.deepEqual(definitionProblems(gear()), []);
    assert.deepEqual(definitionWarnings(gear()), []);
    const registry = createRegistry();
    registry.register(gear());
    assert.deepEqual(registry.features().map(feature => [feature.id, feature.default, feature.prompt]), [
        ['gear.wear', true, true],          // owns a kind and a static part: changes the fixed prompt
        ['gear.weather', false, false],
        ['gear.extras', true, false],       // no default given: on
    ]);
    assert.deepEqual(registry.feature('gear.weather'), {
        id: 'gear.weather', moduleId: 'gear', moduleName: 'Gear', label: 'Weather', describe: 'A weather line each reply.', default: false, prompt: false,
        needs: { kinds: [], commands: [], queries: [], why: 'Needs a module that is not installed.' }, available: true, why: '',
    });
    assert.equal(registry.feature('gear.nope'), null);
    assert.equal(registry.featureOn('gear.wear'), true);
    assert.equal(registry.featureOn('gear.weather'), false);
    assert.equal(registry.commandFeature('gear.polish'), 'gear.extras');
    assert.equal(registry.commandFeature('capture.wear'), 'gear.wear');
    assert.equal(registry.commandFeature('gear.count'), null);
    // `prompt: true` marks a feature whose own code changes the static text.
    const marked = createRegistry();
    marked.register({ id: 'mark', features: [{ id: 'mark.x', label: 'X', prompt: true }] });
    assert.equal(marked.feature('mark.x').prompt, true);
});

test('features: every mistake is refused with a plain sentence, and nothing of the module is kept', () => {
    const cases = [
        [{ features: {} }, /features is not a list/],
        [{ features: ['wear'] }, /feature 1 is not an object/],
        [{ features: [{ id: 'wear', label: 'Wear' }] }, /needs an id made of the module id, a dot and a lowercase name \(like "bad\.wear"\)/],
        [{ features: [{ id: 'other.wear', label: 'Wear' }] }, /needs an id made of the module id/],
        [{ features: [{ id: 'bad.Wear', label: 'Wear' }] }, /needs an id made of the module id/],
        [{ features: [{ id: 'bad.wear', label: 'Wear' }, { id: 'bad.wear', label: 'Again' }] }, /the feature "bad\.wear" is named twice/],
        [{ features: [{ id: 'bad.wear' }] }, /the feature "bad\.wear" has no label/],
        [{ features: [{ id: 'bad.wear', label: 'x'.repeat(61) }] }, /label longer than 60 characters/],
        [{ features: [{ id: 'bad.wear', label: 'Wear', describe: 3 }] }, /describe is not text/],
        [{ features: [{ id: 'bad.wear', label: 'Wear', default: 'yes' }] }, /default is not true or false/],
        [{ features: [{ id: 'bad.wear', label: 'Wear', prompt: 1 }] }, /prompt is not true or false/],
        [{ capture: { kinds: { wear: { grammar: '~ wear X', feature: 'bad.wear' } }, apply: () => ({}) } }, /the capture kind "wear" names the feature "bad\.wear", which is not one of this module's features/],
        [{ features: [{ id: 'bad.wear', label: 'Wear' }], commands: { 'bad.go': { handler: () => ({}), feature: 'bad.other' } } }, /the command "bad\.go" names the feature "bad\.other"/],
        [{ features: [{ id: 'bad.wear', label: 'Wear' }], queries: { 'bad.q': Object.assign(() => 1, { feature: 7 }) } }, /the query "bad\.q" has a feature that is not text/],
        [{ context: { parts: {} } }, /context\.parts is not a list/],
        [{ context: { parts: [{}] } }, /context part 1 has neither static nor tail/],
        [{ context: { parts: [{ static: 'text' }] } }, /context part 1 static is not a function/],
        [{ tabs: [{ id: 't', title: 'T', render: () => {}, feature: 'gear.extras' }] }, /the tab "t" names the feature "gear\.extras", which is not one of this module's features/],
    ];
    for (const [extra, pattern] of cases) {
        const def = { id: 'bad', name: 'Bad', ...extra };
        assert.ok(definitionProblems(def).some(problem => pattern.test(problem)), `${JSON.stringify(extra)} → ${definitionProblems(def).join(' | ')}`);
        const registry = createRegistry();
        assert.throws(() => registry.register(def), /the module "bad" cannot be registered/);
        assert.equal(registry.has('bad'), false);
        assert.deepEqual(registry.features(), []);
    }
});

test('features: a newer feature field or context field is warned about and ignored', () => {
    const messages = [];
    const registry = createRegistry({ warn: message => messages.push(message) });
    registry.register({ id: 'fut', name: 'Future', features: [{ id: 'fut.a', label: 'A', colour: 'red' }], context: { static: () => 'x', layers: [] } });
    assert.deepEqual(messages, [
        'Future: "context.layers" is not a context field this Story Block knows; it is ignored.',
        'Future: "colour" on feature "fut.a" is not a feature field this Story Block knows; it is ignored.',
    ]);
    assert.equal(registry.featureOn('fut.a'), true);
});

test('a module without features is as before: every lookup, static and tail unchanged', async () => {
    const plain = { ...gear(), id: 'plain', features: undefined, commands: { 'plain.go': () => ({ summary: 'go' }) }, queries: { 'plain.q': () => 1 }, hooks: {}, tabs: [], screens: [], widgets: {} };
    plain.capture = { kinds: { wear: { grammar: WEAR_GRAMMAR } }, apply: () => ({ summary: 'ok', narrate: false }) };
    plain.context = { static: () => BASE_STATIC, tail: () => ({ lines: ['Plain.'] }) };
    const registry = createRegistry();
    registry.register(plain);
    const [context] = registry.contexts();
    assert.deepEqual(context.kinds, [{ kind: 'wear', grammar: WEAR_GRAMMAR }]);
    assert.equal(context.static, plain.context.static, 'the very same function');
    assert.equal(context.tail, plain.context.tail);
    assert.equal(registry.capture('wear').off, false);
    assert.equal(registry.capture('wear').feature, null);
    assert.equal(registry.query('plain.q')(), 1);
    assert.deepEqual(registry.features(), []);
});

// ---------------------------------------------------------------------------------------------------
// Off means fully off

test('an off feature has no grammar, no context, no commands, no queries, no hooks and no screens', async () => {
    const host = await createHost({ modules: [gear()] });
    await host.send('Hello.', 'Hi.\n<Changes>\n~ wear Sword | wear: worn\n</Changes>');
    const onStatic = statics(host).at(-1);
    assert.ok(onStatic.includes(WEAR_GRAMMAR) && onStatic.includes(WEAR_STATIC) && onStatic.includes(BASE_STATIC));
    assert.equal(host.sdk.feature('gear.wear'), true);
    assert.equal(host.sdk.feature('gear.extras'), true);

    assert.equal(host.features.set('gear.wear', false), false);
    assert.equal(host.features.set('gear.extras', false), false);
    assert.equal(host.sdk.feature('gear.wear'), false);
    assert.equal(host.sdk.view().feature('gear.extras'), false);
    // The registry's lookups leave them out.
    const context = host.registry.contexts().find(item => item.moduleId === 'gear');
    assert.deepEqual(context.kinds.map(kind => kind.kind), ['gear']);
    assert.deepEqual(host.registry.hookEntries('beforeGenerate').filter(entry => entry.moduleId === 'gear'), []);
    assert.deepEqual(host.registry.hookEntries('canGenerate').filter(entry => entry.moduleId === 'gear'), []);
    assert.deepEqual(host.registry.tabs().filter(tab => tab.moduleId === 'gear'), []);
    assert.deepEqual(host.registry.screens().filter(screen => screen.moduleId === 'gear').map(screen => screen.id), ['gear/always']);
    assert.equal(host.registry.screenOff('gear/extras'), true);
    assert.equal(host.registry.screenOff('gear/always'), false);
    assert.deepEqual(host.registry.widgets().filter(widget => widget.moduleId === 'gear').map(widget => widget.name), ['gear.plain']);
    assert.equal(host.registry.widget('gear.badge'), null);
    assert.deepEqual(host.registry.widgetsOff(), ['gear.badge']);
    assert.equal(host.registry.capture('wear').off, true);

    // Commands: FEATURE_OFF at the top and through ctx.call (catchable: nothing ran).
    const top = await host.sdk.command('gear.polish', {});
    assert.equal(top.ok, false);
    assert.equal(top.code, FEATURE_OFF);
    assert.equal(top.message, '"gear.polish" is part of Extras, which is turned off in the Features settings.');
    const tried = await host.sdk.command('gear.try', {});
    assert.equal(tried.ok, true);
    assert.deepEqual(tried.receipt.data, { code: FEATURE_OFF, extras: false, unknown: false });
    assert.equal(host.bus.run('capture.wear', { kind: 'wear', name: 'Axe' }, { cause: 'story' }).code, FEATURE_OFF);
    // Queries answer null, wherever they are asked.
    assert.equal(host.sdk.query('gear.look', { item: 'Sword' }), null);
    assert.equal(host.sdk.view().query('gear.look', { item: 'Sword' }), null);
    assert.deepEqual(host.sdk.query('gear.all'), { Sword: 'worn' }, 'a query of no feature still answers');

    // The next reply: no grammar or static part, no tail, no hook lines; a wear line is told quietly.
    const warned = [];
    const warn = console.warn;
    console.warn = (...args) => warned.push(args.join(' '));
    try {
        await host.send('Again.', 'Fine.\n<Changes>\n~ wear Shield | wear: broken\n+ gear Rope\n</Changes>');
    } finally { console.warn = warn; }
    const offStatic = statics(host).at(-1);
    assert.ok(!offStatic.includes(WEAR_GRAMMAR) && !offStatic.includes(WEAR_STATIC) && offStatic.includes(BASE_STATIC));
    const offTail = tails(host).at(-1);
    assert.ok(!offTail.includes('Sword is worn.') && !offTail.includes('Gear note: extras on.') && offTail.includes('Gear: 1 worn.'), offTail);
    const quiet = host.turn.problems('gear').filter(problem => problem.code === FEATURE_OFF);
    assert.deepEqual(quiet.map(problem => problem.message), ['"~ wear Shield | wear: broken" was not used: Wear is turned off (feature off).']);
    assert.equal(quiet[0].quiet, true);
    assert.equal(warned.filter(text => text.includes('Shield')).length, 0, 'not warned about');
    assert.deepEqual(refusedFrom(quiet, quiet[0].index), [], 'not a refused line on the card');
    assert.equal(host.head().domains.gear.wear.Shield, undefined);
    host.close();
});

test('an off feature\'s canGenerate hook does not hold the story back', async () => {
    const host = await createHost({ modules: [gear({ hooks: { block: true } })] });
    let out = await host.send('Wait?', 'Never.');
    assert.equal(out.aborted, true);
    host.features.set('gear.extras', false);
    out = await host.send('Now?', 'Yes.');
    assert.notEqual(out.aborted, true);
    host.close();
});

test('an off feature\'s state is kept as it was, and switching it back on brings it all back', async () => {
    const host = await createHost({ modules: [gear()] });
    await host.send('Hello.', 'Hi.\n<Changes>\n~ wear Sword | wear: worn\n</Changes>');
    assert.equal((await host.sdk.command('gear.polish', {})).ok, true);
    const before = structuredClone(host.head().domains.gear);
    host.features.set('gear.wear', false);
    host.features.set('gear.extras', false);
    await host.send('On we go.', 'More.\n<Changes>\n~ wear Sword | wear: broken\n</Changes>');
    await host.send('And on.', 'Still more.');
    assert.deepEqual(host.head().domains.gear, before, 'nothing of it changed while off');
    // Back on: the query, the command, the grammar and the lines are there again, on the same state.
    host.features.set('gear.wear', true);
    host.features.set('gear.extras', true);
    assert.deepEqual(host.sdk.query('gear.look', { item: 'Sword' }), { wear: 'worn' });
    assert.equal((await host.sdk.command('gear.polish', {})).ok, true);
    assert.equal(host.head().domains.gear.polished, 2);
    await host.send('Back.', 'Yes.\n<Changes>\n~ wear Sword | wear: broken\n</Changes>');
    assert.equal(host.head().domains.gear.wear.Sword, 'broken');
    assert.ok(statics(host).at(-1).includes(WEAR_GRAMMAR));
    assert.ok(tails(host).at(-1).includes('Sword is worn.'));
    host.close();
});

test('an off-by-default feature is off until the reader turns it on (a tail part)', async () => {
    const host = await createHost({ modules: [gear()] });
    await host.send('Hello.', 'Hi.');
    assert.ok(!tails(host).at(-1).includes(WEATHER_LINE));
    host.features.set('gear.weather', true);
    await host.send('Again.', 'Hi.');
    assert.ok(tails(host).at(-1).includes(WEATHER_LINE));
    host.close();
});
