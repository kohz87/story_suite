// The game view's header is the one place for the scene (view/widgets/hero.js `where`, view/game-header.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { LEAD, MONTHS, WHERE, answering, draw, sent, settle } from './hero-scene.helpers.js';

test('the corner: time, place, weather, then Here with the people, as plain lines: no pencil anywhere in the card, ONE Edit button', () => {
    const { el, kinds, words, edit } = draw(LEAD);
    assert.deepEqual(kinds(), ['time', 'place', 'weather', 'here']);
    assert.equal(words('time'), 'CY 611, Goldwane 12, 1:30 pm');
    assert.equal(words('place'), 'Bluewatch Village');
    assert.equal(words('weather'), 'heavy rain, rising river');
    assert.equal(words('here'), 'Here: Fenna, Hooded courier');
    assert.equal(el.querySelectorAll('button.ss-w-editable-pencil').length, 0, 'no pencil button');
    for (const name of ['ss-hero-corner-pencil', 'ss-hero-you-pencil', 'ss-w-editable-pencil']) assert.equal(el.querySelector(`.${name}`), null, name);
    assert.equal(el.querySelectorAll('button').length, 1, 'the one button of the card is Edit');
    assert.equal(el.querySelectorAll('.ss-hero-you-part').map(part => part.querySelector('.ss-hero-you-text').textContent).join('|'), 'F-rank|oilskin coat|soaked');
    assert.equal(edit().querySelector('.ss-hero-edit-text').textContent, 'Edit');
    assert.ok(edit().querySelector('svg') || edit().querySelector('i'), 'a pencil icon');
    assert.equal(edit().getAttribute('aria-label'), 'Edit the story and your character');
    assert.equal(edit().getAttribute('title'), 'Edit the story and your character');
    assert.equal(edit().getAttribute('aria-expanded'), 'false');
    assert.equal(edit().parentNode.className, 'ss-hero-head', 'beside the name (CSS puts it in the corner from 600px)');
});

test('an empty place, weather or Here still shows (plain); the time does not', () => {
    const { kinds, words, item, el } = draw({ name: 'Wessel', where: { present: [], places: [], weatherOn: true } });
    assert.deepEqual(kinds(), ['place', 'weather', 'here']);
    assert.equal(words('place'), 'Somewhere not yet named');
    assert.equal(words('weather'), '\u2014');
    assert.equal(words('here'), 'Here: \u2014');
    assert.ok(item('place').classList.contains('ss-hero-corner-empty'));
    assert.equal(el.querySelectorAll('button.ss-w-editable-pencil').length, 0);
});

test('the weather feature off: no weather line and no Weather field, even where the story still has weather words', () => {
    const m = draw({ ...LEAD, where: { ...WHERE, weatherOn: false } });
    assert.deepEqual(m.kinds(), ['time', 'place', 'here']);
    assert.equal(m.item('weather'), null);
    m.edit().click();
    assert.equal(m.box('Weather'), null);
    assert.ok(m.box('Place'));
});

test('without `where` the card is what it was: read-only corner, no Here item, no Edit button, no editor', () => {
    const m = draw({ name: 'Ren', place: 'Weir', time: 'Day 2', weather: 'Fog' });
    assert.deepEqual(m.kinds(), ['time', 'place', 'weather']);
    assert.equal(m.edit(), null);
    assert.equal(m.el.querySelectorAll('button').length, 0);
    assert.deepEqual(draw({ name: 'Ren' }).kinds(), [], 'nothing to say: no corner items');
    assert.ok(draw({ name: 'Ren', where: WHERE, compact: true }).edit(), 'the header is compact on a phone and has it; the strip under a reply has no `where`');
    const gone = draw(LEAD);
    gone.handle.update({ name: 'Ren' });
    assert.equal(gone.edit(), null, 'the button goes with `where`');
});

