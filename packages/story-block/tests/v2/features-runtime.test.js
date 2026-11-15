import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { createRegistry, definitionProblems, definitionWarnings } from '../../src/v2/registry.js';
import { CORE_FEATURE, createFeatureStore } from '../../src/v2/features.js';
import { gear, statics } from './features.helpers.js';

// ---------------------------------------------------------------------------------------------------
// The static prompt part

test('the static part is byte-identical reply after reply, and a toggle changes it exactly once', async () => {
    const host = await createHost({ modules: [gear()] });
    const lines = ['~ wear Sword | wear: worn', '+ item Rope | qty: 1', '~ wear Axe | wear: broken', '+ coin 5 | from: a merchant'];
    for (const [n, line] of lines.entries()) await host.send(`Turn ${n}.`, `Reply ${n}.\n<Changes>\n${line}\n</Changes>`);
    const first = statics(host);
    assert.equal(first.length, lines.length);
    assert.equal(new Set(first).size, 1, 'one text for every reply, whatever the state');

    // A feature that does not touch the static part: turned on and off, the text stays the same bytes.
    host.features.set('gear.weather', true);
    host.features.set('gear.extras', false);
    await host.send('Weather?', 'Rain.');
    assert.equal(statics(host).at(-1), first[0]);

    // One that does: the next reply has a new text, and every reply after it the same new text.
    host.features.set('gear.wear', false);
    for (let n = 0; n < 3; n += 1) await host.send(`Off ${n}.`, `Off reply ${n}.\n<Changes>\n+ item Stone | qty: 1\n</Changes>`);
    const all = statics(host);
    const changes = all.filter((text, i) => i > 0 && text !== all[i - 1]).length;
    assert.equal(changes, 1, 'changed exactly once');
    assert.notEqual(all.at(-1), first[0]);
    assert.equal(new Set(all.slice(-3)).size, 1);

    // Setting a feature to the value it has changes nothing; turning it back on gives the old bytes.
    host.features.set('gear.wear', false);
    host.features.set('gear.wear', true);
    await host.send('On.', 'On again.');
    assert.equal(statics(host).at(-1), first[0]);
    // The overlay's hint is shown for this feature only.
    // (and Story Block's loot, weather and RPG, whose capture kinds are grammar lines: the RPG's is the `+ party` line)
    assert.deepEqual(host.features.list().filter(feature => feature.prompt).map(feature => feature.id), ['gear.wear', 'story-block.choices', 'story-block.chatter', 'story-block.weather', 'story-block.you', 'story-block.mounts', 'story-block.rpg', 'story-block.loot']);
    host.close();
});

// ---------------------------------------------------------------------------------------------------
// Unknown ids, storage, the change event

test('unknown feature ids: off everywhere, cannot be set, and a stored choice for one is kept', async () => {
    const host = await createHost({ modules: [gear()], settings: { features: { 'gone.module': false, 'gear.weather': true } } });
    assert.equal(host.sdk.feature('nope.thing'), false);
    assert.equal(host.sdk.feature(undefined), false);
    assert.equal(host.sdk.view().feature('nope.thing'), false);
    assert.equal(host.registry.featureOn('gear'), false);
    assert.equal(host.features.set('nope.thing', true), undefined);
    assert.equal(Object.hasOwn(host.ctx.extensionSettings.storySuite.features, 'nope.thing'), false);
    assert.equal(host.ctx.extensionSettings.storySuite.features['gone.module'], false, 'kept for when it comes back');
    assert.equal(host.sdk.feature('gear.weather'), true, 'the stored choice beats the default');
    // A value that is not true or false is no choice: the default holds.
    host.ctx.extensionSettings.storySuite.features['gear.wear'] = 'off';
    assert.equal(host.sdk.feature('gear.wear'), true);
    host.close();
});

