// The Follow star keeps a person out of the cast's reach (Around here's "near" count leaves them out). The star is the reader's edit on the head reply, so it
// replays like any other: a swipe takes it away and swiping back restores it, a middle delete of that reply drops it, a reload and a rebuild keep it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { OPENING, castHost, castSource, entry, followPeople, said } from './helpers.js';

const quiet = t => { t.mock.method(console, 'log', () => {}); t.mock.method(console, 'warn', () => {}); };
const near = host => host.sdk.query('director.cast.view').near;

test('follow: a swipe takes the star away, swiping back restores it; a delete of its reply drops it; a reload and a rebuild keep it', async t => {
    quiet(t);
    const host = await castHost({ source: castSource([
        entry('brom', { start: { place: 'Harrow', goal: 'forge', routine: 'at the forge in the evening' } }),
        entry('tam', { start: { place: 'Harrow', goal: 'x', routine: 'at the forge in the evening' } }),
    ]) });
    try {
        await host.send('Hello.', said('Dawn.', OPENING));
        await host.send('Look.', said(`Smoke. ${host.everyone()}`));
        assert.equal(near(host), 2, 'both are near before the star');
        await followPeople(host, [{ name: 'Brom' }]);
        assert.equal(near(host), 1, 'a followed person is left out');
        const last = host.ctx.chat.length - 1;
        await host.swipe(said('Smoke again.'));
        assert.equal(near(host), 2, 'a swipe of the reply: the star is on the other swipe');
        await host.st.swipeTo(last, 0);
        assert.equal(near(host), 1, 'swiping back restores the star');
        const live = structuredClone(host.head());
        await host.st.loadChat(structuredClone(host.ctx.chat));
        assert.deepEqual(host.head(), live, 'a reload gives the same head');
        assert.equal(near(host), 1);
        host.store.rebuild();
        assert.deepEqual(host.head(), live, 'a rebuild gives the same head');
        assert.equal(near(host), 1);
        await host.send('Next.', said('Quiet.'));
        await host.st.deleteMessage(last);
        assert.equal(near(host), 2, 'deleting the reply that carries the star drops it');
    } finally {
        host.close();
    }
});
