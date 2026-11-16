import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHost } from '../../../testkit/index.js';
import { mountUi } from '../../../ui/legacy/ui-host.js';
import { CORE_FEATURE } from '../../../core/features.js';
import { clockProps, gameHeroProps } from '../../../ui/legacy/view/game-header.js';
import { setupDom } from './mounts/helpers.js';
import { cssOf } from '../../core/helpers/css-parts.js';
import { LEAD, MONTHS, WHERE, draw, sent, settle } from './hero-scene.helpers.js';

test('an invalid field saves nothing and is named; a half-given date is refused in the words of the clock', async () => {
    const m = draw(LEAD);
    m.edit().click();
    m.box('Year (CY)').value = 'six';
    m.box('Weather').value = 'clear';
    m.save().click();
    await settle();
    assert.deepEqual(m.api.commands, []);
    assert.equal(m.error(), 'Year (CY): enter a whole number.');
    assert.ok(m.form());
    m.box('Year (CY)').value = '611';
    m.box('Time').value = '';
    m.save().click();
    await settle();
    assert.deepEqual(m.api.commands, []);
    assert.equal(m.error(), 'Pick a date and a time.');
    m.box('Time').value = '13:30';
    m.box('Day').value = '';
    m.save().click();
    await settle();
    assert.equal(m.error(), 'Day: enter a whole number.', 'a date field that had a value cannot be emptied');
    // An unset clock left alone is not an error for an edit of something else.
    const unset = draw({ ...LEAD, clock: { parts: null, era: 'CY', months: MONTHS } });
    unset.edit().click();
    unset.box('Weather').value = 'clear';
    unset.save().click();
    await settle();
    assert.deepEqual(sent(unset.api), [['scene.weather', { text: 'clear' }]], 'blank date and time fields that stayed blank send no clock');
    // ... and a date given in part is refused whole.
    unset.edit().click();
    unset.box('Year (CY)').value = '611';
    unset.save().click();
    await settle();
    assert.equal(unset.error(), 'Pick a date and a time.');
    assert.equal(sent(unset.api).length, 1);
    unset.box('Month').value = '5';
    unset.box('Day').value = '12';
    unset.box('Time').value = '06:40';
    unset.save().click();
    await settle();
    assert.deepEqual(sent(unset.api).at(-1), ['director.clock', { year: 611, month: 5, day: 12, minutes: 400 }]);
});

test('a redraw keeps an open editor and what was typed; the lines change behind it', () => {
    const m = draw(LEAD);
    m.edit().click();
    m.box('Weather').value = 'clear';
    const form = m.form();
    m.handle.update({ ...LEAD, place: 'The Weir', where: { ...WHERE, place: 'The Weir', present: ['Fenna'] } });
    assert.equal(m.words('place'), 'The Weir');
    assert.equal(m.form(), form, 'the same open form');
    assert.equal(m.box('Weather').value, 'clear');
    assert.deepEqual(m.kinds(), ['time', 'place', 'weather', 'here'], 'the same lines in the same order');
});

test('the words are cut for the corner, never the place the editor starts from; Here is cut at 120', () => {
    const long = 'P'.repeat(60);
    const m = draw({ name: 'Wessel', place: long, where: { present: Array.from({ length: 12 }, (_, at) => `Person${at}-${'x'.repeat(10)}`), places: [], weatherOn: true, place: long } });
    assert.equal(m.words('place').length, 40, 'the corner shows 40');
    m.edit().click();
    assert.equal(m.box('Place').value, long, 'the edit starts from the whole name');
    assert.ok(m.words('here').length <= 'Here: '.length + 120);
});

