// Features in the page (MODULES §F100): the settings overlay's Features (one fold with a filter and a
// sub-fold per module, a line in each module's fold going there, the prompt hint).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { setupDom } from '../ui/view/mounts/helpers.js';
import { FEATURES_FOLD, FEATURE_TEXT, PACKS_FOLD, VERSIONS_FOLD, featureInputId, featuresFoldOf, renderSettingsHost } from '../../ui/legacy/host-ui.js';
import { openSettingsWindow as openSettingsOverlay } from '../../ui/legacy/view/settings/window.js';
import { CORE_FEATURE, PROMPT_HINT } from '../../core/features.js';
import { countOn, foldOf, loot, overlay, plain, rowsOf, subOf, subsOf, texts } from './features-ui.helpers.js';

test('the overlay: Features has a sub-fold per module ("N of M on"); a module\'s fold has one line going there, no switches', async () => {
    const { root, host } = await overlay();
    const folds = root.querySelectorAll('details.story-suite-fold').map(node => node.dataset.fold);
    assert.deepEqual(folds, [PACKS_FOLD, FEATURES_FOLD, 'plain', 'story-block', 'story-suite-versions'], 'Packs, Features, then the modules with settings by id (Loot has only features: no fold of its own), then Versions');
    const overview = foldOf(root, FEATURES_FOLD);
    assert.equal(overview.querySelector('summary b').textContent, FEATURE_TEXT.title);
    assert.deepEqual(subsOf(overview).map(node => node.dataset.fold), [featuresFoldOf('loot'), featuresFoldOf('story-block')]);
    assert.deepEqual(subsOf(overview).map(node => node.querySelector('summary b').textContent), ['Loot', 'Story Block']);
    const sb = countOn(host, 'story-block');
    assert.deepEqual(subsOf(overview).map(node => node.querySelector('summary small').textContent), ['1 of 2 on', `${sb.on} of ${sb.n} on`]);
    assert.deepEqual(subsOf(overview).map(node => node.open), [false, false], 'several modules: closed until opened');
    assert.deepEqual(rowsOf(overview).map(row => row.dataset.feature), ['loot.picker', 'loot.weight', ...host.registry.features().filter(f => f.moduleId === 'story-block').map(f => f.id)]);
    const [picker, weight] = rowsOf(subOf(root, 'loot'));
    assert.equal(picker.querySelector('b').textContent, 'Loot picker');
    assert.deepEqual(texts(picker, 'small'), ['Pick what to keep after a fight.']);
    assert.equal(picker.querySelector('input').checked, true);
    assert.equal(picker.querySelector('input').getAttribute('role'), 'switch');
    // A feature that changes the static prompt says so.
    assert.deepEqual(texts(weight, 'small'), ['Items weigh something.', PROMPT_HINT]);
    assert.equal(PROMPT_HINT, 'Changes the fixed prompt once (one slower reply).');
    assert.equal(weight.querySelector('input').checked, false);
    assert.deepEqual(texts(subOf(root, 'story-block'), '.story-suite-feature > span > b'), ['Status strip', 'Cards under replies', 'Roll checks before the reply', 'Safety net: read changes the reply forgot', 'State inspector', 'Save points', 'Choices', 'Inner chatter', 'Weather', 'Your look', 'Mounts', 'RPG', 'Fight board', 'Pick what you take', 'Encumbered', 'Gear in fights']);
    // A module's fold: no switches, one line saying how many are on; it opens Features at that module.
    const sbFold = foldOf(root, 'story-block');
    assert.equal(sbFold.querySelector('.story-suite-feature'), null);
    assert.equal(sbFold.querySelector('.story-suite-features'), null);
    assert.ok(!subsOf(sbFold).some(node => node.querySelector('summary b').textContent === FEATURE_TEXT.title), 'no Features sub-fold in it');
    const link = sbFold.querySelector('.story-suite-fold-body > .story-suite-feature-line > .story-suite-feature-link');
    assert.equal(link.tagName, 'BUTTON');
    assert.equal(link.type, 'button');
    assert.equal(link.textContent, `Features: ${sb.on} of ${sb.n} on — change`);
    assert.equal(link.getAttribute('aria-label'), `Features of Story Block: ${sb.on} of ${sb.n} on. Change them in the Features fold.`);
    assert.equal(sbFold.querySelector('.story-suite-fold-body').children[0].className, 'story-suite-feature-line', 'first in the fold');
    // No features, no line.
    assert.equal(foldOf(root, 'plain').querySelector('.story-suite-feature-line'), null);
    link.click();
    assert.equal(overview.open, true);
    assert.equal(subOf(root, 'story-block').open, true);
    assert.ok(root.ownerDocument.activeElement === subOf(root, 'story-block').querySelector('summary'), 'the focus on that module\'s sub-fold');
    host.close();
});

