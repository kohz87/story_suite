// The Calendar settings show the calendar in use (terms2, live test: "SD calendar should populate the field
// for calendar from pack if it's using pack, otherwise it's misleading"): with Calendar "pack" the fields
// show the pack's calendar and the choice's help names it; Custom starts from it; no pack: the built-in.
// Story Director alone and with the Ersveil pack.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../../testkit/index.js';
import { createModule } from '../../../../modules/director/module.js';
import { CALENDAR_KEYS, calendarReadOnly, fieldHelp, gregorianFields, packCalendarFields, presetHelp } from '../../../../modules/time/tracker/calendar-settings.js';
import { installFakeDom } from '../../../helpers/director/ui-fake-dom.js';
import { renderSettingsHost } from '../../../../ui/legacy/host-ui.js';
import { installBluewatch, BLUEWATCH_GAME, BLUEWATCH_WORLD } from '../../../fixtures/director/bluewatch.js';
// The era is written once, in the world's start date; the game's calendar leaves it out.
const ERA = JSON.parse(BLUEWATCH_WORLD).content.start.date.era;


async function director(t) {
    t.mock.method(console, 'warn', () => {});
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text), query: (name, args) => host?.sdk.query(name, args) } });
    host = await createHost({ modules: [module] });
    t.after(() => host.close());
    return { host, module };
}

test('the words: where the calendar comes from, and read-only fields unless Custom', () => {
    const pack = { pack: 'e', era: 'CY', months: [{ name: 'Dawnwane', days: 30 }, { name: 'Rainmoot', days: 30 }] };
    assert.deepEqual(packCalendarFields(pack), { era: 'CY', months: pack.months, leapYears: false, week: '' });
    assert.equal(packCalendarFields(null), null);
    assert.equal(presetHelp('game', pack, 'Ersveil'), 'From the game pack: Ersveil (CY, 2 months), shown below. Switch to Custom to edit it.');
    assert.match(presetHelp('game', null), /The game has no calendar of its own: the built-in Gregorian/);
    assert.match(presetHelp('custom', pack, 'Ersveil'), /Your own calendar/);
    assert.match(fieldHelp('game', pack), /switch to Custom to edit/);
    assert.equal(fieldHelp('custom', pack), '');
    assert.equal(gregorianFields().months.length, 12);
});

test('alone, no pack: the fields show the built-in Gregorian calendar, as before', async t => {
    const { host, module } = await director(t);
    const values = host.sdk.settings('story-director');
    assert.equal(values[CALENDAR_KEYS.preset], 'game');
    assert.equal(values[CALENDAR_KEYS.months][0].name, gregorianFields().months[0].name);
    assert.match(module.settings.schema[CALENDAR_KEYS.preset].help, /built-in Gregorian/);
    assert.equal(host.sdk.query('director.calendar').months?.length ?? 12, 12);
});

test('with the Ersveil pack: the fields show its calendar; Custom starts from it and runs on it; an edit is the reader\'s', async t => {
    const { host, module } = await director(t);
    assert.equal((await installBluewatch(host.packs.packs)).ok, true);
    await Promise.resolve();
    const values = host.sdk.settings('story-director');
    const pack = JSON.parse(BLUEWATCH_GAME).content.calendar;
    assert.equal(values[CALENDAR_KEYS.era], ERA);
    assert.deepEqual(values[CALENDAR_KEYS.months], pack.months);
    assert.equal(values[CALENDAR_KEYS.leapYears], false);
    const help = module.settings.schema[CALENDAR_KEYS.preset].help;
    assert.match(help, /^From the game pack: Ersveil: Bluewatch Starter rules \(CY, 12 months\), shown below\. Switch to Custom to edit it\.$/);
    assert.match(module.settings.schema[CALENDAR_KEYS.months].help, /switch to Custom to edit/);
    // Custom, nothing typed yet: the pack's calendar, so the story's dates do not jump.
    host.settings.set('story-director', CALENDAR_KEYS.preset, 'custom');
    await Promise.resolve();
    assert.equal(host.sdk.query('director.calendar').era, 'CY');
    assert.equal(module.settings.schema[CALENDAR_KEYS.months].help ?? '', '');
    // A field the reader edits is theirs.
    host.settings.set('story-director', CALENDAR_KEYS.era, 'AR');
    assert.equal(host.sdk.query('director.calendar').era, 'AR');
    assert.deepEqual(host.sdk.settings('story-director')[CALENDAR_KEYS.months], pack.months, 'the rest still the pack\'s');
});

