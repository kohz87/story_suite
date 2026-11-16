// Story Director's legacy whole-story claims (`clock:seed` from the pack start, `lapse:<thread>` from the settle hook) under
// an edited Re-read on the real Story Block host: they are made by hooks a Re-read never re-runs, so the replay rule that
// skips a legacy block whose claim is already held (Story Block REPLAY.md rule 4) changes nothing for them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createHost } from '../../../testkit/index.js';
import { createModule } from '../../../ui/legacy/director/module.js';
import { withD1 } from '../../helpers/director/d1.js';

const PACK = readFileSync(new URL('../../fixtures/director/ersveil-bluewatch.pack.json', import.meta.url), 'utf8');
const said = (text, lines = []) => (lines.length ? `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>` : text);
const claimsOf = h => Object.keys(h.head().meta.claims ?? {}).sort();
const held = h => h.store.problems().filter(p => p.code === 'REPLAY_PREREQUISITE');

async function sdHost(t) {
    t.mock.method(console, 'warn', () => {});
    let host = null;
    const director = withD1(createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text) } }));
    host = await createHost({ modules: [director], settings: { 'story-director.pulse': false } });
    t.after(() => host.close());
    await host.packs.packs.install(PACK, { origin: 'pack.json' });
    return host;
}
async function reread(h, index, text) {
    await h.st.editMessage(index, text);
    const res = await h.sdk.reread(index);
    assert.equal(res.ok, true, res.message);
}

test('clock:seed: Re-reads of the first and second reply keep the one seed claim, no Problem', async t => {
    const h = await sdHost(t);
    await h.send('x', said('R0.'));
    await h.send('x', said('R1.'));
    const before = claimsOf(h);
    assert.ok(before.includes('clock:seed'));
    await reread(h, 2, said('R0.', ['plus']));
    await reread(h, 4, said('R1.', ['plus']));
    assert.deepEqual(claimsOf(h), before);
    assert.deepEqual(held(h), []);
    h.store.rebuild();
    assert.deepEqual(claimsOf(h), before);
    assert.deepEqual(held(h), []);
});

test('lapse:<thread>: an edited Re-read that moves the time jump earlier keeps one lapse claim, no Problem', async t => {
    const h = await sdHost(t);
    const hook = ['~ time Goldwane 12, 08:00 pm', '+ hook Rat Culling — rats | giver: Danique | reward: 5 copper | due: Goldwane 13'];
    await h.send('x', said('R0.', hook));
    await h.send('x', said('R1.', ['! time +30h']));
    await h.send('x', said('R2.'));
    await h.send('x', said('R3.'));
    const lapses = () => claimsOf(h).filter(key => key.startsWith('lapse:'));
    assert.equal(lapses().length, 1);
    const before = claimsOf(h);
    await reread(h, 2, said('R0.', [...hook, '! time +30h']));
    for (const index of [4, 6, 8]) await reread(h, index, h.ctx.chat[index].mes);
    assert.equal(lapses().length, 1);
    assert.deepEqual(claimsOf(h).filter(key => !key.startsWith('advance:')), before.filter(key => !key.startsWith('advance:')));
    assert.deepEqual(held(h), []);
});
