// List text form (one item per line, fields split by ":") and legacy slider removal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { linesToList, listTextFields, listToLines, renderSettingsHost } from '../../ui/legacy/host-ui.js';
import { createCoreModule } from '../../modules/scene/domains/index.js';
import { packsFor } from '../../core/runtime.js';
import { sourceOf } from '../helpers/split-source.js';
import { cssOf } from './helpers/css-parts.js';
import { change, doc, linesDirector, MONTHS, setup } from './host-ui.helpers.js';


test('text form: written one item per line as "Name: Days", read back the same, any number of lines', () => {
    assert.deepEqual(listTextFields(MONTHS).map(([key]) => key), ['name', 'days']);
    assert.equal(listTextFields({ type: 'list', of: { name: 'text', on: 'bool' } }), null, 'a switch in it: rows only');
    assert.equal(listTextFields({ type: 'list', of: { pace: ['slow', 'fast'] } }), null, 'a choice in it: rows only');
    assert.equal(listTextFields({ type: 'int' }), null);
    const months = [{ name: 'Frostmoon', days: 30 }, { name: 'Thaw', days: 28 }];
    assert.equal(listToLines(MONTHS, months), 'Frostmoon: 30\nThaw: 28');
    assert.deepEqual(linesToList(MONTHS, listToLines(MONTHS, months)), { ok: true, items: months });
    // Spaces, blank lines and Windows line ends do not matter; a sign is fine.
    assert.deepEqual(linesToList(MONTHS, '  Frostmoon :30 \r\n\r\n\nThaw:+28\n'), { ok: true, items: months });
    // Any count: none, one, thirteen, the most a list holds.
    assert.deepEqual(linesToList(MONTHS, ''), { ok: true, items: [] });
    assert.deepEqual(linesToList(MONTHS, 'Only: 365').items, [{ name: 'Only', days: 365 }]);
    const thirteen = Array.from({ length: 13 }, (_, at) => ({ name: `Moon ${at + 1}`, days: 28 }));
    assert.deepEqual(linesToList(MONTHS, listToLines(MONTHS, thirteen)).items, thirteen);
    const most = Array.from({ length: 100 }, (_, at) => `M${at}: 10`).join('\n');
    assert.equal(linesToList(MONTHS, most).items.length, 100);
    assert.deepEqual(linesToList(MONTHS, `${most}\nOne more: 10`), { ok: false, line: 101, text: 'One more: 10', error: 'a list holds at most 100 lines.' });
    // A name with colons in it: the list has one text field, so the extra colons are the name's.
    assert.deepEqual(linesToList(MONTHS, 'Day: of Ash: 30').items, [{ name: 'Day: of Ash', days: 30 }]);
    assert.deepEqual(linesToList(MONTHS, listToLines(MONTHS, [{ name: 'Day: of Ash', days: 30 }])).items, [{ name: 'Day: of Ash', days: 30 }]);
    // A line break inside a stored name never makes two lines.
    assert.equal(listToLines(MONTHS, [{ name: 'Two\nlines', days: 3 }]), 'Two lines: 3');
    // A one-field list: the whole line is the value.
    assert.deepEqual(linesToList({ type: 'list', of: { word: 'text' } }, 'a: b\nc').items, [{ word: 'a: b' }, { word: 'c' }]);
});

test('text form: a line that does not read is refused, named by its number and text, with why', () => {
    const bad = (text, line, why) => assert.deepEqual(linesToList(MONTHS, text), { ok: false, line, text: text.split('\n')[line - 1].trim(), error: why });
    bad('Frostmoon: 30\nThaw: 0', 2, 'Days must be at least 1.');
    bad('Frostmoon: -5', 1, 'Days must be at least 1.');
    bad('Frostmoon: 401', 1, 'Days must be at most 400.');
    bad('Frostmoon: thirty', 1, 'Days is not a whole number.');
    bad('Frostmoon: 30.5', 1, 'Days is not a whole number.');
    bad('Frostmoon:', 1, 'Days is not a whole number.');
    bad('A: 1\n\nFrostmoon', 3, 'it needs Name: Days.');
    // Two text fields: extra colons cannot be placed.
    const pairs = { type: 'list', of: { a: { type: 'text', label: 'A' }, b: { type: 'text', label: 'B' } } };
    assert.deepEqual(linesToList(pairs, 'x: y: z'), { ok: false, line: 1, text: 'x: y: z', error: 'it has more than 2 parts split by ":".' });
});

