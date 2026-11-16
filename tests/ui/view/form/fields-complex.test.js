// The form engine's field renderers (view/form/fields.js): chipset, segmented, chips, lines, search, and section.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RENDERERS, chipsField, chipsetField, linesField, searchField, sectionBlock, segmentedField } from '../../../../ui/legacy/view/form/fields.js';
import { fieldKind } from '../../../../ui/legacy/view/form/schema.js';
import { classes, doc, make } from './fields.helpers.js';

test('chipset: several chips over a comma-separated text; entries the options do not list are kept and never drawn', () => {
    const field = { type: 'text', form: 'chips', options: [{ value: '~ time', label: 'Time' }, { value: '~ place', label: 'Place' }, { value: '~ weather', label: 'Weather' }], read: text => String(text).split(',').map(part => part.trim()).filter(Boolean) };
    const m = make(chipsetField, field, '~ weather, ~ mood, ~ time');
    const chips = () => m.el.querySelectorAll('.ss-chip');
    assert.deepEqual(chips().map(c => c.textContent), ['Time', 'Place', 'Weather']);
    assert.deepEqual(chips().map(c => c.getAttribute('aria-pressed')), ['true', 'false', 'true']);
    assert.equal(m.handle.get(), '~ time, ~ weather, ~ mood', 'the options\' order, then the kept entries');
    chips()[1].click();
    assert.deepEqual(m.calls.at(-1), ['~ time, ~ place, ~ weather, ~ mood', { typed: '~ time, ~ place, ~ weather, ~ mood' }]);
    chips()[0].click();
    chips()[1].click();
    chips()[2].click();
    assert.equal(m.calls.at(-1)[0], '~ mood', 'the kept entry stays when every chip is off');
    m.handle.set('~ place');
    assert.deepEqual(chips().map(c => c.getAttribute('aria-pressed')), ['false', 'true', 'false']);
    assert.equal(m.handle.get(), '~ place', 'a text without the kept entry forgets it');
    m.handle.setDisabled(true);
    chips()[0].click();
    assert.equal(m.calls.length, 4, 'a locked chipset reports nothing');
    // Without `read`: split on commas, semicolons and new lines, lower-cased.
    const plain = make(chipsetField, { type: 'text', form: 'chips', options: ['red', 'green'] }, 'Green; blue\nRED');
    assert.deepEqual(plain.el.querySelectorAll('.ss-chip').map(c => c.getAttribute('aria-pressed')), ['true', 'true']);
    assert.equal(plain.handle.get(), 'red, green, blue');
});

test('segmented: a choice with form "segmented" is the one-of chips drawn as one joined row (Text size), with the same value, keys and reports', () => {
    const field = { type: 'choice', form: 'segmented', options: [{ value: '100', label: 'Normal' }, { value: '110', label: '110%' }, { value: '120', label: '120%' }] };
    assert.equal(fieldKind(field), 'segmented');
    assert.equal(fieldKind({ ...field, form: 'chips' }), 'chips', 'chips are as they were');
    assert.equal(fieldKind({ type: 'choice', options: ['a'] }), 'select');
    assert.equal(RENDERERS.segmented, segmentedField);
    const m = make(segmentedField, field, '110');
    assert.ok(classes(m.el).includes('ss-chips') && classes(m.el).includes('ss-segmented'));
    assert.equal(m.input.getAttribute('role'), 'radiogroup');
    const buttons = () => m.el.querySelectorAll('.ss-chip');
    assert.deepEqual(buttons().map(c => c.textContent), ['Normal', '110%', '120%']);
    assert.ok(buttons().every(c => classes(c).includes('ss-tap-pill')), 'its chips opt in to the compact pill (size.css)');
    assert.deepEqual(buttons().map(c => c.getAttribute('aria-checked')), ['false', 'true', 'false']);
    buttons()[2].click();
    assert.deepEqual(m.calls, [['120', { typed: '120' }]]);
    assert.equal(m.handle.get(), '120');
    buttons()[2].dispatch('keydown', { key: 'Home' });
    assert.equal(m.handle.get(), '100');
    m.handle.set('110');
    assert.deepEqual(buttons().map(c => c.getAttribute('aria-checked')), ['false', 'true', 'false']);
    m.handle.setReadOnly(true);
    assert.ok(buttons().every(c => c.disabled));
});

