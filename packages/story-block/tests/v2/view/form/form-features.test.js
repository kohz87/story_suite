import test from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry } from '../../../../src/v2/registry.js';
import { HOST_SETTINGS_SCHEMA, createSettings } from '../../../../src/v2/sdk.js';
import { changeNote, renderModuleForm, renderSettingsForm } from '../../../../src/v2/view/form/index.js';
import { UI_SAMPLE_FORM, mountDemoForm } from '../../../../src/v2/screens/ui-sample.js';
import { doc, setup, row, input, hasClass } from './form.helpers.js';

test('fold: with more than one group each group is a fold keyed by its name, the first open; the state is kept; openGroup opens one; a search opens the matches and gives the reader\'s choice back', () => {
    const state = new Map();
    const schema = { a: { type: 'int', label: 'One: A', min: 1, max: 9 }, b: { type: 'int', label: 'Two: B', min: 1, max: 9 }, c: { type: 'int', label: 'Three: C', min: 1, max: 9 } };
    const t = setup({ fold: { prefix: 'm::group:', state } }, schema, { a: 1, b: 2, c: 3 });
    const folds = () => t.parent.querySelectorAll('details.ss-section');
    assert.deepEqual(folds().map(node => node.dataset.fold), ['m::group:One', 'm::group:Two', 'm::group:Three']);
    assert.deepEqual(folds().map(node => node.open), [true, false, false]);
    assert.ok(folds().every(node => hasClass(node, 'ss-section-fold')));
    assert.deepEqual(folds().map(node => hasClass(node, 'ss-section-fold-open')), [true, false, false]);
    assert.deepEqual(t.form.groups().map(group => [group.name, group.key, group.fold, group.open]), [['One', 'm::group:One', true, true], ['Two', 'm::group:Two', true, false], ['Three', 'm::group:Three', true, false]]);
    assert.equal(t.form.openGroup('nothing'), null);
    assert.ok(t.form.openGroup('Three') === folds()[2]);
    assert.equal(folds()[2].open, true);
    assert.equal(state.get('m::group:Three'), true, 'the reader\'s choice is kept');
    // A toggle by the reader is kept too.
    folds()[0].open = false;
    folds()[0].dispatch('toggle');
    assert.equal(state.get('m::group:One'), false);
    // A search opens the groups with a match, hides the others, and the reader's own choice comes back.
    t.form.filter('B');
    assert.deepEqual(folds().map(node => node.hidden), [true, false, true]);
    assert.equal(folds()[1].open, true);
    t.form.filter('');
    assert.deepEqual(folds().map(node => node.open), [false, false, true]);
    // The state is read again by the next form: the first one no longer opens by itself once the reader closed it.
    const again = setup({ fold: { prefix: 'm::group:', state } }, schema, { a: 1, b: 2, c: 3 });
    assert.deepEqual(again.parent.querySelectorAll('details.ss-section').map(node => node.open), [false, false, true]);
    // One group alone is not a fold; without `fold` nothing is.
    assert.equal(setup({ fold: { prefix: 'x::' } }, { a: { type: 'int', label: 'A', min: 1, max: 9 } }, { a: 1 }).parent.querySelectorAll('details').length, 0);
    assert.equal(setup({}, schema, { a: 1, b: 2, c: 3 }).parent.querySelectorAll('details').length, 0);
});

test('disabled: the whole form can be switched off and on', () => {
    const t = setup({ disabled: true });
    assert.ok(hasClass(row(t, 'title'), 'ss-field-disabled'));
    assert.equal(input(t, 'title').disabled, true);
    assert.equal(input(t, 'strict').disabled, true);
    assert.ok(row(t, 'pace').querySelectorAll('.ss-chip').every(c => c.disabled));
    input(t, 'strict').click();
    assert.deepEqual(t.saved(), {});
    t.form.setDisabled(false);
    assert.equal(input(t, 'title').disabled, false);
    assert.equal(input(t, 'strict').disabled, false);
    assert.ok(!hasClass(row(t, 'title'), 'ss-field-disabled'));
    assert.equal(input(t, 'pack').readOnly, true, 'read-only stays read-only');
    input(t, 'strict').click();
    assert.equal(t.saved().strict, true);
});

test('features: a field of a feature that is off is not shown; refresh() brings it back when the feature is on', () => {
    let on = false;
    const t = setup({ featureOn: id => (id === 'demo.fancy' ? on : true) });
    assert.equal(row(t, 'fancy').hidden, true);
    assert.equal(row(t, 'title').hidden, false);
    on = true;
    t.form.refresh();
    assert.equal(row(t, 'fancy').hidden, false);
    // A featureOn that throws leaves the field shown.
    const bad = setup({ featureOn: () => { throw new Error('no'); } });
    assert.equal(bad.form.field('fancy').row.hidden, false);
});

