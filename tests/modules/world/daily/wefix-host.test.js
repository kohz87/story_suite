// WEFIX1 on the real host: the world a pack begins in (start.world), a fixed-date `on` event and a season-limited event through the host's own
// calendar. Swipe, swipe back, rewind, middle delete, an edited Re-read (grown and shrunk) and a reload all agree with live.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { agrees, chronicle, dailyOf, newHost, reply, SPEC, world } from './daily-host.helpers.js';

const spec = {
    ...SPEC,
    regions: [{ id: 'The March', name: 'The Marchlands' }],
    startWorld: { set: ['unrest@Highmark: 30 days'], facts: ['early-flood'] },
    templates: [{ template: 'riot', severity: 'minor', where: { kinds: ['village'] }, sets: ['unrest@place: 3 days'], chance: '100% per season', summary: 'Riots across {region}.' }],
    events: [
        { id: 'feast', kind: 'one-off', certainty: 'set-in-motion', where: ['Bluewatch'], on: 'date:1200-6-5', ends_when: { for: '2 days' }, effects: { set: ['grain-dear@The March: 5 days'] }, summary: 'A feast at Bluewatch.' },
        { id: 'frost', kind: 'recurring', certainty: 'possible', severity: 'minor', where: { kinds: ['town'] }, requires: ['summer'], chance: '100% per season', ends_when: 'instant', summary: 'Frost in {region}.' },
    ],
};
// A condition a step sets carries the reply's revision, which a swipe moves on; everything else must be equal.
const same = host => world(host).replace(/"rev":\d+,?/g, '');
const check = async (host, label) => { assert.deepEqual(host.store.problems(), [], label); await agrees(host, label); };

test('start.world is applied with the first step; the fixed-date event fires on its day; every replay path agrees', async () => {
    const host = await newHost(true, spec);
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    await host.send('Rest.', reply('A quiet night.'));
    assert.ok(chronicle(host).conditions['unrest@Highmark'], 'the world it begins in');
    assert.ok(dailyOf(host).facts['early-flood']);
    assert.equal(dailyOf(host).events.feast?.fired, undefined);
    await check(host, 'first step');
    await host.send('Day.', reply('Dawn.', ['! time +1d']));
    await host.send('Day two.', reply('Dawn again.', ['! time +1d']));
    const feast = dailyOf(host).events.feast.fired;
    assert.equal(Math.floor(host.head().domains.director.time.minutes / 1440), feast, 'fired on June 5, the day it names');
    assert.match(JSON.stringify(chronicle(host)), /Riots across The Marchlands\./, 'the region is named as content.regions names it');
    await check(host, 'live');
    const recorded = same(host);
    for (const text of ['Dawn, grey.', 'Dawn, red.']) {
        await host.swipe(reply(text, ['! time +1d']));
        assert.equal(same(host), recorded, 'a swipe of the crossing reply: the same step');
    }
    await host.swipe(reply('Dawn again.', ['! time +1d']));
    assert.equal(same(host), recorded, 'swiped back');
    const first = host.ctx.chat.findIndex(message => /^Dawn\./.test(message.mes));
    await host.st.editMessage(first, reply('Dawn.', ['! time +3d']));
    assert.equal((await host.sdk.reread(first)).ok, true);
    await check(host, 'grown Re-read');
    await host.st.editMessage(first, reply('Dawn.', ['! time +1h']));
    assert.equal((await host.sdk.reread(first)).ok, true);
    await check(host, 'shrunk Re-read');
    await host.st.deleteMessage(1);
    assert.ok(dailyOf(host).events.feast.fired === feast, 'a middle delete of the first step keeps the later record');
    await check(host, 'middle delete');
    host.done();
});

test('rewinding past the first step takes start.world back, and playing on puts it back', async () => {
    const host = await newHost(true, spec);
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    assert.ok(chronicle(host).conditions['unrest@Highmark'], 'the first reply with a clock makes the first step');
    await host.swipe(reply('Dust, again.', ['~ time June 3, 1200, 08:00 pm']));
    assert.ok(chronicle(host).conditions['unrest@Highmark'], 'a swipe of the first step\'s reply sets the same world');
    await check(host, 'swiped first step');
    await host.st.deleteMessage(host.ctx.chat.length - 1);
    assert.equal(chronicle(host).conditions?.['unrest@Highmark'], undefined);
    assert.equal(dailyOf(host), null);
    await check(host, 'rewound');
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    assert.ok(chronicle(host).conditions['unrest@Highmark']);
    host.done();
});