test('chips, one of: a radio group with aria-checked, one Tab stop, the arrow keys move and choose (wrapping), Home and End', () => {
    const field = { type: 'choice', form: 'chips', options: ['slow', { value: 'steady', label: 'Steady' }, 'fast'] };
    const m = make(chipsField, field, 'steady');
    assert.equal(m.input.getAttribute('role'), 'radiogroup');
    assert.equal(m.input.getAttribute('aria-labelledby'), 'lbl');
    const chips = () => m.el.querySelectorAll('.ss-chip');
    assert.deepEqual(chips().map(c => c.textContent), ['slow', 'Steady', 'fast']);
    assert.ok(chips().every(c => c.getAttribute('role') === 'radio' && c.getAttribute('type') === 'button'));
    assert.deepEqual(chips().map(c => c.getAttribute('aria-checked')), ['false', 'true', 'false']);
    assert.deepEqual(chips().map(c => c.getAttribute('tabindex')), ['-1', '0', '-1']);
    chips()[2].click();
    assert.deepEqual(m.calls, [['fast', { typed: 'fast' }]]);
    assert.deepEqual(chips().map(c => c.getAttribute('tabindex')), ['-1', '-1', '0']);
    chips()[2].focus();
    let event = chips()[2].dispatch('keydown', { key: 'ArrowRight' });
    assert.ok(event.defaultPrevented);
    assert.equal(m.handle.get(), 'slow', 'wraps to the first');
    assert.equal(doc.activeElement, chips()[0]);
    chips()[0].dispatch('keydown', { key: 'ArrowLeft' });
    assert.equal(m.handle.get(), 'fast');
    chips()[2].dispatch('keydown', { key: 'Home' });
    assert.equal(m.handle.get(), 'slow');
    chips()[0].dispatch('keydown', { key: 'End' });
    assert.equal(m.handle.get(), 'fast');
    chips()[2].dispatch('keydown', { key: 'ArrowUp' });
    assert.equal(m.handle.get(), 'steady');
    const count = m.calls.length;
    chips()[1].click();
    assert.equal(m.calls.length, count, 'the same choice again reports nothing');
    event = chips()[1].dispatch('keydown', { key: 'a' });
    assert.ok(!event.defaultPrevented);
    m.handle.setReadOnly(true);
    assert.ok(chips().every(c => c.disabled));
    chips()[0].click();
    assert.equal(m.calls.length, count);
    m.handle.set('slow');
    assert.equal(chips()[0].getAttribute('aria-checked'), 'true');
});

test('chips, several of: a group of toggle buttons with aria-pressed; the value keeps the options\' order', () => {
    const m = make(chipsField, { type: 'choice', multiple: true, options: ['time', 'place', 'weather'] }, ['weather']);
    assert.equal(m.input.getAttribute('role'), 'group');
    const chips = () => m.el.querySelectorAll('.ss-chip');
    assert.ok(chips().every(c => c.getAttribute('role') === null));
    assert.deepEqual(chips().map(c => c.getAttribute('aria-pressed')), ['false', 'false', 'true']);
    chips()[0].click();
    assert.deepEqual(m.calls.at(-1)[0], ['time', 'weather']);
    chips()[2].click();
    assert.deepEqual(m.calls.at(-1)[0], ['time']);
    chips()[1].click();
    assert.deepEqual(m.calls.at(-1)[0], ['time', 'place']);
    assert.deepEqual(m.handle.get(), ['time', 'place']);
    m.handle.set(['weather', 'nonsense']);
    assert.deepEqual(chips().map(c => c.getAttribute('aria-pressed')), ['false', 'false', 'true']);
    m.handle.set('x');
    assert.deepEqual(m.handle.get(), []);
    m.handle.setDisabled(true);
    chips()[0].click();
    assert.equal(m.calls.length, 3);
});