// Read-only while Calendar is pack (Story Block's settings `readOnly`): shown, help and all, but not
// editable; switching to Custom makes them editable and pre-filled with the pack's calendar.
test('while Calendar is pack the calendar fields are read-only; Custom makes them editable, pre-filled', async t => {
    assert.equal(calendarReadOnly({}), true, 'pack is the default');
    assert.equal(calendarReadOnly({ [CALENDAR_KEYS.preset]: 'game' }), true);
    assert.equal(calendarReadOnly({ [CALENDAR_KEYS.preset]: 'pack' }), true, 'format 3 stored pack: read as game');
    assert.equal(calendarReadOnly({ [CALENDAR_KEYS.preset]: 'custom' }), false);
    assert.equal(calendarReadOnly({ [CALENDAR_KEYS.preset]: 'gregorian' }), false);
    const doc = installFakeDom();
    const { host } = await director(t);
    assert.equal((await installBluewatch(host.packs.packs)).ok, true);
    await Promise.resolve();
    const pack = JSON.parse(BLUEWATCH_GAME).content.calendar;
    const root = doc.createElement('div');
    doc.body.appendChild(root);
    t.after(() => root.remove());
    renderSettingsHost(root, { registry: host.registry, settings: host.settings, doc });
    const row = key => root.querySelector(`.story-suite-row[data-field="${key}"]`);
    const controls = key => row(key).querySelectorAll('input, select, textarea, button');
    const fields = [CALENDAR_KEYS.era, CALENDAR_KEYS.months, CALENDAR_KEYS.leapYears, CALENDAR_KEYS.week];
    for (const key of fields) {
        assert.equal(row(key).dataset.readonly, 'true', key);
        assert.ok(controls(key).length && controls(key).every(node => node.disabled === true), key);
        assert.match(row(key).textContent, /switch to Custom to edit/, `${key}: its help says why`);
    }
    assert.equal(row(CALENDAR_KEYS.era).querySelector('input').value, ERA, 'the pack\'s calendar is shown');
    assert.notEqual(row(CALENDAR_KEYS.preset).querySelector('select').disabled, true);
    // Typing into a read-only field stores nothing.
    const era = row(CALENDAR_KEYS.era).querySelector('input');
    era.value = 'XX';
    era.dispatch('change');
    assert.equal(Object.hasOwn(host.settings.stored('story-director'), CALENDAR_KEYS.era), false);
    // Custom: editable, pre-filled with the pack's calendar.
    const select = row(CALENDAR_KEYS.preset).querySelector('select');
    select.value = 'custom';
    select.dispatch('change');
    for (const key of fields) {
        assert.notEqual(row(key).dataset.readonly, 'true', key);
        assert.ok(controls(key).every(node => node.disabled !== true), key);
    }
    assert.equal(row(CALENDAR_KEYS.era).querySelector('input').value, ERA);
    const input = row(CALENDAR_KEYS.era).querySelector('input');
    input.value = 'AR';
    input.dispatch('change');
    assert.equal(host.sdk.query('director.calendar').era, 'AR');
});

// The gap after Custom: the reader's own calendar is stored; back on pack, the read-only rows show the
// pack's (display only) and the stored one is kept, back when they switch to Custom again.
test('back on pack after editing under Custom: the rows show the pack\'s calendar; Custom brings the reader\'s back', async t => {
    const doc = installFakeDom();
    const { host } = await director(t);
    assert.equal((await installBluewatch(host.packs.packs)).ok, true);
    await Promise.resolve();
    const pack = JSON.parse(BLUEWATCH_GAME).content.calendar;
    host.settings.set('story-director', CALENDAR_KEYS.preset, 'custom');
    host.settings.set('story-director', CALENDAR_KEYS.era, 'AR');
    host.settings.set('story-director', CALENDAR_KEYS.months, [{ name: 'Frostmoon', days: 30 }]);
    host.settings.set('story-director', CALENDAR_KEYS.preset, 'game');
    const root = doc.createElement('div');
    doc.body.appendChild(root);
    t.after(() => root.remove());
    renderSettingsHost(root, { registry: host.registry, settings: host.settings, doc });
    const row = key => root.querySelector(`.story-suite-row[data-field="${key}"]`);
    const monthNames = () => row(CALENDAR_KEYS.months).querySelectorAll('.story-suite-list-item input').filter(input => input.type === 'text').map(input => input.value);
    const monthsText = () => row(CALENDAR_KEYS.months).querySelector('textarea')?.value ?? null;
    const shownMonths = () => monthNames().length ? monthNames() : (monthsText() ?? '').split('\n').map(line => line.split(':')[0].trim());
    assert.equal(row(CALENDAR_KEYS.era).querySelector('input').value, ERA, 'the pack\'s era, not the stored AR');
    assert.deepEqual(shownMonths(), pack.months.map(month => month.name));
    assert.equal(host.settings.stored('story-director')[CALENDAR_KEYS.era], 'AR', 'the reader\'s own is kept');
    assert.equal(host.sdk.query('director.calendar').era, ERA, 'and the chat runs on the pack\'s');
    const select = row(CALENDAR_KEYS.preset).querySelector('select');
    select.value = 'custom';
    select.dispatch('change');
    assert.equal(row(CALENDAR_KEYS.era).querySelector('input').value, 'AR', 'Custom: the reader\'s calendar is back');
    assert.deepEqual(shownMonths(), ['Frostmoon']);
    assert.equal(host.sdk.query('director.calendar').era, 'AR');
});
