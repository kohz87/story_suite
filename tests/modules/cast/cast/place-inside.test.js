// FU134: a spot named in town stays in town. The owner's play: the party at "Bluewatch Village / Guild Office", then
// `~ place Bluewatch River-Gate Storehouse | kind: settlement | region: Bluewatch Reach` (a storehouse in the village, no travel).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createHost } from '../../../../testkit/index.js';
import { createModule } from '../../../../modules/director/module.js';
import { TAIL_KEY, sent } from './helpers.js';

const ERSVEIL = readFileSync(new URL('../../../../examples/packs/ersveil/pack.json', import.meta.url), 'utf8');
const ERSVEIL_GAME = readFileSync(new URL('../../../../examples/packs/ersveil-game/pack.json', import.meta.url), 'utf8');
const said = (text, lines) => `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>`;
const STORE = '~ place Bluewatch River-Gate Storehouse | kind: settlement | region: Bluewatch Reach';
const hereOf = host => (sent(host, TAIL_KEY).at(-1) ?? '').split('\n').find(line => line.startsWith('[People here]')) ?? '';
const sceneOf = host => host.head().domains.scene.place;

async function ersveil() {
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text), feature: id => host?.features.on(id),
        callModel: async () => ({ ok: false, error: 'BUSY', text: '' }), canCallModel: () => true, chat: () => host?.ctx.chat ?? [] } });
    host = await createHost({ modules: [module], settings: { features: { 'story-director.pulse': false } } });
    assert.equal((await host.packs.packs.install(ERSVEIL, { origin: 'pack.json' })).ok, true);
    assert.equal((await host.packs.packs.install(ERSVEIL_GAME, { origin: 'pack.json' })).ok, true);
    await host.st.loadChat([{ name: 'Narrator', is_user: false, is_system: false, mes: 'You arrive at the guild office.' }], 'fu134');
    return host;
}

test('the owner\'s lines: the storehouse is filed inside Bluewatch Village, a building not a settlement, and Sister Temiwa is still here', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await ersveil();
    try {
        await host.send('I look around.', 'The guild office.');
        assert.equal(sceneOf(host).name, 'Bluewatch Village / Guild Office');
        await host.send('We walk to the river gate.', said('The storehouse by the river gate.', [STORE]));
        assert.deepEqual(sceneOf(host), { name: 'Bluewatch Village / Bluewatch River-Gate Storehouse', kind: 'building', region: 'Bluewatch Reach' });
        const receipt = host.sdk.receipts().map(entry => entry.receipt.summary ?? '').find(text => /Storehouse/.test(text));
        assert.match(receipt, /filed inside Bluewatch Village: a spot, so its kind is building, not a settlement/);
        await host.send('I ask for the sealer in the Bluewatch village.', 'Inside the storehouse.');
        assert.match(hereOf(host), /Sister Temiwa, Bluewatch's healer-sealer/, 'the people of the village are here');
        const spot = host.sdk.query('atlas.place', { name: 'Bluewatch Village / Bluewatch River-Gate Storehouse' });
        assert.equal(spot?.kind, 'building');
        assert.ok(spot.parent, 'its parent is saved');
        assert.equal(host.sdk.query('atlas.place', { id: spot.parent })?.name, 'Bluewatch Village', 'the village');
    } finally { await host.dispose?.(); }
});

test('swipe, a chat change and back, and a middle delete leave the same place and the same line', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await ersveil();
    try {
        await host.send('I look around.', 'The guild office.');
        await host.send('Out we go.', said('The storehouse by the river gate.', [STORE]));
        await host.send('I wait.', 'Time passes.');
        const place = structuredClone(sceneOf(host));
        const line = hereOf(host);
        await host.swipe('Time passes, again.');
        assert.deepEqual(sceneOf(host), place);
        assert.equal(hereOf(host), line);
        const saved = structuredClone(host.ctx.chat);
        await host.st.loadChat([], 'other');
        await host.st.loadChat(structuredClone(saved), 'fu134');
        await host.regenerate('After a reload.');
        assert.deepEqual(sceneOf(host), place);
        assert.equal(hereOf(host), line);
        // the same line written again in a later reply is the same place, not a move
        await host.send('We stay.', said('Still inside.', ['~ place Bluewatch River-Gate Storehouse']));
        assert.deepEqual(sceneOf(host), place);
        await host.st.deleteMessage(1);
        await host.send('Again.', 'The office.');
        assert.match(hereOf(host), /Sister Temiwa/);
    } finally { await host.dispose?.(); }
});

test('a real move to another village stays a settlement, and "Other Town / Spot" is left as written', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await ersveil();
    try {
        await host.send('I look around.', 'The guild office.');
        await host.send('We go to Auvoth.', said('Days on the road.', ['~ time +2 days', '~ place Marrowfen | kind: village | region: Marsh Reach']));
        assert.deepEqual(sceneOf(host), { name: 'Marrowfen', kind: 'village', region: 'Marsh Reach' }, 'a different region and a time jump: a village of its own');
        await host.send('Into the inn.', said('The inn.', ['~ place Marrowfen / The Low Inn | kind: building']));
        assert.deepEqual(sceneOf(host), { name: 'Marrowfen / The Low Inn', kind: 'building', region: 'Marsh Reach' }, 'a "Town / Spot" line is left as written');
    } finally { await host.dispose?.(); }
});
