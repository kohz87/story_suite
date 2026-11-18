// The Studio dry run: the same seed gives the same days, another seed gives other days, the pack is run as written (nothing stripped),
// the world is read from the pack's content, the Worker wrapper reports progress, a result, an error and a cancel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate, startDryRun, worldOf } from '../../../studio/dryrun/run.js';
import { answer } from '../../../studio/dryrun/worker.js';

const pack = {
    start: { world: { set: ['unrest@Oakhollow: 5 days'], facts: [] } },
    content: {
        realms: [{ name: 'Highmark Empire', regions: ['Valegard'] }],
        places: [{ name: 'Oakhollow', region: 'Valegard', kind: 'town', x: 10, y: 0 }, { name: 'Town', region: 'Valegard', kind: 'town', x: 12, y: 0 }],
        conditions: [{ name: 'unrest', scope: 'place', fades: '10 days' }],
        powers: [{ name: 'Crown', start: 3 }], scores: [{ name: 'Stability', start: 0 }],
        worldEvents: [{ id: 'levy', kind: 'one-off', certainty: 'likely', where: ['Highmark Empire'], ends_when: { for: '5 days' }, summary: 'levy', chance: '60% over the window', window: { after: 'start', within: '30 days' } }],
        templates: [{ template: 'riot', severity: 'minor', where: { kinds: ['town'] }, sets: ['unrest@place: 3 days'], chance: '30% per season', summary: 'Riot in {place}.' }],
    },
};
const run = (seed, extra = {}) => simulate({ pack, seed, tempo: 1, days: 60, ...extra });

test('the same seed gives the same days; another seed gives other days', () => {
    assert.deepEqual(run('a'), run('a'));
    const seen = new Set(['a', 'b', 'c', 'd', 'e', 'f'].map(seed => JSON.stringify(run(seed).rows.map(row => row.fired))));
    assert.ok(seen.size > 1, 'the seeds do not all play out the same');
});

test('one row per day, with the start world held on day 1 and standings from the pack', () => {
    const result = run('a');
    assert.equal(result.rows.length, 60);
    assert.deepEqual(result.rows.map(row => row.day).slice(0, 3), [1, 2, 3]);
    assert.ok(result.rows[0].held.includes('unrest'), 'start.world applied');
    assert.equal(result.rows[0].standings['power:Crown'], 3);
    assert.ok(result.finalEvents.levy, 'the event has a state at the end');
});

test('the pack is run as written: a field the install check refuses is not stripped, and the days are capped', () => {
    const odd = structuredClone(pack);
    odd.content.cast = [{ id: 'old', name: 'Old', age: 40, start: 'Oakhollow' }];
    assert.equal(worldOf(odd).cast[0].age, 40);
    assert.equal(simulate({ pack, seed: 'a', days: 99999 }).days, 3650);
    assert.equal(simulate({ pack, seed: 'a', days: 0 }).days, 1);
});

test('worldOf reads the game seasons, and merges the kind tables', () => {
    const world = worldOf({ content: { placeKinds: [{ a: 1 }, { b: 2 }] } }, { seasons: [{ name: 'Wet', months: ['x'] }] });
    assert.deepEqual(world.placeKinds, { a: 1, b: 2 });
    assert.equal(world.seasons[0].name, 'Wet');
    assert.equal(worldOf({ content: {} }).seasons, null);
});

// A fake Worker that answers on the next tick through the real wrapper.
function fakeWorker({ crash = false } = {}) {
    const worker = {
        terminated: 0,
        terminate() { worker.terminated += 1; },
        postMessage(input) {
            setTimeout(() => {
                if (crash) return worker.onerror?.({ message: 'boom' });
                answer(input, data => worker.onmessage?.({ data }));
            }, 0);
        },
    };
    return worker;
}

test('startDryRun: progress every 10 days, then the same result as simulate; the worker is stopped', async () => {
    const progress = [];
    const worker = fakeWorker();
    const { done } = startDryRun({ pack, seed: 'a', tempo: 1, days: 30 }, { make: () => worker, onProgress: day => progress.push(day) });
    assert.deepEqual(await done, simulate({ pack, seed: 'a', tempo: 1, days: 30 }));
    assert.deepEqual(progress, [10, 20, 30]);
    assert.equal(worker.terminated, 1);
});

test('startDryRun: an engine error, a crashed worker and a cancel all reject with a message', async () => {
    const thrown = [];
    answer({ pack, days: 3, calendar: { months: 'nonsense' }, get seed() { throw new Error('seed broke'); } }, message => thrown.push(message));
    assert.equal(thrown.at(-1).error, 'seed broke');
    await assert.rejects(startDryRun({ pack, seed: 'a', days: 5 }, { make: () => fakeWorker({ crash: true }) }).done, /boom/);
    const worker = fakeWorker();
    const run2 = startDryRun({ pack, seed: 'a', days: 5 }, { make: () => worker });
    run2.cancel();
    await assert.rejects(run2.done, /cancelled/);
    assert.equal(worker.terminated, 1);
});