test('gameHeroProps reads the editor\'s data: the people, the pack\'s places, whether the weather feature is on', () => {
    const answers = { 'scene.place': { name: 'Bluewatch Village' }, 'scene.weather': { text: 'rain' }, 'scene.present': ['Fenna', ' ', 'Ivo'], 'packs.content': [{ name: 'The Weir' }] };
    const asked = [];
    const query = (name, args) => { asked.push([name, args]); return answers[name] ?? null; };
    const props = gameHeroProps({ state: {}, query, context: { personaName: 'Wessel' } });
    assert.deepEqual(props.where, { present: ['Fenna', 'Ivo'], places: [{ name: 'The Weir' }], weatherOn: true, place: 'Bluewatch Village', weatherText: 'rain' });
    assert.deepEqual(asked.find(([name]) => name === 'packs.content')[1], { kind: 'places' });
    assert.equal(gameHeroProps({ state: {}, query, context: {}, weatherOn: false }).where.weatherOn, false);
    const bare = gameHeroProps({ state: {}, query: () => null, context: {} });
    assert.deepEqual(bare.where, { present: [], places: [], weatherOn: true, place: '', weatherText: '' });
    assert.equal('clock' in bare, false, 'no Story Director: no clock');
});

test('gameHeroProps gives the clock only when Story Director answers `parts` and a calendar with months', () => {
    const calendar = { era: 'CY', months: MONTHS, leapYears: null };
    const ask = (time, cal = calendar) => gameHeroProps({ state: {}, context: {}, query: name => (name === 'director.time' ? time : name === 'director.calendar' ? cal : null) });
    const parts = { year: 611, month: 5, day: 12, minutes: 810 };
    assert.deepEqual(ask({ minutes: 123, text: 'x', parts }).clock, { parts, era: 'CY', months: MONTHS });
    assert.deepEqual(ask({ minutes: null, text: '', parts: null }).clock, { parts: null, era: 'CY', months: MONTHS }, 'an unset clock: the fields start empty');
    assert.equal('clock' in ask({ minutes: 123, text: 'x' }), false, 'an older Story Director (no `parts`): no date or time fields');
    assert.equal('clock' in ask({ minutes: 1, parts }, null), false, 'no calendar answer');
    assert.equal('clock' in ask({ minutes: 1, parts }, { era: 'CY', months: [] }), false, 'no months');
    assert.equal(clockProps({ parts: { year: 611, month: 9, day: 1, minutes: 5 } }, calendar).parts, null, 'a month past the calendar\'s is not taken');
    assert.equal(clockProps({ parts: { year: 611, month: 5, day: 12, minutes: 1440 } }, calendar).parts, null, 'minutes past the day\'s end are not taken');
    assert.deepEqual(clockProps({ parts: null }, { months: [{ name: ' Frost ', days: 28.5 }, { name: 'Thaw', days: 30 }, { name: '', days: 5 }] }).months, [{ name: 'Thaw', days: 30 }]);
});

