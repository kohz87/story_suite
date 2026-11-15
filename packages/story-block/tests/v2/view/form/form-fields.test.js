import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSettingsForm } from '../../../../src/v2/view/form/index.js';
import { groupFields, rowValue, fieldReadOnly } from '../../../../src/v2/host-ui.js';
import { doc, SCHEMA, setup, row, input, hasClass } from './form.helpers.js';

test('every field of a known type is drawn in its group; one the engine does not know is not, and its value is left alone', () => {
    const t = setup();
    assert.deepEqual(t.form.keys(), ['strict', 'harder', 'title', 'notes', 'pace', 'prices', 'connection', 'pack', 'fancy', 'budget', 'coins', 'days', 'months']);
    assert.equal(t.form.field('ghost'), undefined);
    assert.deepEqual(t.parent.querySelectorAll('.ss-section-title').map(n => n.textContent), ['General', 'Money', 'Calendar'], 'the groups of the overlay: General, then "Group: " prefixes');
    assert.deepEqual(t.parent.querySelectorAll('.ss-section').map(s => s.querySelectorAll('.ss-field').length), [9, 2, 2]);
    assert.deepEqual(['strict', 'harder', 'title', 'notes', 'pace', 'prices', 'budget', 'coins', 'days', 'months', 'connection', 'pack'].map(key => t.form.field(key).kind), ['switch', 'number', 'text', 'text', 'chips', 'select', 'slider', 'lines', 'number', 'lines', 'profile', 'text']);
    assert.deepEqual(groupFields(SCHEMA).map(g => g.name), ['General', 'Money', 'Calendar'], 'the same grouping function as the overlay');
    // Labels lose their "Group: " prefix, as in the overlay.
    assert.equal(row(t, 'budget').querySelector('.ss-field-label').textContent, 'Budget');
    // One group alone has no heading of its own.
    const single = setup({}, { a: { type: 'bool', label: 'A' }, b: { type: 'bool', label: 'B' } });
    assert.ok(single.parent.querySelector('.ss-section-head').hidden);
    // Defaults show; the store is untouched by drawing.
    assert.equal(input(t, 'title').value, 'Lowmere');
    assert.equal(input(t, 'budget').value, '60');
    assert.deepEqual(t.saved(), {});
});

test('values round-trip to the settings store: each control writes what the store keeps and shows it back', () => {
    const t = setup();
    // switch
    input(t, 'strict').click();
    assert.equal(t.saved().strict, true);
    // text, cut by the store at its max
    input(t, 'title').value = 'The Lowmere Reaches';
    input(t, 'title').dispatch('change');
    assert.equal(t.saved().title, 'The Lowm');
    assert.equal(input(t, 'title').value, 'The Lowm');
    // number
    input(t, 'days').value = '9';
    input(t, 'days').dispatch('change');
    assert.equal(t.saved().days, 9);
    // slider
    input(t, 'budget').value = '120';
    input(t, 'budget').dispatch('input');
    assert.equal(t.saved().budget, undefined, 'not while dragging');
    input(t, 'budget').dispatch('change');
    assert.equal(t.saved().budget, 120);
    // select and chips
    input(t, 'prices').value = 'flat';
    input(t, 'prices').dispatch('change');
    assert.equal(t.saved().prices, 'flat');
    row(t, 'pace').querySelectorAll('.ss-chip')[2].click();
    assert.equal(t.saved().pace, 'fast');
    // profile
    input(t, 'connection').value = 'Main';
    input(t, 'connection').dispatch('change');
    assert.equal(t.saved().connection, 'Main');
    // the whole of a list, rows
    row(t, 'coins').querySelector('.ss-lines-add').click();
    const fresh = row(t, 'coins').querySelectorAll('.ss-lines-row')[1].querySelectorAll('input');
    fresh[0].value = 'silver';
    fresh[0].dispatch('change');
    fresh[1].value = '10';
    fresh[1].dispatch('change');
    assert.deepEqual(t.saved().coins, [{ name: 'penny', worth: 1 }, { name: 'silver', worth: 10 }]);
    // a list as lines
    const area = row(t, 'months').querySelector('.ss-lines-text');
    area.value = 'Frostmoon: 30\nSeedmoon: 31';
    area.dispatch('change');
    assert.deepEqual(t.saved().months, [{ name: 'Frostmoon', days: 30 }, { name: 'Seedmoon', days: 31 }]);
    // The same store, the same values: a second form over it shows what the first wrote, and onChange saw each.
    const again = renderSettingsForm(t.parent, { moduleId: 'm', schema: SCHEMA, settings: t.settings, doc });
    assert.equal(again.field('title').handle.input.value, 'The Lowm');
    assert.equal(again.field('budget').handle.input.value, '120');
    assert.equal(again.field('prices').handle.input.value, 'flat');
    assert.equal(again.field('coins').row.querySelectorAll('.ss-lines-row').length, 2);
    assert.deepEqual(t.changes.map(c => c.key), ['strict', 'title', 'days', 'budget', 'prices', 'pace', 'connection', 'coins', 'coins', 'coins', 'months']);
    assert.deepEqual(t.changes[1], { moduleId: 'm', key: 'title', value: 'The Lowm' });
});