test('the overlay: a switch stores the reader\'s choice; the module\'s line and the sub-fold\'s count follow it', async () => {
    const { root, host, view } = await overlay({ modules: [loot(), plain(), { ...plain(), id: 'plain2', name: 'Plain two', features: [{ id: 'plain2.x', label: 'X' }] }] });
    // A switch redraws the overlay, so the rows are looked up again after each change.
    const input = () => rowsOf(subOf(root, 'loot')).find(row => row.dataset.feature === 'loot.weight').querySelector('input');
    input().checked = true;
    input().dispatch('change');
    assert.equal(host.sdk.feature('loot.weight'), true);
    assert.equal(host.ctx.extensionSettings.storySuite.features['loot.weight'], true);
    assert.equal(input().checked, true);
    assert.equal(input().getAttribute('aria-checked'), 'true');
    assert.equal(subOf(root, 'loot').querySelector('summary small').textContent, '2 of 2 on');
    assert.equal(foldOf(root, 'plain2').querySelector('.story-suite-feature-link').textContent, 'Features: 1 of 1 on — change');
    rowsOf(subOf(root, 'plain2'))[0].querySelector('input').checked = false;
    rowsOf(subOf(root, 'plain2'))[0].querySelector('input').dispatch('change');
    assert.equal(foldOf(root, 'plain2').querySelector('.story-suite-feature-link').textContent, 'Features: 0 of 1 on — change');
    input().checked = false;
    input().dispatch('change');
    assert.equal(host.sdk.feature('loot.weight'), false);
    // A redraw shows what is stored, and keeps the open folds open.
    subOf(root, 'loot').open = true;
    view.refresh();
    assert.equal(subOf(root, 'loot').open, true);
    assert.equal(input().checked, false);
    host.close();
});

test('the overlay: the sub-folds go by module name, A to Z, whatever the ids', async () => {
    const zed = { id: 'aaa-zed', name: 'Zed', features: [{ id: 'aaa-zed.one', label: 'One' }] };
    const able = { id: 'zzz-able', name: 'able', features: [{ id: 'zzz-able.one', label: 'One' }] };
    const { root, host } = await overlay({ modules: [zed, loot(), able] });
    assert.deepEqual(subsOf(foldOf(root, FEATURES_FOLD)).map(node => node.querySelector('summary b').textContent), ['able', 'Loot', 'Story Block', 'Zed']);
    host.close();
});