test('Edit opens the one editor: Story (Year (CY), Month, Day, Time, Place, Weather, Here) and Character (Rank, Wearing, Condition), the help line, Save and Cancel', () => {
    const m = draw(LEAD);
    assert.equal(m.form(), null);
    m.edit().click();
    assert.ok(m.form(), 'open');
    assert.equal(m.edit().getAttribute('aria-expanded'), 'true');
    assert.ok(m.el.querySelector('.ss-hero').classList.contains('ss-hero-editing'), 'the lines it edits are hidden (CSS) while it is open');
    assert.deepEqual(m.legends(), ['Story', 'Character']);
    assert.deepEqual(m.labels(), ['Year (CY)', 'Month', 'Day', 'Time', 'Place', 'Weather', 'Here', 'Guild rank', 'Wearing', 'Condition']);
    assert.equal(m.form().getAttribute('role'), 'group');
    assert.equal(m.form().getAttribute('aria-label'), 'Edit the story and your character');
    assert.equal(m.el.querySelector('.ss-w-editable-help').textContent, 'Changes apply from this reply on.');
    assert.equal(m.save().textContent, 'Save');
    assert.equal(m.cancel().textContent, 'Cancel');
    // the starting values
    assert.equal(m.box('Year (CY)').value, '611');
    assert.equal(m.box('Month').localName, 'select');
    assert.deepEqual(m.box('Month').querySelectorAll('option').map(option => option.textContent), MONTHS.map(month => month.name));
    assert.equal(m.box('Month').value, '5');
    assert.equal(m.box('Day').value, '12');
    assert.equal(m.box('Time').getAttribute('type'), 'time');
    assert.equal(m.box('Time').value, '13:30');
    assert.equal(m.box('Place').value, 'Bluewatch Village');
    assert.equal(m.box('Weather').value, 'heavy rain, rising river');
    assert.equal(m.box('Here').value, 'Fenna, Hooded courier', 'the people as a comma text field');
    assert.equal(m.box('Wearing').value, 'oilskin coat');
    assert.equal(m.el.querySelectorAll('.ss-hero-editor datalist option').map(option => option.value).join('|'), 'Bluewatch Village|The Weir', 'the pack\'s places are suggested');
    // a second click on Edit changes nothing (one editor)
    m.edit().click();
    assert.equal(m.el.querySelectorAll('.ss-hero-editor .ss-w-editable-form').length, 1);
});

test('no Story Director (no clock): no Year, Month, Day or Time; the Story group keeps Place, Weather and Here; no `you`: no Character group; no pack Rank: no Rank', () => {
    const bare = { name: 'Wessel', where: WHERE };
    const m = draw(bare);
    m.edit().click();
    assert.deepEqual(m.legends(), ['Story']);
    assert.deepEqual(m.labels(), ['Place', 'Weather', 'Here']);
    const noRank = draw({ ...LEAD, clock: null, you: { wearing: 'a coat', condition: '', command: 'scene.you' } });
    noRank.edit().click();
    assert.deepEqual(noRank.legends(), ['Story', 'Character']);
    assert.deepEqual(noRank.labels(), ['Place', 'Weather', 'Here', 'Wearing', 'Condition']);
    // A calendar with no era says just "Year"; an unset clock starts the date and time empty.
    const unset = draw({ ...LEAD, clock: { parts: null, era: '', months: MONTHS } });
    unset.edit().click();
    assert.equal(unset.labels()[0], 'Year');
    assert.equal(unset.box('Year').value, '');
    assert.equal(unset.box('Day').value, '');
    assert.equal(unset.box('Time').value, '');
    assert.equal(unset.box('Month').querySelectorAll('option').length, MONTHS.length + 1, 'a blank first choice');
});

test('Save with nothing changed closes and sends nothing; Cancel and Escape close without saving; focus returns to the Edit button', async () => {
    const m = draw(LEAD);
    m.edit().click();
    m.save().click();
    await settle();
    assert.deepEqual(m.api.commands, []);
    assert.equal(m.form(), null, 'closed');
    assert.equal(m.edit().getAttribute('aria-expanded'), 'false');
    assert.equal(m.doc.activeElement, m.edit());
    assert.equal(m.el.querySelector('.ss-hero').classList.contains('ss-hero-editing'), false);
    m.edit().click();
    m.box('Weather').value = 'clear';
    m.cancel().click();
    assert.equal(m.form(), null);
    assert.deepEqual(m.api.commands, []);
    assert.equal(m.doc.activeElement, m.edit());
    m.edit().click();
    m.box('Day').value = '14';
    m.box('Day').dispatch('keydown', { key: 'Escape' });
    assert.equal(m.form(), null);
    assert.deepEqual(m.api.commands, []);
    assert.equal(m.doc.activeElement, m.edit());
    m.edit().click();
    assert.equal(m.box('Day').value, '12', 'reopened from the card\'s own values, not the abandoned edit');
});