const COINS = { type: 'list', label: 'Coins', of: { name: { type: 'text', label: 'Name', max: 20 }, worth: { type: 'int', label: 'Worth', min: 1 } } };
const rowsOf = m => m.el.querySelectorAll('.ss-lines-row');

test('lines, rows: a row per item with its fields named by field and item, Remove and Add; the list is reported whole', () => {
    const m = make(linesField, COINS, [{ name: 'penny', worth: 1 }, { name: 'silver', worth: 10 }], { id: 'coins' });
    assert.equal(m.input.getAttribute('role'), 'group');
    assert.equal(m.input.getAttribute('aria-labelledby'), 'lbl');
    assert.equal(m.el.getAttribute('data-form'), 'rows');
    assert.equal(rowsOf(m).length, 2);
    const inputs = rowsOf(m)[1].querySelectorAll('input');
    assert.deepEqual(inputs.map(i => i.getAttribute('aria-label')), ['Name, item 2', 'Worth, item 2']);
    assert.deepEqual(inputs.map(i => i.value), ['silver', '10']);
    assert.equal(rowsOf(m)[0].querySelector('.ss-lines-remove').getAttribute('aria-label'), 'Remove penny');
    // Edit a field: the whole list is reported.
    inputs[1].value = '12';
    inputs[1].dispatch('change');
    assert.deepEqual(m.calls.at(-1)[0], [{ name: 'penny', worth: 1 }, { name: 'silver', worth: 12 }]);
    // Add: a new empty row, reported, and the focus in its first field.
    m.el.querySelector('.ss-lines-add').click();
    assert.equal(rowsOf(m).length, 3);
    assert.deepEqual(m.calls.at(-1)[0].at(-1), { name: '', worth: 1 });
    assert.equal(doc.activeElement, rowsOf(m)[2].querySelector('input'));
    // Remove the first: reported, and the focus goes to the next item's Remove, never the page behind.
    rowsOf(m)[0].querySelector('.ss-lines-remove').click();
    assert.deepEqual(m.calls.at(-1)[0].map(c => c.name), ['silver', '']);
    assert.equal(rowsOf(m).length, 2);
    assert.equal(doc.activeElement, rowsOf(m)[0].querySelector('.ss-lines-remove'));
    // Remove the last: the focus goes to Add.
    rowsOf(m)[1].querySelector('.ss-lines-remove').click();
    rowsOf(m)[0].querySelector('.ss-lines-remove').click();
    assert.equal(rowsOf(m).length, 0);
    assert.equal(doc.activeElement, m.el.querySelector('.ss-lines-add'));
    assert.ok(m.el.querySelector('.ss-lines-empty'));
});

