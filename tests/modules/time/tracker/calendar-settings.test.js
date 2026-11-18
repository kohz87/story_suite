// The Calendar settings show the calendar in use (terms2, live test: "SD calendar should populate the field
// for calendar from pack if it's using pack, otherwise it's misleading"): with Calendar "pack" the fields
// show the pack's calendar and the choice's help names it; Custom starts from it; no pack: the built-in.
// Story Director alone and with the Ersveil pack.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHost } from '../../../../testkit/index.js';
import { createModule } from '../../../../modules/director/module.js';
import { CALENDAR_KEYS, calendarReadOnly, fieldHelp, gregorianFields, packCalendarFields, presetHelp } from '../../../../modules/time/tracker/calendar-settings.js';

const ERSVEIL = readFileSync(new URL('../../../fixtures/director/ersveil-bluewatch.pack.json', import.meta.url), 'utf8');

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
    assert.equal(presetHelp('pack', pack, 'Ersveil'), 'From the pack: Ersveil (CY, 2 months), shown below. Switch to Custom to edit it.');
    assert.match(presetHelp('pack', null), /No enabled pack has a calendar: the built-in Gregorian/);
    assert.match(presetHelp('custom', pack, 'Ersveil'), /Your own calendar/);
    assert.match(fieldHelp('pack', pack), /switch to Custom to edit/);
    assert.equal(fieldHelp('custom', pack), '');
    assert.equal(gregorianFields().months.length, 12);
});

test('alone, no pack: the fields show the built-in Gregorian calendar, as before', async t => {
    const { host, module } = await director(t);
    const values = host.sdk.settings('story-director');
    assert.equal(values[CALENDAR_KEYS.preset], 'pack');
    assert.equal(values[CALENDAR_KEYS.months][0].name, gregorianFields().months[0].name);
    assert.match(module.settings.schema[CALENDAR_KEYS.preset].help, /built-in Gregorian/);
    assert.equal(host.sdk.query('director.calendar').months?.length ?? 12, 12);
});

test('with the Ersveil pack: the fields show its calendar; Custom starts from it and runs on it; an edit is the reader\'s', async t => {
    const { host, module } = await director(t);
    assert.equal((await host.packs.packs.install(ERSVEIL, { origin: 'pack.json' })).ok, true);
    await Promise.resolve();
    const values = host.sdk.settings('story-director');
    const pack = JSON.parse(ERSVEIL).calendar;
    assert.equal(values[CALENDAR_KEYS.era], pack.era);
    assert.deepEqual(values[CALENDAR_KEYS.months], pack.months);
    assert.equal(values[CALENDAR_KEYS.leapYears], false);
    const help = module.settings.schema[CALENDAR_KEYS.preset].help;
    assert.match(help, /^From the pack: Ersveil: Bluewatch Starter \(CY, 12 months\), shown below\. Switch to Custom to edit it\.$/);
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

// Read-only while Calendar is pack: the pack's calendar runs and nothing is stored;
// under Custom the calendar starts from the pack's and an edit is the reader's.
test('while Calendar is pack the calendar fields are read-only; Custom makes them editable, pre-filled', async t => {
    assert.equal(calendarReadOnly({}), true, 'pack is the default');
    assert.equal(calendarReadOnly({ [CALENDAR_KEYS.preset]: 'pack' }), true);
    assert.equal(calendarReadOnly({ [CALENDAR_KEYS.preset]: 'custom' }), false);
    assert.equal(calendarReadOnly({ [CALENDAR_KEYS.preset]: 'gregorian' }), false);
    const { host } = await director(t);
    assert.equal((await host.packs.packs.install(ERSVEIL, { origin: 'pack.json' })).ok, true);
    await Promise.resolve();
    const pack = JSON.parse(ERSVEIL).calendar;
    assert.equal(host.sdk.query('director.calendar').era, pack.era, 'the pack\'s calendar runs');
    // Under pack, nothing of the calendar is stored.
    assert.equal(Object.hasOwn(host.settings.stored('story-director'), CALENDAR_KEYS.era), false);
    // Custom: the calendar still starts from the pack's, and an edit is the reader's.
    host.settings.set('story-director', CALENDAR_KEYS.preset, 'custom');
    assert.equal(host.sdk.query('director.calendar').era, pack.era);
    host.settings.set('story-director', CALENDAR_KEYS.era, 'AR');
    assert.equal(host.sdk.query('director.calendar').era, 'AR');
});

// The gap after Custom: the reader's own calendar is stored; back on pack, the read-only rows show the
// pack's (display only) and the stored one is kept, back when they switch to Custom again.
test('back on pack after editing under Custom: the chat runs on the pack\'s calendar; Custom brings the reader\'s back', async t => {
    const { host } = await director(t);
    assert.equal((await host.packs.packs.install(ERSVEIL, { origin: 'pack.json' })).ok, true);
    await Promise.resolve();
    const pack = JSON.parse(ERSVEIL).calendar;
    host.settings.set('story-director', CALENDAR_KEYS.preset, 'custom');
    host.settings.set('story-director', CALENDAR_KEYS.era, 'AR');
    host.settings.set('story-director', CALENDAR_KEYS.months, [{ name: 'Frostmoon', days: 30 }]);
    host.settings.set('story-director', CALENDAR_KEYS.preset, 'pack');
    assert.equal(host.settings.stored('story-director')[CALENDAR_KEYS.era], 'AR', 'the reader\'s own is kept');
    assert.equal(host.sdk.query('director.calendar').era, pack.era, 'and the chat runs on the pack\'s');
    host.settings.set('story-director', CALENDAR_KEYS.preset, 'custom');
    assert.deepEqual(host.sdk.query('director.calendar').months.map(month => month.name), ['Frostmoon'], 'Custom: the reader\'s calendar is back');
    assert.equal(host.sdk.query('director.calendar').era, 'AR');
});
