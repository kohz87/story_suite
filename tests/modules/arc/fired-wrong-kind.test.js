// LA-4: a `!` line whose kind word is not the kind of the thread its key names (here "! clock" for a hook) is applied to that thread with a Problem, and replays the same.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createHost } from '../../../testkit/host.js';
import { createModule } from '../../../modules/director/module.js';
import { withD1 } from '../../helpers/director/d1.js';
import { said } from '../world/chronicle/note-cursor.helpers.js';

const wrong = host => Object.values(host.head().domains.director.problems ?? {}).flat().filter(problem => problem?.kind === 'wrong-kind');
const same = host => { const before = JSON.stringify(host.head().domains); host.store.rebuild(); return JSON.stringify(host.head().domains) === before; };

async function setup(t) {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ modules: [withD1(createModule())] });
    t.after(() => host.close());
    await host.send('Begin.', said('R0.', ['~ time June 3, 1200, 06:00 pm']));
    await host.send('Plan.', said('R1.', ['+ hook Grey Ledger Sweep — clerks come | on: June 5, 1200']));
    return host;
}

test('a ! clock line for a hook lists a Problem; the same kind lists none; swipe, delete and rebuild agree', async t => {
    const host = await setup(t);
    await host.send('Go.', said('R2.', ['! hook Grey Ledger Sweep — the clerks arrive']));
    assert.equal(wrong(host).length, 0, 'the right kind');
    await host.send('Go.', said('R3.', ['! clock Grey Ledger Sweep — the clerks arrive']));
    assert.equal(wrong(host).length, 1);
    assert.match(wrong(host)[0].text, /names a hook, not a clock/);
    assert.equal(same(host), true);
    await host.swipe(said('R3 again.', ['! hook Grey Ledger Sweep — the clerks arrive']));
    assert.equal(wrong(host).length, 0, 'swipe');
    await host.swipe(said('R3.', ['! clock Grey Ledger Sweep — the clerks arrive']));
    assert.equal(wrong(host).length, 1, 'swipe back');
    const index = host.ctx.chat.findIndex(m => !m.is_user && String(m.mes).startsWith('R3.'));
    await host.st.deleteMessage(index); await host.st.deleteMessage(index - 1);
    assert.equal(wrong(host).length, 0, 'middle delete');
    assert.equal(same(host), true);
});