test('choices are the reader\'s (extension settings, saved), told by the `feature` event, and listed by the sdk', async () => {
    const host = await createHost({ modules: [gear()] });
    const seen = [];
    host.sdk.on('feature', change => seen.push(change));
    const saves = host.st.settingsSaves;
    host.features.set('gear.wear', false);
    host.features.set('gear.wear', false);   // no change: no event
    host.features.set('gear.extras', false);
    assert.deepEqual(seen, [{ id: 'gear.wear', on: false, prompt: true }, { id: 'gear.extras', on: false, prompt: false }]);
    assert.ok(host.st.settingsSaves > saves);
    assert.deepEqual(host.ctx.extensionSettings.storySuite.features, { 'gear.wear': false, 'gear.extras': false });
    assert.deepEqual(host.sdk.features().filter(feature => feature.moduleId === 'gear').map(feature => [feature.id, feature.on]), [
        ['gear.wear', false], ['gear.weather', false], ['gear.extras', false],
    ]);
    assert.deepEqual(host.sdk.modules().find(module => module.id === 'gear').features, ['gear.wear', 'gear.weather', 'gear.extras']);
    host.close();
});

test('the feature store works on its own over any settings root', () => {
    const registry = createRegistry({ featureValue: id => store.stored(id) });
    const root = {};
    const store = createFeatureStore({ root: () => root, registry });
    registry.register(gear());
    assert.equal(store.on('gear.weather'), false);
    assert.equal(store.set('gear.weather', 1), true);
    assert.equal(root.storySuite.features['gear.weather'], true);
    assert.equal(createFeatureStore({ root: () => null, registry }).stored('gear.weather'), undefined);
});

// ---------------------------------------------------------------------------------------------------
// Story Block's own features

// A module that keeps `? check` lines, so the pre-roll has something to roll for.
const CHECKS = { id: 'checks', capture: { kinds: { check: { grammar: '? check skill — what | dc: normal' } }, apply: () => ({ summary: 'checked', narrate: false }) } };

test('needs: a feature is unavailable (off, its choice kept) until a module registers what it needs', async () => {
    const host = await createHost({ settings: { features: { [CORE_FEATURE.preroll]: true } } });
    assert.equal(host.sdk.feature(CORE_FEATURE.preroll), false, 'off without a module that keeps checks');
    const [preroll] = host.sdk.features().filter(feature => feature.id === CORE_FEATURE.preroll);
    assert.equal(preroll.available, false);
    assert.equal(preroll.why, 'Needs a module that keeps checks, like Story Director.');
    assert.equal(host.sdk.query('assist.status').classifier.on, false);
    await host.sdk.registerModule(CHECKS);
    assert.equal(host.sdk.feature(CORE_FEATURE.preroll), true, 'the reader\'s choice, kept, now counts');
    assert.equal(host.sdk.features().find(feature => feature.id === CORE_FEATURE.preroll).why, '');
    // Commands and queries can be needed too; a wrong `needs` is refused, an unknown key in it warned.
    const registry = createRegistry({ warn: () => {} });
    registry.register({ id: 'n', features: [{ id: 'n.a', label: 'A', needs: { commands: ['x.go'], queries: ['x.q'] } }] });
    assert.equal(registry.featureOn('n.a'), false);
    registry.register({ id: 'x', commands: { 'x.go': () => ({}) }, queries: { 'x.q': () => 1 } });
    assert.equal(registry.featureOn('n.a'), true);
    assert.ok(definitionProblems({ id: 'm', features: [{ id: 'm.a', label: 'A', needs: { kinds: 'check' } }] }).some(p => /needs\.kinds is not a list of names/.test(p)));
    assert.ok(definitionProblems({ id: 'm', features: [{ id: 'm.a', label: 'A', needs: { why: 'x'.repeat(121) } }] }).some(p => /needs\.why is not text of at most 120/.test(p)));
    assert.deepEqual(definitionWarnings({ id: 'm', features: [{ id: 'm.a', label: 'A', needs: { modules: ['x'] } }] }), ['"needs.modules" on feature "m.a" is not a needs field this Story Block knows; it is ignored']);
    host.close();
});

