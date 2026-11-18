// People with You on the real host (switch story-director.world-events; spec v0.14.5 §8 With You, rulings 33-34; acceptance tests
// 104-105, 109-110, the host side): someone in the scene (`+ present`) at the tick is not moved, the move waits and applies on the
// first tick after the scene moved on without them; a death with even_in_party becomes the world note's must-happen line and, not
// written, is applied by code after 3 replies with a Problems note. Swipes and a rebuild replay it.
import test from 'node:test';
import assert from 'node:assert/strict';

import { overrideWorld } from '../../../../modules/world/chronicle/world-daily/read-world.js';
import { OPENING, TAIL_KEY, castHost, castSource, createFakeModel, entry, people, said, sent, validatorErrors, withRoads } from '../../cast/cast/helpers.js';
import { slotValue } from '../../../../modules/rpg/slot.js';

const FEATURE = 'story-director.world-events';
const DAY2 = ['~ time June 4, 1200, 08:00 am'];
const DAY3 = ['~ time June 5, 1200, 08:00 am'];
const LOTHAR = entry('lothar', { start: { place: 'Kesh', goal: 'keep the march quiet', routine: 'drills the guard at dawn' } });
const event = (id, cast, extra = {}) => ({ id, kind: 'one-off', certainty: 'set-in-motion', where: ['Gwenmar'], window: { after: 'start + 1 day', within: '1 day' }, ends_when: { for: '9 days' }, title: 'The summons', summary: 'The regent calls.', effects: { cast }, ...extra });

async function started(spec) {
    const undo = overrideWorld(world => ({ ...world, ...spec }));
    const host = await castHost({ source: withRoads(castSource([LOTHAR]), [['Gwenmar', 'Harrow', 5], ['Kesh', 'Harrow', 30]]), model: createFakeModel([]), features: { [FEATURE]: true } });
    host.undo = undo;
    await host.send('Hello.', said('Dawn.', OPENING));
    return host;
}

const daily = host => slotValue(host.head().domains.chronicle.daily) ?? null;
const lothar = host => people(host)['ersveil:lothar'];

test('tests 104-105 (host): with You in the scene at the tick he is not moved; the first tick after the scene moved on without him moves him', async () => {
    const host = await started({ events: [event('summons', [{ who: 'lothar', from: 'anywhere', location: 'Gwenmar', routine: 'attends the regent' }])] });
    try {
        await host.send('Sleep.', said('Morning. Lothar is here.', [...DAY2, '+ present Lothar']));
        assert.deepEqual(daily(host).cast.lothar.deferred, { to: 'Gwenmar', by: 'summons', until: 'end', title: 'The summons', routine: 'attends the regent', from: 'anywhere' });
        assert.equal(lothar(host).base, undefined, 'not moved while with You');
        const live = JSON.stringify(host.head().domains);
        await host.swipe(said('Morning, grey. Lothar is here.', [...DAY2, '+ present Lothar']));
        assert.equal(JSON.stringify(daily(host)), JSON.stringify(slotValue(JSON.parse(live).chronicle.daily)), 'a swipe decides the same way');
        await host.send('Go.', said('He rides off.', ['- present Lothar']));
        assert.ok(daily(host).cast.lothar.deferred, 'no tick yet: still deferred');
        await host.send('Sleep.', said('Another morning.', DAY3));
        assert.equal(daily(host).cast.lothar.deferred, undefined);
        assert.deepEqual([lothar(host).where, slotBy(lothar(host))], ['Gwenmar', 'event:summons'], 'moved on the first tick after he left You');
        const after = JSON.stringify(host.head().domains);
        host.store.rebuild();
        assert.equal(JSON.stringify(host.head().domains), after, 'a rebuild gives the live state');
        assert.deepEqual(validatorErrors(host), []);
    } finally { host.close(); host.undo(); }
});

const slotBy = person => person.base?.[0]?.by;

test('tests 109-110 (host): even_in_party → the must-happen line in the world note; not written in 3 replies → applied by code with a Problems note', async () => {
    const host = await started({ events: [event('duel', [{ who: 'lothar', died: true }], { even_in_party: true, summary: 'The duel at Gwenmar.' })] });
    try {
        await host.send('Sleep.', said('Morning. Lothar is here.', [...DAY2, '+ present Lothar']));
        assert.equal(daily(host).cast.lothar.dying.text, 'Lothar dies here: The duel at Gwenmar.');
        assert.equal(daily(host).cast.lothar.died, undefined, 'not applied at the tick');
        await host.send('Fight.', said('Steel rings.'));
        assert.match(sent(host, TAIL_KEY).at(-1) ?? '', /\[World now\]\nLothar dies here: The duel at Gwenmar\./, 'the cue was in the note of the reply after the tick');
        assert.equal(daily(host).cast.lothar.dying.replies, 1);
        // A swipe of a counting reply counts it once (the state is a slot written whole).
        await host.swipe(said('Steel rings again.'));
        assert.equal(daily(host).cast.lothar.dying.replies, 1);
        await host.send('More.', said('He staggers.'));
        assert.equal(daily(host).cast.lothar.died, undefined);
        await host.send('End.', said('Silence.'));
        assert.equal(daily(host).cast.lothar.died, daily(host).day, 'the third reply without the death: code applies it');
        assert.deepEqual(daily(host).anchors['died:lothar'], [daily(host).day]);
        // Final review L6 (seam F5): the cue command marks its deaths `cue: true`, so a met person's must-happen death reaches the cast store.
        assert.ok(lothar(host).met, 'Lothar has been met');
        assert.deepEqual([lothar(host).alive, lothar(host).doing], [false, ''], 'the cast store has him dead');
        const cue = host.sdk.receipts().filter(item => item.receipt.type === 'chronicle.world.cue').at(-1);
        assert.match(cue.receipt.summary, /Lothar died: the story did not show it within 3 replies/, 'the Journal line on the card');
        assert.ok(host.turn.problems().some(item => /Lothar died off-screen/.test(item.message)), 'and a Problems note');
        const after = JSON.stringify(host.head().domains);
        host.store.rebuild();
        assert.equal(JSON.stringify(host.head().domains), after, 'a rebuild gives the live state');
    } finally { host.close(); host.undo(); }
});
