// LIVEPERF finding 1 (LPA): the prompt build asked `packs.content` thousands of times a reply and every answer was copied whole (the
// world's places, events and cast each time). The answer is now the packs' own records, frozen all the way down, handed out as they are:
// the same objects on every ask. Any other query's answer is still a copy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHost } from '../../../testkit/index.js';

const pack = rel => readFileSync(new URL(`../../../examples/packs/${rel}/pack.json`, import.meta.url), 'utf8');

test('packs.content hands out the packs\' own frozen records, the same objects on every ask; another query still answers a copy', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ core: true });
    t.after(() => host.close());
    for (const rel of ['ersveil', 'ersveil-game']) assert.equal((await host.packs.packs.install(pack(rel), { origin: 'pack.json' })).ok, true, rel);
    for (const kind of ['places', 'cast', 'regions']) {
        const first = host.sdk.query('packs.content', { kind });
        const again = host.sdk.query('packs.content', { kind });
        assert.ok(first.length > 0, kind);
        assert.ok(Object.isFrozen(first) && first.every(row => Object.isFrozen(row)), `${kind}: frozen`);
        first.forEach((row, at) => assert.equal(again[at], row, `${kind} ${at}: the same record, not a copy`));
        assert.throws(() => { first[0].name = 'changed'; }, TypeError, `${kind}: a pack cannot be changed through its answer`);
    }
    const calendar = host.sdk.query('packs.calendar');
    assert.notEqual(host.sdk.query('packs.calendar'), calendar, 'any other answer is still a fresh copy');
});
