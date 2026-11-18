// World events, the tempo setting on the real host: the daily step runs at `chronicle.tempo` (0.25-4), a bad value is tempo 1, a value out of range
// is named in Problems, and replay == live with the setting changed afterwards. The query for the World tab and the Settings count.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { newHost, reply, SPEC } from './daily-host.helpers.js';
import { tempoOf } from '../../../../modules/world/chronicle/world-daily/tempo.js';

// Only the levy: the omen's roll (a chance, over the region) would put a second condition here some of the time.
const LEVY = { ...SPEC, events: SPEC.events.filter(event => event.id === 'levy') };
const settingsOf = tempo => ({ modules: { 'story-director': { 'tracker.maxJump': 60, ...(tempo === undefined ? {} : { 'chronicle.tempo': tempo }) } } });
const unrest = host => Object.values(host.head().domains.chronicle.conditions ?? {}).map(entry => entry.name);
const levy = host => host.sdk.query('chronicle.events', {}).map(entry => entry.state);

// The levy ends 3 days after it fires (a window of 2 days from the start): by the fifth day tempo 1 has ended it, tempo 2 (6 days) has not.
async function play(host) {
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm', '~ place Highmark']));
    await host.send('Day.', reply('Dawn.', ['! time +1d']));
    await host.send('Skip.', reply('Later.', ['! time +4d']));
}

test('tempo 2 doubles how long the levy lasts; the default (1) ends it', async () => {
    const slow = await newHost(true, LEVY, settingsOf('2'));
    await play(slow);
    assert.deepEqual(unrest(slow), ['unrest']);
    assert.deepEqual(levy(slow), ['ongoing']);
    slow.done();
    const normal = await newHost(true, LEVY, settingsOf());
    await play(normal);
    assert.deepEqual(unrest(normal), []);
    assert.deepEqual(levy(normal), ['resolved']);
    normal.done();
});

test('a tempo that is not a number runs at 1; one out of range runs at 1 and is named in Problems', async () => {
    const text = await newHost(true, LEVY, settingsOf('quick'));
    await play(text);
    assert.deepEqual(levy(text), ['resolved']);
    assert.deepEqual(text.turn.problems(), []);
    text.done();
    const wild = await newHost(true, LEVY, settingsOf('9'));
    await play(wild);
    assert.deepEqual(levy(wild), ['resolved']);
    assert.ok(wild.turn.problems().some(item => /Tempo 9 is outside 0\.25-4; tempo 1 is used/.test(item.message)), JSON.stringify(wild.turn.problems()));
    wild.done();
});

test('changing the tempo afterwards moves nothing already recorded: rebuild equals live, with the setting back and forth', async () => {
    const host = await newHost(true, LEVY, settingsOf('2'));
    await play(host);
    const live = JSON.stringify(host.head().domains);
    host.settings.set('story-director', 'chronicle.tempo', '0.25');
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head().domains), live, 'tempo 0.25 now: the recorded days stand');
    host.settings.set('story-director', 'chronicle.tempo', '2');
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head().domains), live);
    host.done();
});

test('tempoOf: numbers and number words 0.25-4 pass, anything else is 1, out-of-range numbers pass through for the step to name', () => {
    assert.equal(tempoOf({ tempo: '2' }), 2);
    assert.equal(tempoOf({ tempo: 0.5 }), 0.5);
    assert.equal(tempoOf({ tempo: '' }), 1);
    assert.equal(tempoOf({ tempo: 'fast' }), 1);
    assert.equal(tempoOf(undefined), 1);
    assert.equal(tempoOf({ tempo: '9' }), 9);
});

test('conditionsHere: the conditions at the scene with date, reason and told effects; Director calls count 0; both null with the switch off', async () => {
    const host = await newHost(true, LEVY, settingsOf('2'));
    await play(host);
    const here = host.sdk.query('chronicle.conditionsHere', {});
    assert.equal(here.place, 'Highmark');
    assert.deepEqual(here.conditions.map(entry => [entry.name, entry.ref, entry.means]), [['unrest', 'Highmark', 'Crowds in the streets.']]);
    assert.match(here.conditions[0].sinceText, /^June \d, 1200$/);
    assert.equal(here.conditions[0].told, '');
    assert.equal(here.conditions[0].why, 'The lord calls a levy', 'the happening\'s own words, not its id');
    assert.deepEqual(host.sdk.query('chronicle.conditionsHere', { place: 'Bluewatch' }).conditions, []);
    assert.deepEqual(host.sdk.query('chronicle.directorCalls', {}), { count: 0 });
    host.features.set('story-director.world-events', false);
    assert.equal(host.sdk.query('chronicle.conditionsHere', {}), null);
    assert.equal(host.sdk.query('chronicle.directorCalls', {}), null);
    host.done();
});

// Spec §2 Time units: fades are scaled too, whoever sets the condition (a world line here; the daily step scales its own).
test('a condition the story sets (a world line) fades at 2 days × tempo; a tempo out of range is 1', async () => {
    const fadeOf = async tempo => {
        const host = await newHost(true, LEVY, settingsOf(tempo));
        await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm', '~ place Highmark']));
        await host.send('Look.', reply('The square fills.', ['+ world Bread Riots — crowds fill the square | state: ongoing | place: Highmark | conditions: +grain-dear']));
        const entry = host.head().domains.chronicle.conditions['grain-dear@The March'];
        host.done();
        return (entry.fadesAt - entry.since) / 1440;
    };
    assert.deepEqual([await fadeOf(undefined), await fadeOf('2'), await fadeOf('0.25'), await fadeOf('9')], [2, 4, 1, 2]);
});

// The days a reply stepped are recorded, so a later change moves nothing; a swipe of that reply steps its days again, at the tempo now in force.
test('a swipe of the day-crossing reply after the tempo changed steps those days at the new tempo; swipe back restores the recorded ones', async () => {
    const host = await newHost(true, LEVY, settingsOf('2'));
    await play(host);
    assert.deepEqual(levy(host), ['ongoing']);
    const crossing = host.ctx.chat.length - 1;
    const recorded = JSON.stringify(host.head().domains.chronicle);
    host.settings.set('story-director', 'chronicle.tempo', '1');
    await host.swipe(reply('Later, again.', ['! time +4d']));
    // At tempo 1 the levy's window and life are half as long: it has ended, or (when the recorded early days had not fired it) the window has lapsed; either way no unrest holds.
    assert.deepEqual(unrest(host), [], 'stepped again at tempo 1');
    assert.ok(!levy(host).includes('ongoing'));
    await host.st.swipeTo(crossing, 0);
    assert.equal(JSON.stringify(host.head().domains.chronicle), recorded, 'swipe back: the days as first recorded');
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head().domains.chronicle), recorded, 'rebuild == live');
    host.done();
});