test('Story Block\'s own features: the status strip, the cards, the two assist helpers, the inspector and save points', async () => {
    const host = await createHost();
    assert.deepEqual(host.sdk.features().map(feature => [feature.id, feature.on, feature.prompt, feature.available]), [
        [CORE_FEATURE.hud, true, false, true], [CORE_FEATURE.cards, true, false, true], [CORE_FEATURE.preroll, false, false, false], [CORE_FEATURE.extractor, false, false, true],
        [CORE_FEATURE.inspector, false, false, true], [CORE_FEATURE.savepoints, true, false, true],
        [CORE_FEATURE.choices, false, true, true], [CORE_FEATURE.chatter, false, true, true], [CORE_FEATURE.weather, true, true, true], [CORE_FEATURE.you, true, true, true], [CORE_FEATURE.mounts, true, true, true], [CORE_FEATURE.leanRpg, false, true, true], [CORE_FEATURE.fightBoard, true, false, true],
        ['story-block.loot', true, true, true], ['story-block.encumbrance', true, false, true], ['story-block.gear', false, false, true],
    ]);
    host.close();
    // The switches older versions kept are the choice until the reader touches the feature. (The
    // pre-roll needs a module that keeps checks.)
    const old = await createHost({ modules: [CHECKS], settings: { hud: false, modules: { 'story-block': { assistClassifier: true, assistExtractor: true } } } });
    assert.equal(old.sdk.feature(CORE_FEATURE.hud), false);
    assert.equal(old.sdk.feature(CORE_FEATURE.preroll), true);
    assert.equal(old.sdk.feature(CORE_FEATURE.extractor), true);
    old.features.set(CORE_FEATURE.extractor, false);
    assert.equal(old.sdk.feature(CORE_FEATURE.extractor), false);
    assert.equal(old.sdk.query('assist.status').extractor.on, false, 'the helper follows the feature');
    assert.equal(old.sdk.query('assist.status').classifier.on, true);
    old.close();
});

test('the extractor runs only while its feature is on', async () => {
    const calls = [];
    const callModel = async prompt => { calls.push(prompt); return '+ item Rope | qty: 1'; };
    const host = await createHost({ callModel });
    await host.send('hi', 'You find a rope.');
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(calls.length, 0, 'off by default');
    host.features.set(CORE_FEATURE.extractor, true);
    await host.send('more', 'You find another rope.');
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(calls.length, 1);
    host.close();
});

// ---------------------------------------------------------------------------------------------------
// A module's header toggle (MODULES F131)

const pillModule = (extra = {}) => ({
    id: 'quiet', name: 'Quiet', version: '0.0.1',
    features: [{ id: 'quiet.switch', label: 'Quiet switch', describe: 'A toggle.' }],
    headerControls: [{ id: 'scene', label: 'Quiet scene', icon: '🌙', query: 'quiet.on', command: 'quiet.set', feature: 'quiet.switch', ...extra }],
});

test('header controls: one toggle per module, checked, listed with its module and left out while its feature is off', () => {
    assert.deepEqual(definitionProblems(pillModule()), []);
    assert.deepEqual(definitionWarnings(pillModule()), []);
    const registry = createRegistry();
    registry.register(pillModule());
    assert.deepEqual(registry.headerControls(), [{ moduleId: 'quiet', key: 'quiet/scene', id: 'scene', label: 'Quiet scene', icon: '🌙', query: 'quiet.on', command: 'quiet.set', args: {}, payload: {} }]);
    const off = createRegistry({ featureValue: id => (id === 'quiet.switch' ? false : undefined) });
    off.register(pillModule());
    assert.deepEqual(off.headerControls(), [], 'a feature that is off draws no pill');
    const cases = [
        [{ headerControls: {} }, /headerControls is not a list/],
        [{ headerControls: [pillModule().headerControls[0], { ...pillModule().headerControls[0], id: 'two' }] }, /one header control, not several/],
        [{ headerControls: ['x'] }, /header control is not an object/],
        [{ headerControls: [{ ...pillModule().headerControls[0], id: 'Bad Id' }] }, /no usable id/],
        [{ headerControls: [{ ...pillModule().headerControls[0], label: '' }] }, /no label/],
        [{ headerControls: [{ ...pillModule().headerControls[0], icon: undefined }] }, /no icon/],
        [{ headerControls: [{ ...pillModule().headerControls[0], query: '' }] }, /no query/],
        [{ headerControls: [{ ...pillModule().headerControls[0], command: 3 }] }, /no command/],
        [{ headerControls: [{ ...pillModule().headerControls[0], payload: [] }] }, /payload is not an object/],
        [{ headerControls: [{ ...pillModule().headerControls[0], feature: 'quiet.nope' }] }, /quiet\.nope/],
    ];
    for (const [patch, pattern] of cases) {
        const problems = definitionProblems({ ...pillModule(), ...patch });
        assert.ok(problems.some(problem => pattern.test(problem)), `${JSON.stringify(patch).slice(0, 60)}: ${problems.join(' | ')}`);
    }
});