test('search: filters rows by label, help, group and key; empty sections hide; the count is said (aria-live); a search that finds nothing says so', () => {
    const t = setup({ search: true });
    const status = t.parent.querySelector('.ss-form-status');
    assert.equal(status.getAttribute('role'), 'status');
    assert.equal(status.getAttribute('aria-live'), 'polite');
    assert.ok(status.hidden);
    const box = t.parent.querySelector('.ss-search-input');
    box.value = 'coin';
    box.dispatch('input');
    const shown = () => t.form.keys().filter(key => !row(t, key).hidden);
    assert.deepEqual(shown(), ['coins']);
    assert.equal(status.textContent, '1 setting shown');
    assert.deepEqual(t.parent.querySelectorAll('.ss-section').map(s => s.hidden), [true, false, true], 'sections with nothing shown are hidden');
    // By group name and by help.
    assert.equal(t.form.filter('calendar'), 2);
    assert.equal(status.textContent, '2 settings shown');
    assert.deepEqual(shown(), ['days', 'months']);
    assert.equal(t.form.filter('at most'), 1);
    assert.deepEqual(shown(), ['days']);
    // By the key.
    assert.deepEqual((t.form.filter('strict'), shown()), ['strict']);
    // Nothing.
    assert.equal(t.form.filter('dragon'), 0);
    const empty = t.parent.querySelector('.ss-form-empty');
    assert.ok(!empty.hidden);
    assert.equal(empty.textContent, 'No settings match "dragon".');
    // Cleared: all back, no message; the search box follows a filter set from outside.
    t.form.filter('');
    assert.equal(shown().length, t.form.keys().length);
    assert.ok(empty.hidden && status.hidden);
    t.form.filter('coin');
    assert.equal(box.value, 'coin');
    // Escape in the box clears the filter.
    box.dispatch('keydown', { key: 'Escape' });
    assert.equal(shown().length, t.form.keys().length);
    // A filter keeps the values and states of the rows it hides.
    input(t, 'title').value = 'abc';
    t.form.filter('title');
    input(t, 'title').dispatch('change');
    assert.equal(t.saved().title, 'abc');
});

test('the host\'s own schema (moduleId null): Panel style, Glass strength (a slider) and the rest write through the host settings', () => {
    const es = {};
    const settings = createSettings({ root: () => es, registry: { module: () => null }, save: () => {} });
    const parent = doc.createElement('div');
    doc.body.appendChild(parent);
    const form = renderSettingsForm(parent, { moduleId: null, schema: HOST_SETTINGS_SCHEMA, settings, doc });
    assert.equal(form.field('panelStyle').kind, 'select');
    assert.equal(form.field('glassStrength').kind, 'slider');
    assert.equal(form.field('callQueue').kind, 'switch');
    assert.equal(form.field('tailBudget').kind, 'number');
    const slider = form.field('glassStrength').handle.input;
    assert.deepEqual([slider.min, slider.max, slider.value], ['30', '90', '50']);
    slider.value = '70';
    slider.dispatch('change');
    assert.equal(es.storySuite.host.glassStrength, 70);
    form.field('panelStyle').handle.input.value = 'solid';
    form.field('panelStyle').handle.input.dispatch('change');
    assert.equal(es.storySuite.host.panelStyle, 'solid');
    const budget = form.field('tailBudget').handle.input;
    budget.value = '50';
    budget.dispatch('change');
    assert.equal(es.storySuite.host.tailBudget, 100, 'moved into its range by the store');
    assert.match(form.field('tailBudget').row.querySelector('.ss-field-error').textContent, /Set to 100, the least/);
});

test('renderModuleForm takes a registry entry (settingsDefs()); a store without set() is refused', () => {
    const registry = createRegistry();
    registry.register({ id: 'demo', name: 'Demo', version: '1.0.0', settings: { section: 'Demo settings', defaults: { on: true }, schema: { on: { type: 'bool', label: 'On' } } } });
    const es = {};
    const settings = createSettings({ root: () => es, registry, save: () => {} });
    const def = registry.settingsDefs()[0];
    const parent = doc.createElement('div');
    const form = renderModuleForm(parent, def, { settings, doc });
    assert.equal(parent.querySelector('.ss-form-title').textContent, 'Demo settings');
    assert.equal(parent.querySelector('.ss-form').getAttribute('data-module'), 'demo');
    assert.equal(form.field('on').handle.get(), true, 'the module\'s default');
    form.field('on').handle.input.click();
    assert.equal(settings('demo').on, false);
    assert.throws(() => renderSettingsForm(parent, { schema: {}, settings: () => ({}), doc }), /settings store/);
    form.destroy();
    assert.equal(parent.querySelector('.ss-form'), null);
});

