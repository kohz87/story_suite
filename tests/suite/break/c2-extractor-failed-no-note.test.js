// Break round, cell 2 (half the features on, live p1-c2-half): with `story-block.extractor` on, a reply
// that came without its <Changes> block is left to the extractor (MODULES §F40). When the extractor's own
// model call then fails (an error, a time-out — live, the mock's empty side answer: "assist: the reply's
// changes were not read: No message generated"), nothing was kept. The engine must say so: the extractor's
// status for the reply is `failed`, so the view can tell the reader the reply was not read.
// (The old reply note that showed it is gone with the old view; the status is the engine's side.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { CORE_FEATURE } from '../../../core/features.js';

for (const [what, callModel] of [
    ['a time-out', () => new Promise((_, reject) => setTimeout(() => reject(new Error('timed out')), 5))],
    ['an error', async () => { throw new Error('No message generated'); }],
]) {
    test(`extractor on, its call fails (${what}): the reply without change lines is reported as not read`, async () => {
        const host = await createHost({ callModel });
        try {
            host.features.set(CORE_FEATURE.extractor, true);
            await host.send('and now?', 'You find a rope and pocket it.');
            await new Promise(resolve => setTimeout(resolve, 30));
            const last = host.sdk.query('assist.status')?.extractor?.last;
            assert.equal(last?.outcome, 'failed', `the extractor ran and did not read the reply: ${JSON.stringify(last)}`);
        } finally {
            host.close();
        }
    });
}
