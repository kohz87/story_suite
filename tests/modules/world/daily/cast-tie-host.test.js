// The world's cast moves on the real host (switch story-director.world-events; spec §8 Event moves, Latest base wins; rulings 8, 37;
// seam audit E1): an authored event's move is mirrored into the cast store (where, doing, base, since; a journey cleared), the day
// planner is told the base and the event's routine, and its move back home is dropped by code (acceptance test 53, the planner side).
// A swipe, a Re-read, a middle delete and a rebuild replay it; with the switch off the same chat moves nobody by an event.
import test from 'node:test';
import assert from 'node:assert/strict';

import { overrideWorld } from '../../../../modules/world/chronicle/world-daily/read-world.js';
import { OPENING, castHost, castSource, createFakeModel, entry, people, said, settle, validatorErrors, withRoads } from '../../cast/cast/helpers.js';

const FEATURE = 'story-director.world-events';
const DAY2 = ['~ time June 4, 1200, 08:00 am'];
const DAY3 = ['~ time June 5, 1200, 08:00 am'];
const LOTHAR = entry('lothar', { start: { place: 'Kesh', goal: 'keep the march quiet', routine: 'drills the guard at dawn' } });
const DURVALD = entry('durvald', { start: { place: 'Gwenmar', goal: 'sell collars', routine: 'works the forge' } });
const SPEC = {
    events: [{
        id: 'summons', kind: 'one-off', certainty: 'set-in-motion', where: ['Gwenmar'], window: { after: 'start + 1 day', within: '1 day' }, ends_when: { for: '5 days' },
        title: 'The regent\'s summons', summary: 'The regent summons the marshal.', effects: { cast: [{ who: 'lothar', location: 'Gwenmar', routine: 'attends the regent' }] },
    }],
};
const BACK = '~ cast lothar | Kesh | rode home to drill the guard\n~ cast durvald | Harrow | carted collars to market';

async function started({ on = true, model = createFakeModel([BACK, BACK, BACK, BACK]) } = {}) {
    const undo = overrideWorld(world => ({ ...world, ...SPEC }));
    const host = await castHost({ source: withRoads(castSource([LOTHAR, DURVALD]), [['Gwenmar', 'Harrow', 5], ['Kesh', 'Harrow', 30], ['Kesh', 'Gwenmar', 20]]), model, features: { [FEATURE]: on } });
    host.undo = undo;
    await host.send('Hello.', said('Dawn.', OPENING));
    await host.send('Look.', said('Smoke.'));
    return host;
}

const lothar = host => people(host)['ersveil:lothar'];
const durvald = host => people(host)['ersveil:durvald'];

test('test 53 (host): the event move is mirrored into the cast store; the planner is told the base and routine; its pull-back is dropped', async () => {
    const model = createFakeModel([BACK, BACK, BACK, BACK]);
    const host = await started({ model });
    try {
        await host.send('Sleep.', said('Morning.', DAY2));
        const moved = lothar(host);
        assert.deepEqual([moved.where, moved.doing], ['Gwenmar', 'attends the regent'], 'the event put him at Gwenmar with its routine');
        assert.deepEqual(moved.base, [{ at: 'Gwenmar', since: moved.since, routine: 'attends the regent', by: 'event:summons' }]);
        await settle();
        // The move set `since` to now (E1): he sits out this day's batch, and is asked about at the next day change.
        await host.send('On.', said('Noon.'));
        assert.equal(durvald(host).where, 'Harrow', 'someone with no base moves as the planner says');
        await host.send('Sleep again.', said('Another morning.', DAY3));
        await settle();
        const asked = model.calls.filter(call => /The cast:/.test(call.prompt)).at(-1);
        assert.match(asked.prompt, /- lothar \| Lothar \| goal: keep the march quiet \| routine: attends the regent \| now at: Gwenmar/, 'told the base and the event routine');
        await host.send('On.', said('Noon.'));
        assert.equal(lothar(host).where, 'Gwenmar', 'the planner\'s move back to Kesh is dropped by code');
        const live = JSON.stringify(host.head().domains.cast);
        host.store.rebuild();
        assert.equal(JSON.stringify(host.head().domains.cast), live, 'a rebuild gives the live cast');
        assert.deepEqual(validatorErrors(host), []);
    } finally { host.close(); host.undo(); }
});

test('replay: a swipe of the crossing reply moves him the same way; a delete of it takes the move back; switch off → nobody is moved by an event', async () => {
    const host = await started();
    try {
        await host.send('Sleep.', said('Morning.', DAY2));
        const first = JSON.stringify(lothar(host));
        await host.swipe(said('Morning, grey.', DAY2));
        assert.equal(JSON.stringify(lothar(host)), first, 'a swipe: the same move, the same base');
        await host.swipe(said('Morning, cold.', DAY2));
        assert.equal(JSON.stringify(lothar(host)), first);
        const index = host.ctx.chat.length - 1;
        await host.st.deleteMessage(index);
        assert.equal(lothar(host).base, undefined, 'deleting the reply that crossed the day takes the move back');
        assert.equal(lothar(host).where, 'Kesh');
        assert.deepEqual(validatorErrors(host), []);
    } finally { host.close(); host.undo(); }
    const off = await started({ on: false });
    try {
        await off.send('Sleep.', said('Morning.', DAY2));
        assert.equal(lothar(off).base, undefined, 'switch off: no event move, no base');
        assert.notEqual(lothar(off).doing, 'attends the regent');
    } finally { off.close(); off.undo(); }
});