test('what the store moved or refused is said under the field, with the stored value shown (aria-invalid, aria-describedby, role=alert)', () => {
    const t = setup();
    const days = input(t, 'days');
    days.value = '99';
    days.dispatch('change');
    const error = row(t, 'days').querySelector('.ss-field-error');
    assert.equal(error.getAttribute('role'), 'alert');
    assert.equal(error.textContent, 'Set to 12, the most this allows.');
    assert.ok(!error.hidden);
    assert.equal(days.value, '12');
    assert.equal(t.saved().days, 12);
    assert.equal(days.getAttribute('aria-invalid'), 'true');
    assert.ok(days.getAttribute('aria-describedby').split(' ').includes(error.id), 'said again by the description');
    assert.ok(days.getAttribute('aria-describedby').includes(row(t, 'days').querySelector('.ss-field-help').id), 'with the help');
    // A good value clears it.
    days.value = '5';
    days.dispatch('change');
    assert.ok(error.hidden);
    assert.equal(days.getAttribute('aria-invalid'), null);
    assert.ok(!days.getAttribute('aria-describedby').includes(error.id));
    // Not a number: nothing is stored, the message says what it stays.
    days.value = 'many';
    days.dispatch('change');
    assert.equal(error.textContent, 'Enter a whole number. The setting stays 5.');
    assert.equal(t.saved().days, 5);
    assert.equal(days.value, '5');
    // A text cut.
    const title = input(t, 'title');
    title.value = 'aaaaaaaaaaaa';
    title.dispatch('change');
    assert.equal(row(t, 'title').querySelector('.ss-field-error').textContent, 'Cut to 8 characters, the most this allows.');
    // A value the store refuses (a choice that is not an option): not stored, the control goes back.
    const prices = input(t, 'prices');
    prices.value = 'barter';
    prices.dispatch('change');
    assert.equal(t.saved().prices, undefined);
    assert.equal(prices.value, 'by-place');
    assert.equal(row(t, 'prices').querySelector('.ss-field-error').textContent, 'That could not be saved. The setting stays by-place.');
    assert.equal(t.changes.some(c => c.key === 'prices'), false, 'onChange only for what was stored');
    // The slider keeps the engine out of range values; the list says nothing when it reads.
    const lines = row(t, 'months').querySelector('.ss-lines-text');
    lines.value = 'Frost: 99';
    lines.dispatch('change');
    assert.match(row(t, 'months').querySelector('.ss-lines-error').textContent, /Days must be at most 60/);
    assert.equal(t.saved().months, undefined, 'a list that does not read is kept as it was');
});

