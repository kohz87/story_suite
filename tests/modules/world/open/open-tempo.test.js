// Final review M1: the open-template look-ahead (a dry run of the daily step, open-store.js) runs with the reader's tempo, the calendar and the
// cast tie, as the step itself does. At tempo 2 every slot it asks the Director about is one the step really makes (before, it dry-ran at tempo 1
// and asked again every day for a slot tempo 1 would have made: 92 calls for 2 slots over 200 days). Replay == live with the answers stored.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { agrees, dailyOf, ledgerOpen, openHost, reply, settle } from './open-host.helpers.js';

const asked = host => [...new Set(host.model.prompts.flatMap(prompt => [...prompt.matchAll(/^Slot (\S+)$/gm)].map(match => match[1])))].sort();
const made = host => [...Object.keys(dailyOf(host)?.slots ?? {}), ...(dailyOf(host)?.pending ?? []).map(slot => slot.key)];

test('tempo 2: the look-ahead asks only for slots the daily step makes; replay == live', async () => {
    const host = await openHost();
    host.settings.set('story-director', 'chronicle.tempo', '2');
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    await settle();
    // A day a reply for a hundred days: tempo 1's season stretch (90 days) ends inside them, tempo 2's (180) does not.
    for (let i = 0; i < 100; i += 1) {
        await host.send(`Day ${i}.`, reply('A day passes.', ['! time +1d']));
        await settle();
    }
    const keys = asked(host);
    assert.equal(keys.length, 1, `the first day's slot only (${keys.join(', ')})`);
    const real = new Set(made(host));
    assert.deepEqual(keys.filter(key => !real.has(key)), [], 'no call for a slot the step never makes');
    assert.equal(ledgerOpen(host).calls, host.model.calls);
    await agrees(host, 'tempo 2');
    host.done();
});
