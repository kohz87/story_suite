// Thresholds on the host (acceptance test 80): the day's values are recorded with the step on the reply that crossed the day;
// replay applies them and never recomputes, through swipe, swipe back, an edited Re-read, a middle delete, a rewind and a reload.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { agrees, dailyOf, newHost, reply, SPEC, world } from './daily-host.helpers.js';

const shift = (id, after, within, delta) => ({ id, kind: 'one-off', certainty: 'set-in-motion', severity: 'minor', where: ['Highmark'], window: { after, within }, ends_when: 'instant', effects: { powers: { 'ashen-veil': delta } }, summary: id });
const THRESHOLD = {
    ...SPEC,
    powers: [{ id: 'ashen-veil', name: 'Ashen Veil', start: 20 }],
    events: [
        // Day 1 (the first step): the surge; day 2: the muster's last window day, 40 → it fires; day 4-6: the rout, 0 → the muster ends.
        shift('surge', 'start', '1 day', 20),
        { id: 'muster', kind: 'one-off', certainty: 'set-in-motion', severity: 'minor', where: ['Highmark'], requires: ['power:ashen-veil >= 40'], window: { after: 'start', within: '2 days' }, ends_when: { for: '10 days', any_of: ['power:ashen-veil <= 10'] }, summary: 'The faithful muster.' },
        shift('rout', 'fired:muster + 2 days', '3 days', -40),
    ],
};
const rows = host => Object.fromEntries(Object.entries(dailyOf(host).events).map(([id, row]) => [id, row.state]));

test('test 80: a threshold crossing is recorded in the reply that crossed the day; replay == live through swipes, an edited Re-read, a middle delete, a rewind and a reload', async () => {
    const host = await newHost(true, THRESHOLD);
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    await host.send('Day.', reply('Dawn.', ['! time +1d']));
    const crossing = host.ctx.chat.length - 1;
    assert.equal(dailyOf(host).standings['power:ashen-veil'], 40, 'the surge (day 2) is recorded');
    assert.equal(rows(host).muster, 'active', 'the muster crossed its threshold that day and fired (set-in-motion, minor)');
    const after = world(host);
    await host.swipe(reply('Dawn, grey.', ['! time +1d']));
    assert.equal(world(host), after, 'a swipe of the crossing reply: the same values and events');
    await host.st.swipeTo(crossing, 0);
    assert.equal(world(host), after, 'swipe back');
    await agrees(host, 'swipes');
    await host.send('Week.', reply('A week on.', ['! time +6d']));
    assert.equal(dailyOf(host).standings['power:ashen-veil'], 0, 'the rout (day 6) brought it to 0');
    assert.equal(rows(host).muster, 'ended', 'any_of power <= 10 ended it');
    const later = JSON.stringify(dailyOf(host));
    await host.st.editMessage(crossing, reply('Dawn.', ['! time +2h']));
    assert.equal((await host.sdk.reread(crossing)).ok, true);
    assert.equal(JSON.stringify(dailyOf(host)), later, 'an edited Re-read of the crossing reply: the later recorded days are applied, never recomputed');
    await agrees(host, 'edited Re-read');
    await host.st.deleteMessage(crossing);
    assert.deepEqual(host.store.problems(), []);
    assert.equal(rows(host).muster, 'ended', 'a middle delete: the later record still says ended');
    await agrees(host, 'middle delete');
    while (host.ctx.chat.length > 3) await host.st.deleteMessage(host.ctx.chat.length - 1);
    await agrees(host, 'rewound');
    host.done();
});
