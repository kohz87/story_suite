// The form engine's field renderers (view/form/fields.js): schema kinds, switch, text, number, slider, select, and profile.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RENDERERS, numberField, profileField, selectField, sliderField, switchField, textField } from '../../../../src/v2/view/form/fields.js';
import { FIELD_KINDS, changeNote, fieldKind, labelOf, matchesSearch, optionsOf } from '../../../../src/v2/view/form/schema.js';
import { PROFILE_TEXT } from '../../../../src/v2/profile-field.js';
import { classes, make } from './fields.helpers.js';

test('the renderers by kind, and which kind a schema field gets', () => {
    assert.deepEqual(Object.keys(RENDERERS), FIELD_KINDS);
    assert.equal(fieldKind({ type: 'bool' }), 'switch');
    assert.equal(fieldKind('bool'), 'switch');
    assert.equal(fieldKind({ type: 'text' }), 'text');
    assert.equal(fieldKind({ type: 'int' }), 'number');
    assert.equal(fieldKind({ type: 'int', min: 0, max: 9, form: 'slider' }), 'slider');
    assert.equal(fieldKind({ type: 'int', form: 'slider' }), 'number', 'a slider needs whole-number bounds');
    assert.equal(fieldKind({ type: 'int', min: 5, max: 5, form: 'slider' }), 'number');
    assert.equal(fieldKind({ type: 'choice', options: ['a'] }), 'select');
    assert.equal(fieldKind(['a', 'b']), 'select', 'an array is a choice');
    assert.equal(fieldKind({ type: 'choice', options: ['a'], form: 'chips' }), 'chips');
    assert.equal(fieldKind({ type: 'profile' }), 'profile');
    assert.equal(fieldKind({ type: 'text', form: 'chips', options: ['a'] }), 'chipset', 'chips over a text');
    assert.equal(fieldKind({ type: 'text', form: 'chips' }), 'text', 'no options: a plain text');
    assert.equal(fieldKind({ type: 'list', of: {} }), 'lines');
    assert.equal(fieldKind({ type: 'hologram' }), null, 'a newer module\'s type: not drawn');
    assert.equal(fieldKind(null), null);
    assert.deepEqual(optionsOf({ options: ['a', { value: 'b', label: 'Bee' }, { value: 3 }] }), [{ value: 'a', label: 'a' }, { value: 'b', label: 'Bee' }, { value: '3', label: '3' }]);
    assert.equal(labelOf('partyMembers', {}), 'Party Members', 'as the overlay does');
    assert.equal(labelOf('x', { label: 'Mine' }), 'Mine');
});

test('changeNote and matchesSearch: the words for a value moved by the store, and the search', () => {
    assert.match(changeNote({ type: 'int', min: 1, max: 10 }, 99, 10), /Set to 10, the most/);
    assert.match(changeNote({ type: 'int', min: 1, max: 10 }, -4, 1), /Set to 1, the least/);
    assert.equal(changeNote({ type: 'int' }, 5, 5), '');
    assert.match(changeNote({ type: 'text', max: 5 }, 'abcdefgh', 'abcde'), /Cut to 5 characters/);
    assert.equal(changeNote({ type: 'text' }, 'a', 'a'), '');
    assert.equal(changeNote({ type: 'bool' }, true, false), '');
    assert.ok(matchesSearch('budget', { label: 'Story coin per reply', help: 'Quest rewards' }, 'Money', 'coin'));
    assert.ok(matchesSearch('budget', { label: 'Story coin per reply' }, 'Money', 'MONEY story'), 'every word, anywhere, any case');
    assert.ok(!matchesSearch('budget', { label: 'Story coin per reply' }, 'Money', 'coin dragon'));
    assert.ok(matchesSearch('k', {}, 'g', '  '), 'an empty search matches all');
});

test('switch: a button with role=switch, aria-checked, named by its label; a click toggles and reports; locked ones do not', () => {
    const m = make(switchField, { type: 'bool' }, true);
    assert.equal(m.input.tagName, 'BUTTON');
    assert.equal(m.input.getAttribute('type'), 'button');
    assert.equal(m.input.getAttribute('role'), 'switch');
    assert.equal(m.input.getAttribute('aria-labelledby'), 'lbl');
    assert.equal(m.input.getAttribute('aria-checked'), 'true');
    assert.ok(classes(m.input).includes('ss-switch') && classes(m.input).includes('ss-switch-on'));
    m.input.click();
    assert.deepEqual(m.calls, [[false, undefined]]);
    assert.equal(m.input.getAttribute('aria-checked'), 'false');
    assert.ok(!classes(m.input).includes('ss-switch-on'));
    m.handle.set(true);
    assert.equal(m.input.getAttribute('aria-checked'), 'true');
    assert.equal(m.handle.get(), true);
    m.handle.setReadOnly(true);
    assert.equal(m.input.disabled, true);
    assert.equal(m.input.getAttribute('aria-disabled'), 'true');
    m.input.click();
    assert.equal(m.calls.length, 1, 'read-only: no change');
    m.handle.setReadOnly(false);
    assert.equal(m.input.disabled, false);
    m.handle.setDisabled(true);
    m.input.click();
    assert.equal(m.calls.length, 1, 'disabled: no change');
    // A label that stands in for the name (inside a list's row).
    const lone = make(switchField, { type: 'bool' }, false, { labelledBy: '', ariaLabel: 'On, item 1' });
    assert.equal(lone.input.getAttribute('aria-label'), 'On, item 1');
});