test('labels, help and descriptions: the label names the control, the help describes it; chips and lists are named by aria-labelledby', () => {
    const t = setup();
    const strict = row(t, 'strict');
    const label = strict.querySelector('.ss-field-label');
    assert.equal(label.tagName, 'LABEL');
    assert.equal(label.getAttribute('for'), input(t, 'strict').id, 'the label points at the control');
    assert.equal(input(t, 'strict').getAttribute('aria-labelledby'), label.id);
    assert.equal(input(t, 'strict').getAttribute('aria-describedby'), strict.querySelector('.ss-field-help').id);
    assert.equal(strict.querySelector('.ss-field-help').textContent, 'Code picks the stat.');
    assert.ok(hasClass(strict, 'ss-field-inline'), 'a switch sits beside its text');
    assert.ok(!hasClass(row(t, 'title'), 'ss-field-inline'));
    assert.equal(input(t, 'title').getAttribute('aria-describedby'), null, 'no help: nothing to describe');
    for (const key of ['pace', 'coins', 'months']) {
        const field = row(t, key);
        const name = field.querySelector('.ss-field-label');
        assert.equal(name.tagName, 'SPAN', `${key}: a group is not labelable`);
        assert.equal(input(t, key).getAttribute('aria-labelledby'), name.id);
    }
    // Every id is unique on the page.
    const ids = [...t.parent.querySelectorAll('[id]')].map(n => n.id);
    assert.equal(new Set(ids).size, ids.length);
});

test('read-only: the control is locked and the row says "Read only"; nothing is stored; `shows` is what it displays, the stored value kept', () => {
    const t = setup();
    const pack = row(t, 'pack');
    assert.equal(input(t, 'pack').value, 'From the pack', '`shows`');
    assert.equal(input(t, 'pack').readOnly, true);
    assert.equal(input(t, 'pack').getAttribute('aria-readonly'), 'true');
    assert.ok(!pack.querySelector('.ss-field-tag').hidden);
    assert.equal(pack.querySelector('.ss-field-tag').textContent, 'Read only');
    assert.ok(hasClass(pack, 'ss-field-readonly'));
    assert.equal(pack.getAttribute('data-readonly'), 'true');
    assert.ok(input(t, 'pack').getAttribute('aria-describedby').includes(pack.querySelector('.ss-field-tag').id));
    assert.deepEqual(t.saved(), {});
    // A read-only that is a function of the values follows them: locked while Strict is off, free after.
    assert.equal(input(t, 'harder').readOnly, true);
    assert.equal(input(t, 'harder').value, '3');
    input(t, 'strict').click();
    assert.equal(input(t, 'harder').readOnly, false);
    assert.equal(row(t, 'harder').getAttribute('data-readonly'), 'false');
    assert.ok(row(t, 'harder').querySelector('.ss-field-tag').hidden);
    input(t, 'harder').value = '5';
    input(t, 'harder').dispatch('change');
    assert.equal(t.saved().harder, 5);
    input(t, 'strict').click();
    assert.equal(input(t, 'harder').readOnly, true);
    assert.equal(input(t, 'harder').value, '3', '`shows` again; the stored 5 is kept');
    assert.equal(t.saved().harder, 5);
    // The same functions the overlay uses decide.
    assert.equal(fieldReadOnly(SCHEMA.harder, { strict: true }), false);
    assert.equal(rowValue('harder', SCHEMA.harder, { strict: false, harder: 5 }), 3);
    // Switches and chips are disabled when read-only.
    const lock = setup({}, { on: { type: 'bool', label: 'On', readOnly: true }, pick: { type: 'choice', form: 'chips', options: ['a', 'b'], readOnly: true } });
    assert.equal(lock.form.field('on').handle.input.disabled, true);
    lock.form.field('on').handle.input.click();
    lock.form.field('pick').row.querySelectorAll('.ss-chip')[1].click();
    assert.deepEqual(lock.saved(), {});
});

