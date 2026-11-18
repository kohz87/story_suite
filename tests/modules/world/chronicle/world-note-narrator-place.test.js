// LA-1: a place the narrator made up, in a region it names by display name ("Bluewatch Reach"), still gets that region's world conditions
// (the pack stores them under the region id "bluewatch-reach"). Same on swipe, edited Re-read, reload.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FEATURE, newHost, reply } from '../daily/daily-host.helpers.js';

const PACK = {
    id: 'la1-region', version: '1.0.0', name: 'LA1 region', format: 4, kind: 'world', requires: { suite: '^0.1' },
    content: {
        regions: [{ id: 'bluewatch-reach', name: 'Bluewatch Reach' }, { id: 'auvoth-compact', name: 'Auvoth Compact' }],
        places: [
            { id: 'bluewatch-village', name: 'Bluewatch Village', region: 'bluewatch-reach', kind: 'village', x: 40, y: 100 },
            { id: 'auvoth', name: 'Auvoth', region: 'auvoth-compact', kind: 'city', x: 59, y: 110 },
        ],
        routes: [{ from: 'Bluewatch Village', to: 'Auvoth', kind: 'road', km: 210 }],
        conditions: [{ name: 'guild-stretched', scope: 'region', fades: 'until cleared', means: 'The guild is stretched thin.' }],
    },
};
const note = made => made.st.promptLog.map(entry => String(entry.value ?? '')).filter(value => value.includes('[World now]')).at(-1) ?? '';
const here = made => (made.sdk.query('chronicle.conditionsHere', {})?.conditions ?? []).map(entry => entry.name);

async function setup() {
    const made = await newHost(FEATURE ? true : false);
    const installed = await made.packs.packs.install(JSON.stringify(PACK), { origin: 'pack.json' });
    assert.equal(installed.ok, true, JSON.stringify(installed.errors));
    assert.equal(await made.packs.packs.select('world', PACK.id), true);
    await made.send('Begin.', reply('Dust.', ['~ time October 1, 1200, 08:00 am', '~ place Bluewatch Village']));
    await made.send('Look.', reply('Queues at the desk.', ['+ world Guild Strain — the guild is stretched | state: ongoing | place: Bluewatch Village | conditions: +guild-stretched']));
    return made;
}

test('LA-1: a narrator place in a region given by name reads the region\'s conditions, as the pack place does', async () => {
    const made = await setup();
    try {
        assert.deepEqual(here(made), ['guild-stretched'], 'at the pack place');
        await made.send('Go.', reply('The road.', ['~ place Auvoth Frontier Road | kind: wild | region: Bluewatch Reach']));
        assert.deepEqual(here(made), ['guild-stretched'], 'on the made-up road');
        await made.send('On.', reply('Still the road.'));
        assert.match(note(made), /Conditions here: guild-stretched/);
        // A swipe and back, an edited Re-read, a reload read the same.
        await made.swipe(reply('Still the road, again.'));
        assert.deepEqual(here(made), ['guild-stretched'], 'swipe');
        const at = made.ctx.chat.findIndex(message => !message.is_user && /Auvoth Frontier Road/.test(message.mes));
        await made.st.editMessage(at, reply('The road.', ['! time +1h', '~ place Auvoth Frontier Road | kind: wild | region: Bluewatch Reach']));
        assert.equal((await made.sdk.reread(at)).ok, true);
        assert.deepEqual(here(made), ['guild-stretched'], 'edited Re-read');
    } finally { made.done(); }
});