test('the page: the header\'s one editor changes the scene through the real commands, there is no pencil on the header, and Home has no Where card under the header', async t => {
    t.mock.method(console, 'warn', () => {});
    const doc = setupDom(), form = doc.createElement('div');
    form.id = 'send_form';
    doc.body.appendChild(form);
    const h = await createHost();
    const ui = mountUi({ runtime: h, ctx: h.ctx, doc });
    t.after(() => { ui.destroy(); h.close(); });
    await h.send('Look.', 'The road.\n\n<Changes>\n~ place Vell Harbour | kind: settlement\n~ weather cold drizzle\n+ present Fenna\n</Changes>');
    assert.equal(ui.mounts.screen.open('story-block/home'), true);
    const words = kind => doc.querySelector(`.ss-gameview-hero .ss-hero-corner-item[data-kind="${kind}"] .ss-hero-corner-text`)?.textContent;
    assert.equal(words('place'), 'Vell Harbour');
    assert.equal(words('weather'), 'cold drizzle');
    assert.equal(words('here'), 'Here: Fenna');
    assert.equal(doc.querySelector('.ss-gameview-body section.scene'), null, 'the header has the scene: Home has no Where card');
    assert.equal(doc.querySelectorAll('.ss-gameview-hero button.ss-w-editable-pencil').length, 0, 'no pencil on the header');
    assert.equal(doc.querySelectorAll('.ss-gameview-hero .ss-hero-edit').length, 1, 'one Edit button');
    const box = label => doc.querySelector(`.ss-gameview-hero .ss-hero-editor [aria-label="${label}"]`);
    doc.querySelector('.ss-gameview-hero .ss-hero-edit').click();
    // Story Block alone: no Story Director, so no date or time fields; no `~ you` yet but the feature is on: the Character group is there.
    assert.equal(box('Year'), null);
    assert.equal(box('Time'), null);
    assert.equal(box('Place').value, 'Vell Harbour');
    assert.equal(box('Weather').value, 'cold drizzle');
    assert.equal(box('Here').value, 'Fenna');
    box('Here').value = 'Fenna, Ivo';
    box('Weather').value = 'clear sky';
    box('Wearing').value = 'oilskin coat';
    doc.querySelector('.ss-gameview-hero .ss-hero-editor .ss-w-editable-save').click();
    await settle();
    assert.deepEqual(h.sdk.query('scene.present'), ['Fenna', 'Ivo']);
    assert.equal(h.sdk.query('scene.weather').text, 'clear sky');
    assert.equal(h.sdk.query('scene.you').wearing, 'oilskin coat');
    assert.equal(h.sdk.query('scene.place').name, 'Vell Harbour', 'the place was left as it was');
    assert.equal(doc.querySelector('.ss-gameview-hero .ss-hero-editor .ss-w-editable-form'), null, 'closed');
    assert.equal(words('here'), 'Here: Fenna, Ivo');
    assert.equal(words('weather'), 'clear sky');
    assert.equal(doc.querySelector('.ss-gameview-hero [data-part="wearing"] .ss-hero-you-text').textContent, 'oilskin coat');
    // The weather feature off: the header leaves it out, and its field with it.
    h.features.set(CORE_FEATURE.weather, false);
    await settle();
    ui.mounts.screen.update();
    assert.equal(words('weather'), undefined);
    doc.querySelector('.ss-gameview-hero .ss-hero-edit').click();
    assert.equal(box('Weather'), null);
    assert.ok(box('Place'));
});

