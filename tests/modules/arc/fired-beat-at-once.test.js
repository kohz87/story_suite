// A beat fired with `!` counts as played in the very reply that fired it (the line goes into the quest log inside the capture,
// not at the next reply's note), and replays the same: swipe, swipe back, middle delete, rebuild.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createHost } from '../../../testkit/host.js';
import { createModule } from '../../../modules/director/module.js';
import { firedBeatIds } from '../../../modules/time/tracker/quiet.js';
import { withD1 } from '../../helpers/director/d1.js';
import { said } from '../world/chronicle/note-cursor.helpers.js';

const fired = host => [...firedBeatIds(host.head().domains.director, host.head())];
const same = host => { const before = JSON.stringify(host.head().domains); host.store.rebuild(); return JSON.stringify(host.head().domains) === before; };

async function setup(t) {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ modules: [withD1(createModule())] });
    t.after(() => host.close());
    await host.send('Begin.', said('R0.', ['~ time June 3, 1200, 06:00 pm']));
    await host.send('Plan.', said('R1.', ['+ beat Caravan forms — a train gathers | on: June 5, 1200']));
    return host;
}

test('a beat fired with ! is played at once, with no later reply', async t => {
    const host = await setup(t);
    assert.deepEqual(fired(host), []);
    await host.send('Go.', said('R2.', ['! beat Caravan forms — the train gathers']));
    assert.equal(fired(host).length, 1);
    assert.equal(same(host), true);
});

test('a swipe of the firing reply un-fires it; swiping back fires it again; a middle delete un-fires it', async t => {
    const host = await setup(t);
    await host.send('Go.', said('R2.', ['! beat Caravan forms — the train gathers']));
    await host.swipe(said('R2 again.', ['~ beat Caravan forms | note: later']));
    assert.equal(fired(host).length, 0);
    assert.equal(same(host), true);
    await host.swipe(said('R2.', ['! beat Caravan forms — the train gathers']));
    assert.equal(fired(host).length, 1);
    const index = host.ctx.chat.findIndex(m => !m.is_user && String(m.mes).startsWith('R2.'));
    await host.st.deleteMessage(index); await host.st.deleteMessage(index - 1);
    assert.equal(fired(host).length, 0);
    assert.equal(same(host), true);
});