test('the overlay: the filter finds features by name or description across modules, and keeps the folds as they were', async () => {
    const { root, host } = await overlay();
    const box = () => foldOf(root, FEATURES_FOLD).querySelector('.story-suite-feature-filter input');
    const shown = () => rowsOf(foldOf(root, FEATURES_FOLD)).filter(row => !row.hidden).map(row => row.dataset.feature);
    const type = text => { box().value = text; box().dispatch('input'); };
    // Labelled, the first thing after the help line.
    const label = foldOf(root, FEATURES_FOLD).querySelector('.story-suite-feature-filter');
    assert.equal(label.tagName, 'LABEL');
    assert.equal(label.getAttribute('for'), box().id);
    assert.equal(label.querySelector('b').textContent, 'Find a feature');
    assert.equal(box().type, 'search');
    subOf(root, 'story-block').open = true;
    type('WEIGH');
    assert.deepEqual(shown(), ['loot.weight'], 'by name, any case');
    assert.equal(subOf(root, 'story-block').hidden, true, 'a module with no match is hidden');
    assert.equal(subOf(root, 'loot').hidden, false);
    assert.equal(subOf(root, 'loot').open, true, 'one with a match opens');
    type('after a fight');
    assert.deepEqual(shown(), ['loot.picker'], 'by description');
    type('strip');
    assert.deepEqual(shown(), [CORE_FEATURE.hud], 'across modules');
    assert.equal(subOf(root, 'loot').hidden, true);
    // Kept across a redraw (a switch redraws everything).
    rowsOf(subOf(root, 'story-block')).find(row => row.dataset.feature === CORE_FEATURE.hud).querySelector('input').checked = false;
    rowsOf(subOf(root, 'story-block')).find(row => row.dataset.feature === CORE_FEATURE.hud).querySelector('input').dispatch('change');
    assert.equal(box().value, 'strip');
    assert.deepEqual(shown(), [CORE_FEATURE.hud]);
    type('nothing like this');
    assert.deepEqual(shown(), []);
    assert.equal(foldOf(root, FEATURES_FOLD).querySelector('.story-suite-feature-none').textContent, 'No feature matches "nothing like this".');
    assert.equal(foldOf(root, FEATURES_FOLD).querySelector('.story-suite-feature-none').hidden, false);
    // Cleared: every row back, each sub-fold open or closed as the reader left it.
    type('');
    assert.equal(shown().length, host.features.list().length);
    assert.deepEqual([subOf(root, 'loot').open, subOf(root, 'story-block').open], [false, true]);
    assert.equal(foldOf(root, FEATURES_FOLD).querySelector('.story-suite-feature-none').hidden, true);
    // A module's line clears a filter that hides its module.
    type('weigh');
    foldOf(root, 'story-block').querySelector('.story-suite-feature-link').click();
    assert.equal(box().value, '');
    assert.equal(subOf(root, 'story-block').hidden, false);
    assert.equal(subOf(root, 'story-block').open, true);
    host.close();
});

test('the settings window opened at a module\'s old "<id>::features" shows the Features page with that module\'s group focused', async () => {
    const doc = setupDom();
    const host = await createHost({ modules: [loot(), plain()] });
    const overlayApi = openSettingsOverlay({ registry: host.registry, settings: host.settings, features: host.features, doc, openState: new Map(), fold: 'loot::features' });
    assert.equal(overlayApi.section(), 'features');
    const group = overlayApi.root.querySelectorAll('.ss-features-group').find(node => node.dataset.fold === featuresFoldOf('loot'));
    assert.ok(group, 'Loot\'s group of tiles');
    assert.ok(doc.activeElement === group.querySelector('summary'), 'the group\'s summary has the focus');
    assert.equal(group.open, true, 'the group the fold names is open');
    overlayApi.close();
    host.close();
});

test('the overlay without a feature store shows no Features (an older caller)', async () => {
    const doc = setupDom();
    const host = await createHost({ modules: [loot(), plain()] });
    const root = doc.createElement('div');
    renderSettingsHost(root, { registry: host.registry, settings: host.settings, doc });
    assert.equal(root.querySelector('.story-suite-feature'), null);
    assert.deepEqual(root.querySelectorAll('details.story-suite-fold').map(node => node.dataset.fold), [PACKS_FOLD, 'plain', 'story-block', 'story-suite-versions']);
    host.close();
});