test('the demo form of the UI sample draws one of each field and shows what the store holds', () => {
    const slot = doc.createElement('div');
    doc.body.appendChild(slot);
    const demo = mountDemoForm(doc, slot);
    assert.deepEqual(demo.form.keys().map(key => demo.form.field(key).kind), ['switch', 'number', 'text', 'text', 'chips', 'text', 'slider', 'select', 'lines', 'number', 'lines', 'profile']);
    assert.deepEqual(slot.querySelectorAll('.ss-form .ss-section-title').map(n => n.textContent), ['General', 'Money', 'Calendar', 'Assist']);
    assert.equal(slot.querySelector('.ss-sample-stored').textContent, 'Stored: {}');
    demo.form.field('strict').handle.input.click();
    assert.equal(slot.querySelector('.ss-sample-stored').textContent, 'Stored: {"strict":true}');
    // The several-of chips on their own.
    const chips = slot.querySelectorAll('.ss-chip').filter(c => c.getAttribute('aria-pressed') !== null);
    assert.equal(chips.length, UI_SAMPLE_FORM.chips.options.length);
    assert.equal(chips.filter(c => c.getAttribute('aria-pressed') === 'true').length, UI_SAMPLE_FORM.chips.value.length);
    // Profiles come from the sample's own list, never the page's.
    assert.deepEqual(demo.form.field('connection').handle.input.querySelectorAll('option').map(o => o.textContent), ['Same as chat', 'Flash Lite (cheap)', 'Main']);
    demo.destroy();
    assert.equal(slot.querySelector('.ss-form'), null);
});

// ---- step 3c: what the Money page needs of the engine

test('slider: a `format` says the value in words, `sliderMax` is the range offered and grows to a larger value, a function field follows the others', () => {
    const calls = [];
    const schema = { budget: { type: 'int', form: 'slider', min: 0, max: 1_000_000, sliderMax: 100, label: 'Budget', format: n => (n === 0 ? 'Automatic' : `${n} units`) } };
    const { form } = setup({}, schema, { budget: 60 });
    const slider = form.field('budget').handle.input;
    const out = form.field('budget').row.querySelector('.ss-slider-value');
    assert.equal(slider.max, '100', 'the offered range, not the store\'s');
    assert.equal(out.textContent, '60 units');
    assert.equal(slider.getAttribute('aria-valuetext'), '60 units');
    slider.value = '0';
    slider.dispatch('input');
    assert.equal(out.textContent, 'Automatic');
    // A stored value past the offered range: the range grows to it, the value is shown whole.
    form.field('budget').handle.set(5000);
    assert.equal(slider.max, '5000');
    assert.equal(slider.value, '5000');
    assert.equal(out.textContent, '5000 units');
    form.field('budget').handle.set(10);
    assert.equal(slider.max, '100');
    // A format that throws or says nothing falls back to the number and the unit.
    const plain = setup({}, { n: { type: 'int', form: 'slider', min: 0, max: 10, label: 'N', unit: ' coins', format: () => { throw new Error('x'); } } }, { n: 0 }).form;
    assert.equal(plain.field('n').row.querySelector('.ss-slider-value').textContent, '0 coins');
    assert.ok(calls.length === 0);
});

test('a field whose `format` reads other values follows them after any change (the budget\'s unit follows the coins)', () => {
    const schema = {
        word: { type: 'text', label: 'Word', max: 10 },
        n: { type: 'int', form: 'slider', min: 0, max: 100, label: 'N', format: n => `${n} ${registryValues().word}` },
    };
    let current = { word: 'penny' };
    const registryValues = () => current;
    const { form, settings } = setup({}, schema, { word: 'penny', n: 5 });
    assert.equal(form.field('n').row.querySelector('.ss-slider-value').textContent, '5 penny');
    current = { word: 'mark' };
    const box = form.field('word').handle.input;
    box.value = 'mark';
    box.dispatch('change');
    assert.equal(settings('m').word, 'mark');
    assert.equal(form.field('n').row.querySelector('.ss-slider-value').textContent, '5 mark');
});

