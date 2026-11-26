// The Director judge and `waits_for` beats: no candidate, and so no call, on a day a beat waits for the party or is forced on its last day.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { agrees, daily, day, rollHost, rollModel, SPEC } from './roll-judge.helpers.js';
import { reply, settle } from './judge-host.helpers.js';

test('judge and daily pass: a waiting beat and its forced last day are never asked about', async () => {
    const beat = { id: 'beat', kind: 'one-off', certainty: 'likely', chance: '70% over the window', where: ['Highmark'], window: { after: 'start + 1 day', within: '3 days' }, waits_for: 'near', ends_when: 'instant', title: 'The beat', summary: 'A beat in Highmark.' };
    for (const settings of [{ 'chronicle.judge': true }, { 'arc.dailyPass': true }]) {
        const model = rollModel(['1: refuse: not now']);
        const host = await rollHost(model, settings, { ...SPEC, events: [beat] });
        try {
            await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
            for (let n = 1; n <= 6 && daily(host).events.beat?.fired === undefined; n += 1) await day(host, `Day ${n}.`);
            await settle();
            assert.equal(daily(host).events.beat.fired, daily(host).events.beat.start + 2, 'forced on the last day of its window');
            assert.equal(model.calls, 0, JSON.stringify(settings));
            await agrees(host, 'waits');
        } finally { host.done(); }
    }
});
