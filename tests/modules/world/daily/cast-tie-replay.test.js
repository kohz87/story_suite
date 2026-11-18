// The world's cast moves replayed on the real host (switch story-director.world-events): an event's move mirrored into the cast store and
// a deferred move of someone with You stay equal to live through a swipe and back, an edited Re-read of the crossing reply (shrunk, grown,
// back), a middle delete, a chat change and back, a reload (a fresh host loading the chat) and a rewind. Rebuild equals live each time.
import test from 'node:test';
import assert from 'node:assert/strict';

import { overrideWorld } from '../../../../modules/world/chronicle/world-daily/read-world.js';
import { OPENING, castHost, castSource, createFakeModel, entry, said, validatorErrors, withRoads } from '../../cast/cast/helpers.js';

const FEATURE = 'story-director.world-events';
const LOTHAR = entry('lothar', { start: { place: 'Kesh', goal: 'keep the march quiet', routine: 'drills the guard at dawn' } });
const TEMIWA = entry('temiwa', { start: { place: 'Kesh', goal: 'read the records', routine: 'reads' } });
const SPEC = {
    events: [{
        id: 'summons', kind: 'one-off', certainty: 'set-in-motion', where: ['Gwenmar'], window: { after: 'start + 1 day', within: '1 day' }, ends_when: { for: '9 days' },
        title: 'The summons', summary: 'The regent calls.', effects: { cast: [{ who: 'lothar', location: 'Gwenmar', routine: 'attends the regent' }, { who: 'temiwa', from: 'anywhere', location: 'Gwenmar' }] },
    }],
};
const source = () => withRoads(castSource([LOTHAR, TEMIWA]), [['Gwenmar', 'Harrow', 5], ['Kesh', 'Harrow', 30]]);
const newHost = () => castHost({ source: source(), model: createFakeModel([]), features: { [FEATURE]: true } });
const worldOf = host => JSON.stringify({ cast: host.head().domains.cast.people, daily: host.head().domains.chronicle.daily ?? null });

async function agrees(host, label) {
    const live = JSON.stringify(host.head().domains);
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head().domains), live, `${label}: rebuild equals live`);
    assert.deepEqual(validatorErrors(host), [], `${label}: valid`);
    const again = await newHost();
    try {
        await again.st.loadChat(structuredClone(host.ctx.chat));
        assert.equal(worldOf(again), worldOf(host), `${label}: a reload agrees`);
    } finally { again.close(); }
}

test('replay == live for the cast mirror and a deferred move: swipe and back, edited Re-reads, middle delete, chat change, reload, rewind', async () => {
    const undo = overrideWorld(world => ({ ...world, ...SPEC }));
    const host = await newHost();
    try {
        await host.send('Hello.', said('Dawn.', OPENING));
        await host.send('Look.', said('Smoke.'));
        await host.send('Sleep.', said('Morning. Temiwa is here.', ['~ time June 4, 1200, 08:00 am', '+ present Temiwa']));
        const crossing = host.ctx.chat.length - 1;
        const cast = host.head().domains.cast.people;
        assert.equal(cast['ersveil:lothar'].base[0].by, 'event:summons', 'Lothar moved');
        assert.equal(host.head().domains.chronicle.daily[0].cast.temiwa.deferred.to, 'Gwenmar', 'Temiwa with You: deferred');
        const before = worldOf(host);
        await agrees(host, 'live');
        await host.swipe(said('Morning, grey. Temiwa is here.', ['~ time June 4, 1200, 08:00 am', '+ present Temiwa']));
        assert.equal(worldOf(host), before, 'a swipe: the same');
        await host.st.swipeTo(crossing, 0);
        assert.equal(worldOf(host), before, 'swipe back');
        await agrees(host, 'swipe back');
        await host.send('Go on.', said('Noon.', ['! time +2h']));
        const later = worldOf(host);
        await host.st.editMessage(crossing, said('Morning. Temiwa is here.', ['! time +1h', '+ present Temiwa']));
        assert.equal((await host.sdk.reread(crossing)).ok, true);
        await agrees(host, 'shrunk Re-read');
        await host.st.editMessage(crossing, said('Morning. Temiwa is here.', ['! time +3d', '+ present Temiwa']));
        assert.equal((await host.sdk.reread(crossing)).ok, true);
        await agrees(host, 'grown Re-read');
        await host.st.editMessage(crossing, said('Morning. Temiwa is here.', ['~ time June 4, 1200, 08:00 am', '+ present Temiwa']));
        assert.equal((await host.sdk.reread(crossing)).ok, true);
        assert.equal(worldOf(host), later, 'edited back: as it was');
        await host.st.deleteMessage(crossing);
        assert.deepEqual(host.store.problems(), []);
        await agrees(host, 'middle delete');
        const chat = structuredClone(host.ctx.chat);
        await host.st.loadChat([{ name: 'Other', is_user: false, mes: 'Elsewhere.' }]);
        assert.equal(host.head().domains.chronicle.daily, undefined, 'another chat has no world days');
        await host.st.loadChat(chat);
        await agrees(host, 'chat change and back');
        while (host.ctx.chat.length > 2) await host.st.deleteMessage(host.ctx.chat.length - 1);
        assert.equal(host.head().domains.cast.people['ersveil:lothar'].base, undefined, 'rewound before the crossing: no move');
        await agrees(host, 'rewound');
    } finally { host.close(); undo(); }
});