test('a field\'s `check` says what the store cannot (a row the module will not use), after the value is stored, with the note of what the store moved', () => {
    const schema = { coins: { type: 'list', label: 'Coins', of: { name: { type: 'text', label: 'Name', max: 12 }, worth: { type: 'int', label: 'Worth', min: 1, max: 1000 } }, check: rows => (rows.some(row => !row.name) ? 'A coin has no name, so it is not used.' : '') } };
    const { form, settings } = setup({}, schema, { coins: [{ name: 'penny', worth: 1 }] });
    const coins = form.field('coins').row;
    coins.querySelector('.ss-lines-add').click();
    const error = coins.querySelector('.ss-field-error');
    assert.equal(error.textContent, 'A coin has no name, so it is not used.');
    assert.equal(settings('m').coins.length, 2, 'kept as typed');
    const name = coins.querySelectorAll('.ss-lines-row')[1].querySelector('.ss-lines-cell[data-field="name"] input');
    name.value = 'silver';
    name.dispatch('change');
    assert.equal(error.hidden, true);
    // A check that throws or answers a non-string says nothing.
    const bad = setup({}, { n: { type: 'int', label: 'N', check: () => { throw new Error('x'); } } }, { n: 1 }).form;
    const box = bad.field('n').handle.input;
    box.value = '2';
    box.dispatch('change');
    assert.equal(bad.field('n').row.querySelector('.ss-field-error').hidden, true);
});

test('a number in a list row that the box moved into its range, or refused, is named by row and field', () => {
    const schema = { coins: { type: 'list', label: 'Coins', of: { name: { type: 'text', label: 'Name', max: 12 }, worth: { type: 'int', label: 'Worth', min: 1, max: 1000 } } } };
    const { form, settings } = setup({}, schema, { coins: [{ name: 'penny', worth: 1 }, { name: 'gold', worth: 100 }] });
    const coins = form.field('coins').row;
    const worth = at => coins.querySelectorAll('.ss-lines-row')[at].querySelector('.ss-lines-cell[data-field="worth"] input');
    worth(1).value = '5000';
    worth(1).dispatch('change');
    assert.equal(settings('m').coins[1].worth, 1000);
    assert.equal(coins.querySelector('.ss-field-error').textContent, 'Row 2, Worth: Set to 1000, the most this allows.');
    worth(0).value = '0';
    worth(0).dispatch('change');
    assert.equal(coins.querySelector('.ss-field-error').textContent, 'Row 1, Worth: Set to 1, the least this allows.');
    worth(0).value = 'lots';
    worth(0).dispatch('change');
    assert.equal(coins.querySelector('.ss-field-error').textContent, 'Row 1, Worth: Enter a whole number. The setting stays 1.');
    worth(0).value = '3';
    worth(0).dispatch('change');
    assert.equal(coins.querySelector('.ss-field-error').hidden, true, 'a plain change says nothing');
});

test('changeNote on a list: rows the store left out, else the first row\'s field it moved', () => {
    const field = { type: 'list', of: { name: { type: 'text', label: 'Name', max: 4 }, worth: { type: 'int', label: 'Worth', min: 1, max: 9 } } };
    assert.equal(changeNote(field, [{ name: 'a', worth: 1 }], [{ name: 'a', worth: 1 }]), '');
    assert.equal(changeNote(field, [{ name: 'abcdefg', worth: 1 }], [{ name: 'abcd', worth: 1 }]), 'Row 1, Name: Cut to 4 characters, the most this allows.');
    assert.equal(changeNote(field, [{ worth: 1 }, { worth: 50 }], [{ worth: 1 }, { worth: 9 }]), 'Row 2, Worth: Set to 9, the most this allows.');
    assert.equal(changeNote(field, [{}, {}, {}], [{}]), 'Only 1 of the 3 rows could be kept.');
    assert.equal(changeNote(field, 'x', []), '');
});

test('`quiet` leaves the search count and the empty message to a window around the form; `className` adds a class', () => {
    const { form, parent } = setup({ search: false, className: 'ss-money', quiet: true });
    assert.ok(form.el.classList.contains('ss-form') && form.el.classList.contains('ss-money'));
    assert.equal(form.filter('title') > 0, true, 'the count is still returned');
    assert.equal(form.el.querySelector('.ss-form-status').hidden, true);
    assert.equal(form.filter('zzzz'), 0);
    assert.equal(form.el.querySelector('.ss-form-empty').hidden, true);
    assert.equal(parent.querySelectorAll('.ss-form-status').filter(node => !node.hidden).length, 0);
    const loud = setup({ search: false });
    loud.form.filter('zzzz');
    assert.equal(loud.form.el.querySelector('.ss-form-empty').hidden, false, 'without it the form says so itself');
});