test('text: reports on change (not while typing), cuts a paste at its max, counts a text area, read-only is aria-readonly', () => {
    const m = make(textField, { type: 'text', max: 5 }, 'hello');
    assert.equal(m.input.tagName, 'INPUT');
    assert.equal(m.input.type, 'text');
    assert.equal(m.input.maxLength, 5);
    assert.equal(m.input.getAttribute('aria-labelledby'), 'lbl');
    m.input.value = 'abc';
    m.input.dispatch('input');
    assert.equal(m.calls.length, 0, 'not while typing');
    m.input.dispatch('change');
    assert.deepEqual(m.calls, [['abc', { typed: 'abc' }]]);
    m.input.value = 'abcdefghij';
    m.input.dispatch('change');
    assert.equal(m.input.value, 'abcde');
    assert.deepEqual(m.calls.at(-1), ['abcde', { typed: 'abcdefghij' }], 'what the reader pasted is passed on, so the form can say it was cut');
    m.handle.set('xy');
    assert.equal(m.handle.get(), 'xy');
    m.handle.setReadOnly(true);
    assert.equal(m.input.readOnly, true);
    assert.equal(m.input.getAttribute('aria-readonly'), 'true');
    m.handle.setReadOnly(false);
    assert.equal(m.input.getAttribute('aria-readonly'), null);
    m.handle.setDisabled(true);
    assert.equal(m.input.disabled, true);
    const area = make(textField, { type: 'text', multiline: true, max: 20 }, 'one two');
    assert.equal(area.input.tagName, 'TEXTAREA');
    assert.equal(area.el.querySelector('.ss-field-count').textContent, '7 of 20 characters');
    area.input.value = 'one two three';
    area.input.dispatch('input');
    assert.equal(area.el.querySelector('.ss-field-count').textContent, '13 of 20 characters');
    // Cut by code points, never inside a character.
    const emoji = make(textField, { type: 'text', max: 3 }, '');
    emoji.input.value = '😀😀😀😀😀';
    emoji.input.dispatch('change');
    assert.ok(Array.from(emoji.input.value).every(char => char === '😀'));
});

test('number: a whole number inside its range; a number moved into the range reports what was typed; text is refused and said', () => {
    const m = make(numberField, { type: 'int', min: 1, max: 10 }, 4);
    assert.equal(m.input.type, 'number');
    assert.deepEqual([m.input.min, m.input.max, m.input.step, m.input.inputMode, m.input.value], ['1', '10', '1', 'numeric', '4']);
    m.input.value = '7';
    m.input.dispatch('change');
    assert.deepEqual(m.calls, [[7, { typed: 7 }]]);
    m.input.value = '99';
    m.input.dispatch('change');
    assert.deepEqual(m.calls.at(-1), [10, { typed: 99 }], 'moved to the most; what was asked is passed on');
    assert.equal(m.input.value, '10');
    m.input.value = '-3';
    m.input.dispatch('change');
    assert.deepEqual(m.calls.at(-1), [1, { typed: -3 }]);
    m.input.value = '4.6';
    m.input.dispatch('change');
    assert.equal(m.calls.at(-1)[0], 5, 'rounded');
    const before = m.calls.length;
    m.input.value = 'lots';
    m.input.dispatch('change');
    assert.equal(m.calls.length, before, 'not a number: nothing reported');
    assert.equal(m.input.value, '5', 'the stored value is shown again');
    assert.deepEqual(m.invalid, ['Enter a whole number. The setting stays 5.']);
    m.input.value = '';
    m.input.dispatch('change');
    assert.equal(m.invalid.length, 2, 'empty is not a number either');
    m.handle.set(null);
    assert.equal(m.input.value, '');
    assert.equal(m.handle.get(), null);
    m.handle.set(8);
    assert.equal(m.handle.get(), 8);
});