test('the header\'s one Edit button is a pill in the corner (a phone: beside the name), the editor stacks its groups on a phone, and the lines it edits are hidden while it is open', () => {
    const css = cssOf('glass');
    const widgetCss = readFileSync(new URL('../../../ui/legacy/view/widgets/styles.js', import.meta.url), 'utf8');
    const rule = selector => {
        const at = css.indexOf(`${selector} {`);
        assert.ok(at >= 0, `${selector} has a rule`);
        return css.slice(at, css.indexOf('}', at));
    };
    assert.match(rule('.ss-hero-corner-text'), /overflow-wrap: anywhere;/);
    assert.doesNotMatch(rule('.ss-hero-corner-text'), /white-space: nowrap|text-overflow/, 'not cut, not one line');
    assert.match(rule('.ss-hero-compact .ss-hero-corner'), /flex-wrap: wrap;/);
    assert.match(rule('.ss-hero-compact .ss-hero-corner'), /gap: 6px 10px;/);
    assert.doesNotMatch(rule('.ss-hero-compact .ss-hero-corner'), /overflow: hidden/);
    assert.doesNotMatch(rule('.ss-hero-compact .ss-hero-corner-text'), /ellipsis|nowrap/, 'no "Bluewatch Vi…"');
    assert.doesNotMatch(css, /ss-hero-corner-pencil|ss-hero-you-pencil/, 'no pencil rules left for the header');
    assert.match(rule('.ss-hero-head'), /display: flex;/);
    assert.match(rule('.ss-hero-head .ss-hero-edit'), /margin: 0 0 0 auto;/, 'at the far right of the name row (heavier than the chip\'s own margin: 0)');
    // small and quiet: the drawn height is the line (14px) + the padding (4px x 2) + the edge (1px x 2) = 24px, in the meta lines' 12px text
    const pill = rule('.ss-hero-head .ss-hero-edit');
    const px = name => Number(new RegExp(`${name}: (\\d+)px`).exec(pill)?.[1]);
    assert.equal(px('font-size'), 12);
    assert.equal(px('line-height'), 14);
    assert.match(pill, /padding: 4px 8px;/);
    assert.match(pill, /border: 1px solid color-mix\(in srgb, var\(--ss-muted\) 35%, transparent\);/, 'a faint edge at rest');
    assert.match(pill, /min-height: 0;/);
    const drawn = px('line-height') + 2 * 4 + 2 * 1;
    assert.ok(drawn >= 22 && drawn <= 24, `drawn ${drawn}px tall`);
    assert.equal(drawn, 24);
    assert.match(rule('.ss-hero-edit-icon'), /width: 12px;\s*height: 12px;/);
    // the invisible tap area: 44px tall, as wide as the button (never wider: it cannot reach the name or the close button), opted out of the 44px minimum
    const tap = rule('.ss-hero-head .ss-hero-edit::after');
    assert.match(tap, /height: calc\(44px \/ var\(--ss-zoomed, 1\)\);/);
    assert.match(tap, /left: 0;\s*right: 0;/);
    assert.match(tap, /top: 50%;/);
    assert.match(pill, /position: relative;/);
    assert.match(rule('.ss-hero-head .ss-hero-edit:hover,\n:where(.story-suite-overlay, .story-suite-sheet, .ss-gameview, .ss-dialog, .ss-cards, .ss-card, .ss-hud, [data-ss-screen], .story-suite-bar, .story-suite-extras, .story-suite-reply-note, .ss-send-note, .rpg-fight-offer, .rpg-fight-pause) .ss-hero-head .ss-hero-edit:focus-visible,\n:where(.story-suite-overlay, .story-suite-sheet, .ss-gameview, .ss-dialog, .ss-cards, .ss-card, .ss-hud, [data-ss-screen], .story-suite-bar, .story-suite-extras, .story-suite-reply-note, .ss-send-note, .rpg-fight-offer, .rpg-fight-pause) .ss-hero-head .ss-hero-edit[aria-expanded="true"]'), /border-color: var\(--ss-accent\);/, 'the accent on hover, focus and while open');
    assert.match(rule('.ss-hero-head .ss-hero-edit:focus-visible'), /outline: 2px solid var\(--ss-accent\);/, 'a visible focus ring');
    assert.equal(draw(LEAD).edit().getAttribute('data-ss-hit'), '', 'opted out of the 44px minimum: it draws its own tap area');
    assert.match(rule('.ss-hero-has-edit .ss-hero-head'), /width: 100%;/, 'the name row is the whole width, so the button is at its far right');
    assert.match(rule('.ss-hero-has-edit .ss-hero-head .ss-hero-name'), /overflow: hidden;\s*text-overflow: ellipsis;\s*white-space: nowrap;/, 'a long name is cut before the button, never wrapped under it');
    assert.match(rule('.ss-hero-has-edit .ss-hero-head .ss-hero-name'), /min-width: 0;/);
    assert.match(css, /@container \(min-width: 600px\) \{[^@]*\.ss-hero-edit \{\s*position: absolute;\s*top: 10px;\s*right: 12px;/, 'the card\'s top-right corner from 600px');
    assert.match(rule('.ss-hero.ss-hero-editing .ss-hero-corner,\n:where(.story-suite-overlay, .story-suite-sheet, .ss-gameview, .ss-dialog, .ss-cards, .ss-card, .ss-hud, [data-ss-screen], .story-suite-bar, .story-suite-extras, .story-suite-reply-note, .ss-send-note, .rpg-fight-offer, .rpg-fight-pause) .ss-hero.ss-hero-editing .ss-hero-you'), /display: none;/, 'over the compact header\'s own corner rules');
    assert.match(css, /@media \(max-width: 600px\) \{\s*:where\([^)]*\) \.ss-hero-editor \.ss-w-editable-groups \{\s*grid-template-columns: minmax\(0, 1fr\);/, 'the groups stack on a phone');
    assert.match(widgetCss, /:where\(\.ss-w-editable-groups\) \{ display: grid; grid-template-columns: minmax\(0, 1\.6fr\) minmax\(0, 1fr\);/);
});