test('Save sends the commands of the changed fields only: the clock first, then place, weather, here, you', async () => {
    const m = draw(LEAD);
    m.edit().click();
    m.box('Year (CY)').value = '612';
    m.box('Month').value = '2';
    m.box('Day').value = '14';
    m.box('Time').value = '18:00';
    m.box('Wearing').value = 'a dry cloak';
    m.box('Guild rank').value = 'E-rank';
    m.box('Here').value = 'Fenna, Ivo';
    m.box('Weather').value = 'clear';
    m.box('Place').value = 'The Weir';
    m.save().click();
    await settle();
    assert.deepEqual(sent(m.api), [
        ['director.clock', { year: 612, month: 2, day: 14, minutes: 1080 }],
        ['scene.place', { with: ['Fenna', 'Hooded courier'], name: 'The Weir' }],
        ['scene.weather', { text: 'clear' }],
        ['scene.present', { set: ['Fenna', 'Ivo'] }],
        ['scene.you', { rank: 'E-rank', wearing: 'a dry cloak' }],
    ]);
    assert.equal(m.form(), null, 'closed after the last one went through');
    assert.equal(m.doc.activeElement, m.edit());
});

test('one changed field sends one command (a day alone still sends the whole date and time, which is one command); an unchanged field sends nothing', async () => {
    const m = draw(LEAD);
    m.edit().click();
    m.box('Day').value = '13';
    m.save().click();
    await settle();
    assert.deepEqual(sent(m.api), [['director.clock', { year: 611, month: 5, day: 13, minutes: 810 }]]);
    m.edit().click();
    m.box('Condition').value = 'rested';
    m.box('Here').value = ' Fenna ,Hooded courier ';
    m.save().click();
    await settle();
    assert.deepEqual(sent(m.api).slice(1), [['scene.you', { condition: 'rested' }]], 'the same people with other spaces are no change');
    m.edit().click();
    m.box('Weather').value = '';
    m.save().click();
    await settle();
    assert.deepEqual(sent(m.api).at(-1), ['scene.weather', { text: '' }], 'a cleared field is a change, as the weather pencil did');
});

test('a refused clock names its sentence under the fields, keeps the editor open and sends nothing else', async () => {
    const api = answering({ 'director.clock': { ok: false, message: 'Goldwane has 30 days.' } });
    const m = draw(LEAD, api);
    m.edit().click();
    m.box('Day').value = '31';
    m.box('Weather').value = 'clear';
    m.box('Wearing').value = 'a cloak';
    m.save().click();
    await settle();
    assert.deepEqual(sent(api), [['director.clock', { year: 611, month: 5, day: 31, minutes: 810 }]], 'the clock was first, and nothing after it');
    assert.equal(m.error(), 'Goldwane has 30 days.');
    assert.ok(m.form(), 'still open');
    assert.equal(m.box('Weather').value, 'clear', 'what was typed is kept');
    assert.equal(m.save().disabled, false);
    // Fixed: the next Save sends everything that is still to send.
    m.box('Day').value = '13';
    api.command = (type, payload) => { api.commands.push({ type, payload }); return Promise.resolve({ ok: true }); };
    m.save().click();
    await settle();
    assert.deepEqual(sent(api).slice(1).map(([type]) => type), ['director.clock', 'scene.weather', 'scene.you']);
    assert.equal(m.form(), null);
});

test('a refusal later in the order stops the rest, keeps the editor open, and a step that went through is not sent again', async () => {
    const api = answering({ 'scene.weather': { ok: false, message: 'The weather has no words.' } });
    const m = draw(LEAD, api);
    m.edit().click();
    m.box('Day').value = '13';
    m.box('Place').value = 'The Weir';
    m.box('Weather').value = '???';
    m.box('Here').value = 'Ivo';
    m.box('Condition').value = 'rested';
    m.save().click();
    await settle();
    assert.deepEqual(sent(api).map(([type]) => type), ['director.clock', 'scene.place', 'scene.weather'], 'present and you were not sent');
    assert.equal(m.error(), 'The weather has no words.');
    assert.ok(m.form());
    m.box('Weather').value = 'clear';
    api.command = (type, payload) => { api.commands.push({ type, payload }); return Promise.resolve({ ok: true }); };
    m.save().click();
    await settle();
    assert.deepEqual(sent(api).slice(3).map(([type]) => type), ['scene.weather', 'scene.present', 'scene.you'], 'the clock and the place went through: not again');
    assert.equal(m.form(), null);
});