test('slider: a native range; the value beside it and spoken (aria-valuetext) while moving; reported when let go; the fill is a custom property', () => {
    const m = make(sliderField, { type: 'int', min: 30, max: 90, form: 'slider', unit: '%' }, 50);
    assert.equal(m.input.type, 'range');
    assert.deepEqual([m.input.min, m.input.max, m.input.step, m.input.value], ['30', '90', '1', '50']);
    // `step`: a whole number from 1 up (a budget in steps of 50); anything else is 1.
    assert.equal(make(sliderField, { type: 'int', min: 100, max: 6000, form: 'slider', step: 50 }, 1500).input.step, '50');
    assert.equal(make(sliderField, { type: 'int', min: 0, max: 10, form: 'slider', step: 0.5 }, 5).input.step, '1');
    assert.equal(m.el.querySelector('.ss-slider-value').textContent, '50%');
    assert.equal(m.el.querySelector('.ss-slider-value').getAttribute('aria-hidden'), 'true');
    assert.equal(m.input.getAttribute('aria-valuetext'), '50%');
    assert.equal(m.input.getAttribute('aria-labelledby'), 'lbl');
    assert.equal(m.input.style.getPropertyValue('--ss-fill'), '0.3333');
    m.input.value = '72';
    m.input.dispatch('input');
    assert.equal(m.el.querySelector('.ss-slider-value').textContent, '72%');
    assert.equal(m.calls.length, 0, 'not while dragging');
    m.input.dispatch('change');
    assert.deepEqual(m.calls, [[72, { typed: 72 }]]);
    m.handle.set(500);
    assert.equal(m.input.value, '90', 'kept inside the bounds');
    m.handle.set('x');
    assert.equal(m.input.value, '30');
    m.handle.setReadOnly(true);
    assert.equal(m.input.disabled, true);
});

test('select: the options, a change reports the value; set shows another', () => {
    const m = make(selectField, { type: 'choice', options: [{ value: 'glass', label: 'Glass' }, 'solid'] }, 'solid');
    assert.equal(m.input.tagName, 'SELECT');
    assert.deepEqual(m.input.querySelectorAll('option').map(o => [o.value, o.textContent]), [['glass', 'Glass'], ['solid', 'solid']]);
    assert.equal(m.input.value, 'solid');
    m.input.value = 'glass';
    m.input.dispatch('change');
    assert.deepEqual(m.calls, [['glass', { typed: 'glass' }]]);
    m.handle.set('solid');
    assert.equal(m.handle.get(), 'solid');
    m.handle.setReadOnly(true);
    assert.equal(m.input.disabled, true);
    m.handle.setReadOnly(false);
    assert.equal(m.input.disabled, false);
});

test('profile: "Same as chat" then the Connection Manager\'s profiles; a profile that is gone stays, with a note; no profiles: a note', () => {
    const list = { usable: true, profiles: [{ name: 'Flash Lite' }, { name: 'Main' }] };
    const m = make(profileField, { type: 'profile' }, 'Main', { profiles: () => list });
    assert.deepEqual(m.input.querySelectorAll('option').map(o => o.textContent), [PROFILE_TEXT.same, 'Flash Lite', 'Main']);
    assert.equal(m.input.value, 'Main');
    assert.deepEqual(m.notes, [''], 'nothing to say');
    m.input.value = '';
    m.input.dispatch('change');
    assert.deepEqual(m.calls, [['', { typed: '' }]]);
    m.handle.set('Old One');
    assert.equal(m.input.value, 'Old One');
    assert.ok(m.input.querySelectorAll('option').some(o => o.textContent === 'Old One (not found)'));
    assert.match(m.notes.at(-1), /is not in the Connection Manager any more/);
    const none = make(profileField, { type: 'profile' }, '', { profiles: () => ({ usable: false, why: 'The Connection Manager is off.' }) });
    assert.equal(none.notes.at(-1), 'The Connection Manager is off.');
    assert.deepEqual(none.input.querySelectorAll('option').map(o => o.textContent), [PROFILE_TEXT.same]);
    // Nothing to pick but "Same as chat": the select is disabled (the note says why); a profile that is gone can still be changed.
    assert.equal(none.input.disabled, true);
    assert.equal(m.input.disabled, false);
    m.handle.setReadOnly(true);
    assert.equal(m.input.disabled, true);
    m.handle.setReadOnly(false);
    assert.equal(m.input.disabled, false);
    const empty = make(profileField, { type: 'profile' }, '', { profiles: () => ({ usable: true, profiles: [] }) });
    assert.equal(empty.input.disabled, true);
    assert.equal(empty.notes.at(-1), PROFILE_TEXT.none);
    const gone = make(profileField, { type: 'profile' }, 'Old One', { profiles: () => ({ usable: true, profiles: [] }) });
    assert.equal(gone.input.disabled, false, 'a stored profile that is gone can be changed');
    gone.handle.set('');
    assert.equal(gone.input.disabled, true);
});
