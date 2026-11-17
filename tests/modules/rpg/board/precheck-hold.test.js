// While the pre-check's one model call is running, a second send is held by the core (the waiting choice is a `working` hold of the fight kind), and a waiting choice of a kind whose feature
// is off is not held (there is no screen left to clear it): the RPG turned off during a pause releases the send.
import test from 'node:test';
import assert from 'node:assert/strict';
import { seedCrypto } from '../../../suite/qa/helpers/seeded.js';
import { NEVER, setup } from '../helpers.js';
import { v1Blocks } from './v1.helpers.js';
import { holdStart } from '../../../../core/interaction/start-hold.js';
import { LEAN_RPG_FEATURE } from '../../../../modules/rpg/names.js';

const blocks = () => v1Blocks({ count: 0 });
const ATTACK = 'I creep down the culvert and attack the six Gorged Grey-Tooth Tunnel Rats.';

test('a second send is held while the pre-check runs, by a hold that names the fight', async () => {
    const restore = seedCrypto(808), { host } = await setup({ blocks: blocks(), board: true, planner: false, precheck: true, answers: [NEVER], timeoutMs: 300 });
    try {
        await host.send('A quiet approach.', 'The path is clear.');
        const running = host.send(ATTACK, 'Never told.');
        running.catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 30));
        const start = host.ctx.chatMetadata.storySuiteInteraction?.start;
        assert.equal(start?.mode, 'working', 'the check is running and holds the send');
        assert.equal(start.kindId, 'story-block/fight');
        assert.equal(start.title, 'Fight', 'the hold names the fight, so the reason reads "Play the waiting Fight."');
        const second = await host.st.generate('regenerate', { reply: 'Too soon.' });
        assert.equal(second.aborted, true, 'the second send did not go out');
        await running;
    } finally { host.close(); restore(); }
});

test('with the RPG turned off during a pause, the waiting choice no longer holds the send (the board is on whenever the RPG is)', async () => {
    const restore = seedCrypto(809), { host } = await setup({ blocks: blocks(), board: true, planner: false });
    try {
        await host.send('A quiet approach.', 'The path is clear.');
        host.ctx.chat.push({ is_user: true, name: 'You', mes: ATTACK, extra: {} });
        assert.ok(holdStart(host.ctx.chatMetadata, host.ctx.chat, { kindId: 'story-block/fight', title: 'Fight', mode: 'known' }));
        assert.equal((await host.st.generate('regenerate', { reply: 'Held.' })).aborted, true, 'held while the RPG is on');
        host.features.set(LEAN_RPG_FEATURE, false);
        assert.notEqual((await host.st.generate('regenerate', { reply: 'Released.' })).aborted, true, 'released with the RPG off');
    } finally { host.close(); restore(); }
});