test('lines, text: one item per line ("Name: Worth"), read back through the overlay\'s reader; a bad line is named and nothing is reported', () => {
    const items = [{ name: 'penny', worth: 1 }, { name: 'Day: of Ash', worth: 30 }];
    const m = make(linesField, COINS, items, { id: 'coins' });
    // Rows → text.
    m.el.querySelector('.ss-lines-toggle').click();
    assert.equal(m.el.getAttribute('data-form'), 'lines');
    const area = m.el.querySelector('.ss-lines-text');
    assert.equal(area.value, 'penny: 1\nDay: of Ash: 30', 'the extra colon belongs to the one text field');
    assert.equal(doc.activeElement, m.el.querySelector('.ss-lines-toggle'));
    // A good edit, tidied and reported; a blank line is skipped.
    area.value = 'penny: 1\n\n copper bit : 2\nDay: of Ash: 30';
    area.dispatch('change');
    assert.deepEqual(m.calls.at(-1)[0], [{ name: 'penny', worth: 1 }, { name: 'copper bit', worth: 2 }, { name: 'Day: of Ash', worth: 30 }]);
    assert.equal(area.value, 'penny: 1\ncopper bit: 2\nDay: of Ash: 30');
    // Bad lines: each named with the reason, aria-invalid, described by the error (role=alert); the list is kept.
    const count = m.calls.length;
    for (const [text, why] of [['penny: lots', /Worth is not a whole number/], ['penny: 0', /Worth must be at least 1/], ['penny', /it needs Name: Worth/]]) {
        area.value = text;
        area.dispatch('change');
        const error = m.el.querySelector('.ss-lines-error');
        assert.equal(error.getAttribute('role'), 'alert');
        assert.ok(!error.hidden);
        assert.match(error.textContent, why);
        assert.match(error.textContent, /Line 1 \("/);
        assert.equal(area.getAttribute('aria-invalid'), 'true');
        assert.ok(area.getAttribute('aria-describedby').includes(error.id));
        assert.equal(m.calls.length, count, 'nothing reported');
    }
    // Back to rows is refused while the text does not read; the focus stays in the text.
    m.el.querySelector('.ss-lines-toggle').click();
    assert.equal(m.el.getAttribute('data-form'), 'lines');
    assert.equal(doc.activeElement, area);
    area.value = 'penny: 1';
    area.dispatch('change');
    assert.ok(m.el.querySelector('.ss-lines-error').hidden);
    assert.equal(area.getAttribute('aria-invalid'), null);
    m.el.querySelector('.ss-lines-toggle').click();
    assert.equal(m.el.getAttribute('data-form'), 'rows');
    assert.equal(rowsOf(m).length, 1);
});

test('lines: `form: "lines"` starts as text; the choice is kept in the memo across redraws; a list with a switch has rows only', () => {
    const memo = new Map();
    const field = { ...COINS, form: 'lines' };
    const a = make(linesField, field, [{ name: 'a', worth: 2 }], { id: 'c1', memo });
    assert.equal(a.el.getAttribute('data-form'), 'lines');
    a.el.querySelector('.ss-lines-toggle').click();
    assert.equal(a.el.getAttribute('data-form'), 'rows');
    const b = make(linesField, field, [], { id: 'c1', memo });
    assert.equal(b.el.getAttribute('data-form'), 'rows', 'the reader\'s last choice for this field');
    const withSwitch = make(linesField, { type: 'list', form: 'lines', of: { name: { type: 'text' }, on: { type: 'bool' } } }, [{ name: 'x', on: true }], { id: 'c2' });
    assert.equal(withSwitch.el.getAttribute('data-form'), 'rows');
    assert.equal(withSwitch.el.querySelectorAll('.ss-lines-toggle').length, 0, 'no text form for a list that holds a switch');
    assert.ok(withSwitch.el.querySelector('.ss-switch'));
    // A sub-field of a type the engine does not know is not drawn; a nested list is never drawn.
    const odd = make(linesField, { type: 'list', of: { name: { type: 'text' }, ghost: { type: 'hologram' }, inner: { type: 'list', of: { a: 'text' } } } }, [{ name: 'x', ghost: 1 }], { id: 'c3' });
    assert.equal(odd.el.querySelectorAll('.ss-lines-cell').length, 1);
});

test('lines: set() writes into the rows in place when the count is the same (a focus stays), else draws again; read-only and disabled lock it', () => {
    const m = make(linesField, COINS, [{ name: 'a', worth: 1 }], { id: 'c' });
    const first = rowsOf(m)[0].querySelector('input');
    first.focus();
    m.handle.set([{ name: 'b', worth: 5 }]);
    assert.equal(rowsOf(m)[0].querySelector('input'), first, 'the same input');
    assert.equal(first.value, 'b');
    assert.equal(doc.activeElement, first);
    m.handle.set([{ name: 'b', worth: 5 }, { name: 'c', worth: 6 }]);
    assert.equal(rowsOf(m).length, 2);
    assert.deepEqual(m.handle.get(), [{ name: 'b', worth: 5 }, { name: 'c', worth: 6 }]);
    m.handle.setReadOnly(true);
    assert.ok(m.el.querySelectorAll('input').every(i => i.readOnly));
    assert.ok(m.el.querySelector('.ss-lines-remove').disabled && m.el.querySelector('.ss-lines-add').disabled);
    m.handle.setReadOnly(false);
    m.handle.setDisabled(true);
    assert.ok(m.el.querySelectorAll('input').every(i => i.disabled));
    // The list holds at most 100 rows: Add is off at the limit.
    const full = make(linesField, COINS, Array.from({ length: 100 }, (_, i) => ({ name: `n${i}`, worth: 1 })), { id: 'full' });
    assert.ok(full.el.querySelector('.ss-lines-add').disabled);
});

test('search: a search input named by a hidden label, a clear button while it holds text, Escape clears; onInput as the reader types', () => {
    const seen = [];
    const s = searchField(doc, { onInput: text => seen.push(text), id: 'q1' });
    doc.body.appendChild(s.el);
    assert.equal(s.el.getAttribute('role'), 'search');
    assert.equal(s.input.type, 'search');
    assert.equal(s.input.id, 'q1');
    const label = s.el.querySelector('label');
    assert.equal(label.getAttribute('for'), 'q1');
    assert.equal(label.textContent, 'Search settings');
    assert.ok(classes(label).includes('ss-visually-hidden'));
    assert.equal(s.input.placeholder, 'Search settings…');
    const clear = s.el.querySelector('.ss-search-clear');
    assert.ok(clear.hidden);
    assert.equal(clear.getAttribute('aria-label'), 'Clear the search');
    s.input.value = 'coin';
    s.input.dispatch('input');
    assert.deepEqual(seen, ['coin']);
    assert.ok(!clear.hidden);
    const event = s.input.dispatch('keydown', { key: 'Escape' });
    assert.ok(event.defaultPrevented && event.stopped);
    assert.deepEqual(seen, ['coin', '']);
    assert.equal(s.get(), '');
    assert.ok(clear.hidden);
    s.set('x');
    assert.ok(!clear.hidden);
    clear.click();
    assert.equal(s.get(), '');
    assert.equal(doc.activeElement, s.input);
    s.input.dispatch('keydown', { key: 'Escape' });
    assert.equal(seen.at(-1), '', 'Escape on an empty box does nothing more');
});

test('section: a glass card with a heading (a section label) named for it; collapsible: a details with a summary', () => {
    const s = sectionBlock(doc, { title: 'Calendar', hint: '2 settings', id: 'sec1' });
    assert.equal(s.el.tagName, 'SECTION');
    assert.ok(classes(s.el).includes('ss-section') && classes(s.el).includes('ss-glass'));
    assert.equal(s.title.tagName, 'H3');
    assert.ok(classes(s.title).includes('ss-label'));
    assert.equal(s.el.getAttribute('aria-labelledby'), 'sec1-title');
    assert.equal(s.el.querySelector('.ss-section-hint').textContent, '2 settings');
    s.setHidden(true);
    assert.equal(s.el.hidden, true);
    const bare = sectionBlock(doc, {});
    assert.ok(bare.el.querySelector('.ss-section-head').hidden, 'no title: no heading');
    assert.equal(bare.el.getAttribute('aria-labelledby'), null);
    const fold = sectionBlock(doc, { title: 'More', collapsible: true, open: false });
    assert.equal(fold.el.tagName, 'DETAILS');
    assert.equal(fold.el.open, false);
    assert.equal(fold.el.querySelector('summary').textContent, 'More');
});