test('lockText: a locked row says why in its tag (a sentence, or a function of the values); the plain tag is "Read only"', () => {
    let reason = 'Off while the net is off';
    const t = setup({}, {
        net: { type: 'bool', label: 'Net' },
        kinds: { type: 'text', label: 'Kinds', readOnly: values => values.net !== true, lockText: values => (values.net === true ? '' : reason) },
        plain: { type: 'text', label: 'Plain', readOnly: true },
        fixed: { type: 'text', label: 'Fixed', readOnly: true, lockText: 'Set by the pack' },
    }, { net: false, kinds: 'a', plain: 'x', fixed: 'y' });
    const tagOf = key => row(t, key).querySelector('.ss-field-tag');
    assert.equal(tagOf('kinds').hidden, false);
    assert.equal(tagOf('kinds').textContent, 'Off while the net is off');
    assert.ok(hasClass(tagOf('kinds'), 'ss-field-tag-why'));
    assert.equal(tagOf('plain').textContent, 'Read only');
    assert.ok(!hasClass(tagOf('plain'), 'ss-field-tag-why'));
    assert.equal(tagOf('fixed').textContent, 'Set by the pack');
    assert.equal(tagOf('net').hidden, true);
    input(t, 'net').click();
    assert.equal(tagOf('kinds').hidden, true, 'open: no tag');
    assert.equal(input(t, 'kinds').readOnly, false);
    reason = 'Off again';
    input(t, 'net').click();
    assert.equal(tagOf('kinds').textContent, 'Off again');
    assert.equal(input(t, 'kinds').readOnly, true);
});

test('sources: a field can live outside the module\'s settings; its value is read from and written to the source, which can refuse', () => {
    const store = { on: false, refuse: false };
    const sources = {
        on: { get: () => store.on, set: value => { if (store.refuse) return undefined; store.on = value; return value; } },
        broken: { get: () => { throw new Error('gone'); }, set: value => value },
    };
    const t = setup({ sources }, { on: { type: 'bool', label: 'On' }, broken: { type: 'text', label: 'Broken' }, title: { type: 'text', label: 'Title' } }, { on: true, broken: 'kept', title: 'Lowmere' });
    assert.equal(input(t, 'on').getAttribute('aria-checked'), 'false', 'the source\'s value, not the module default');
    input(t, 'on').click();
    assert.equal(store.on, true);
    assert.deepEqual(t.saved(), {}, 'nothing written to the module\'s settings for it');
    assert.deepEqual(t.changes.at(-1).key, 'on');
    // A source that throws reads as an empty value; a refusal shows the field's old value again.
    assert.equal(input(t, 'broken').value, '');
    store.refuse = true;
    input(t, 'on').click();
    assert.equal(store.on, true, 'the source refused');
    assert.equal(input(t, 'on').getAttribute('aria-checked'), 'true', 'the field shows what is stored');
    // A field with no source still goes to the settings store.
    input(t, 'title').value = 'Mill';
    input(t, 'title').dispatch('change');
    assert.equal(t.saved().title, 'Mill');
    // refresh() rereads the source.
    store.on = false;
    t.form.refresh();
    assert.equal(input(t, 'on').getAttribute('aria-checked'), 'false');
});

test('destroy: a box that still holds the focus says its change as the form leaves; nothing throws and nothing is asked of an emptied form', () => {
    const t = setup({}, { a: { type: 'int', label: 'One: A', min: 1, max: 9 }, b: { type: 'int', label: 'Two: B', min: 1, max: 9 } }, { a: 3, b: 4 });
    const box = input(t, 'a');
    t.form.destroy();
    box.value = '5';
    assert.doesNotThrow(() => box.dispatch('change'), 'the late change of a removed box');
    assert.equal(t.form.keys().length, 0);
    assert.doesNotThrow(() => t.form.refresh());
});