test('text form in the settings: `form: \'lines\'` starts as a textarea; it stores on change, refuses a bad line and keeps the list', () => {
    const { registry, settings } = setup(linesDirector());
    const root = doc.createElement('div');
    doc.body.appendChild(root);
    const openState = new Map();
    const host = renderSettingsHost(root, { registry, settings, doc, openState });
    const list = () => root.querySelector('.story-suite-row[data-field="tracker.calendar.months"] .story-suite-list');
    const area = () => list().querySelector('textarea.story-suite-list-text');
    assert.equal(list().dataset.form, 'lines');
    assert.equal(list().querySelector('.story-suite-list-item'), null, 'no rows');
    assert.equal(area().value, 'January: 31\nFebruary: 28');
    // Labelled by the field's label, described by its format.
    const labelId = area().getAttribute('aria-labelledby');
    assert.equal(root.querySelectorAll(`#${labelId}`)[0].textContent, 'Months');
    const help = list().querySelector('.story-suite-list-help');
    assert.equal(area().getAttribute('aria-describedby'), help.id);
    assert.equal(help.textContent, 'One per line, as Name: Days. Any number of lines, up to 100.');
    // Thirteen months of a fantasy calendar.
    const thirteen = Array.from({ length: 13 }, (_, at) => `Moon ${at + 1}: ${at === 12 ? 1 : 28}`).join('\n');
    area().value = `${thirteen}\n`;
    change(area());
    const stored = settings('story-director')['tracker.calendar.months'];
    assert.equal(stored.length, 13);
    assert.deepEqual(stored.at(-1), { name: 'Moon 13', days: 1 });
    assert.equal(area().value, thirteen, 'written back tidy');
    // A bad line: refused with its number, the stored list unchanged, the text left for fixing.
    area().value = 'Frostmoon: 30\nThaw: 0';
    change(area());
    const error = list().querySelector('.story-suite-list-error');
    assert.equal(error.hidden, false);
    assert.equal(error.getAttribute('role'), 'alert');
    assert.equal(error.textContent, 'Line 2 ("Thaw: 0"): Days must be at least 1. The list is kept as it was until every line reads.');
    assert.equal(area().getAttribute('aria-invalid'), 'true');
    assert.equal(area().getAttribute('aria-describedby'), `${help.id} ${error.id}`);
    assert.equal(settings('story-director')['tracker.calendar.months'].length, 13, 'the old value is kept');
    assert.equal(area().value, 'Frostmoon: 30\nThaw: 0');
    // Edit as rows refuses to leave while a line does not read.
    list().querySelector('.story-suite-list-toggle').click();
    assert.equal(list().dataset.form, 'lines');
    assert.ok(doc.activeElement === area());
    area().value = 'Frostmoon: 30\nThaw: 29';
    change(area());
    assert.equal(error.hidden, true);
    assert.equal(area().getAttribute('aria-invalid'), null);
    assert.deepEqual(settings('story-director')['tracker.calendar.months'], [{ name: 'Frostmoon', days: 30 }, { name: 'Thaw', days: 29 }]);
    // Negative and non-number days too.
    for (const line of ['Thaw: -3', 'Thaw: many']) {
        area().value = line;
        change(area());
        assert.equal(list().querySelector('.story-suite-list-error').hidden, false, line);
        assert.equal(settings('story-director')['tracker.calendar.months'].length, 2, line);
    }
    area().value = 'Frostmoon: 30\nThaw: 29';
    change(area());
    // Edit as rows: the rows of what was stored, the toggle keeps the focus; the choice outlives a redraw.
    const toText = list().querySelector('.story-suite-list-toggle');
    assert.equal(toText.textContent, 'Edit as rows');
    assert.equal(toText.getAttribute('aria-label'), 'Edit Months as rows');
    toText.click();
    assert.equal(list().dataset.form, 'rows');
    assert.deepEqual(list().querySelectorAll('.story-suite-list-item [data-field="name"] input').map(input => input.value), ['Frostmoon', 'Thaw']);
    assert.ok(doc.activeElement === list().querySelector('.story-suite-list-toggle'));
    assert.equal(list().querySelector('.story-suite-list-toggle').textContent, 'Edit as text');
    host.refresh();
    assert.equal(list().dataset.form, 'rows', 'kept across a redraw');
    list().querySelector('.story-suite-list-toggle').click();
    assert.equal(area().value, 'Frostmoon: 30\nThaw: 29');
    root.remove();
});

test('text form: every list of text and whole numbers has the toggle; others and an unknown `form` keep their rows', () => {
    const odd = {
        id: 'odd', name: 'Odd',
        settings: {
            defaults: { words: [{ word: 'a' }], mixed: [{ name: 'x', on: true }], later: [{ name: 'y', n: 2 }] },
            schema: {
                words: { type: 'list', label: 'Words', of: { word: 'text' } },
                mixed: { type: 'list', label: 'Mixed', of: { name: 'text', on: 'bool' } },
                later: { type: 'list', label: 'Later', form: 'cards', of: { name: 'text', n: 'int' } },
            },
        },
    };
    const { registry, settings } = setup(odd);
    const root = doc.createElement('div');
    renderSettingsHost(root, { registry, settings, doc });
    const list = key => root.querySelector(`.story-suite-row[data-field="${key}"] .story-suite-list`);
    assert.equal(list('mixed').querySelector('.story-suite-list-toggle'), null, 'a switch in it: no text form');
    assert.equal(list('later').dataset.form, 'rows', 'a `form` this Story Block does not know is ignored');
    assert.ok(list('later').querySelector('.story-suite-list-toggle'));
    list('words').querySelector('.story-suite-list-toggle').click();
    const area = list('words').querySelector('textarea');
    area.value = 'one\ntwo: three\n\nfour';
    change(area);
    assert.deepEqual(settings('odd').words, [{ word: 'one' }, { word: 'two: three' }, { word: 'four' }]);
    // The rows' own Add still works after going back.
    list('words').querySelector('.story-suite-list-toggle').click();
    list('words').querySelector('.story-suite-list-add').click();
    assert.equal(settings('odd').words.length, 4);
});

// ---- debug information in Diagnostics (live test: "the information, shouldn't those be under diagnostic?") ----

const coreFor = () => createCoreModule({ packs: packsFor({ extensionSettings: {} }) });
const report = { report: () => 'REPORT' };

test('the legacy story-suite-slider is gone: no code or rule draws it (the form engine has the slider)', () => {
    const hostUi = sourceOf('src/v2/host-ui.js');
    const css = cssOf('host');
    assert.doesNotMatch(hostUi, /story-suite-slider|sliderControl/);
    assert.doesNotMatch(css, /story-suite-slider/);
});