test('the overlay: each switch has an id of its own (place + the whole feature id), and its row labels it', async () => {
    const { root, host } = await overlay();
    const rows = root.querySelectorAll('.story-suite-feature');
    const ids = rows.map(row => row.querySelector('input').id);
    assert.equal(new Set(ids).size, ids.length);
    for (const row of rows) assert.equal(row.getAttribute('for'), row.querySelector('input').id);
    assert.equal(featureInputId('overview', 'a.b_c') === featureInputId('overview', 'a.b.c'), false);
    assert.ok(ids.includes(featureInputId('overview', 'loot.weight')));
    assert.ok(!ids.some(id => id.includes('_module_')), 'drawn once, in the Features fold');
    host.close();
});

test('the overlay: a settings field or panel of a feature that is off is not drawn, its value kept; a switch redraws at once', async () => {
    const doc = setupDom();
    const panel = Object.assign(el => { el.textContent = 'Digest panel'; }, { feature: 'dig.digest' });
    const dig = {
        id: 'dig', name: 'Dig',
        features: [{ id: 'dig.digest', label: 'Digest' }],
        settings: {
            defaults: { keep: 3, colour: 'red' },
            schema: { keep: { type: 'int', label: 'Digest: days kept', min: 1, max: 9, feature: 'dig.digest' }, colour: { type: 'text', label: 'Colour' } },
            section: panel,
        },
    };
    const host = await createHost({ modules: [dig] });
    host.settings.set('dig', 'keep', 5);
    const root = doc.createElement('div');
    doc.body.appendChild(root);
    renderSettingsHost(root, { registry: host.registry, settings: host.settings, features: host.features, doc, sdk: host.sdk });
    assert.ok(root.textContent.includes('days kept') && root.textContent.includes('Digest panel'));
    foldOf(root, 'dig').open = true;
    const input = rowsOf(subOf(root, 'dig'))[0].querySelector('input');
    input.checked = false;
    input.dispatch('change');
    assert.ok(!root.textContent.includes('days kept') && !root.textContent.includes('Digest panel'), 'gone at once');
    assert.ok(root.textContent.includes('Colour'));
    assert.equal(foldOf(root, 'dig').open, true, 'the fold stays open');
    assert.equal(host.settings('dig').keep, 5, 'the value is kept');
    rowsOf(subOf(root, 'dig'))[0].querySelector('input').checked = true;
    rowsOf(subOf(root, 'dig'))[0].querySelector('input').dispatch('change');
    assert.ok(root.textContent.includes('days kept'));
    // A field naming a feature the module does not have is refused like any other `feature`.
    assert.throws(() => host.registry.register({ id: 'odd', settings: { schema: { x: { type: 'bool', feature: 'odd.nope' } } } }), /the settings field "x" names the feature "odd\.nope"/);
    host.close();
});

test('the overlay: a feature whose needs are not met is drawn off and disabled, with its reason', async () => {
    const { root, host } = await overlay({ settings: { features: { [CORE_FEATURE.preroll]: true } } });
    const rows = root.querySelectorAll('.story-suite-feature').filter(row => row.dataset.feature === CORE_FEATURE.preroll);
    assert.equal(rows.length, 1, 'drawn once, in the Features fold');
    for (const row of rows) {
        const input = row.querySelector('input');
        assert.equal(input.disabled, true);
        assert.equal(input.checked, false);
        assert.ok(texts(row, 'small').includes('Needs a module that keeps checks, like Story Director.'));
    }
    host.close();
});

test('the overlay: a feature switch redraws everything, the Versions fold included', async () => {
    const { root, host } = await overlay();
    assert.ok(foldOf(root, VERSIONS_FOLD), 'drawn');
    foldOf(root, VERSIONS_FOLD).open = true;
    const input = rowsOf(subOf(root, 'loot'))[1].querySelector('input');
    input.checked = true;
    input.dispatch('change');
    assert.ok(foldOf(root, VERSIONS_FOLD), 'still there after the redraw');
    assert.equal(foldOf(root, VERSIONS_FOLD).open, true, 'and still open');
    assert.equal(root.querySelectorAll('details.story-suite-fold').at(-1).dataset.fold, VERSIONS_FOLD, 'last, where #105 put it');
    host.close();
});
