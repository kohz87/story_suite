// Standalone checks on the real host with nothing but Story Block and Story Director: a fresh chat rolls the story's check and
// Assist's pre-roll for the player before any character is set, a character set afterwards is used, and every rebuild, reload and
// swipe gives the live state.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeModel, createHost } from '../../../../testkit/index.js';
import { createModule } from '../../../../modules/director/module.js';

const CHECK = '? check Stealth — sneak past the guard | dc: hard';
const ok = out => assert.equal(out.ok, true, JSON.stringify(out));
const log = host => Object.values(host.head().domains.checks.log);

/** The head after a full rebuild and in a host that loads the saved chat are the live head. */
async function sameEverywhere(host, t) {
    const live = structuredClone(host.head());
    host.store.rebuild();
    assert.deepEqual(host.head(), live, 'a rebuild gives the live state');
    const loaded = await createHost({ modules: [createModule()], st: { chat: structuredClone(host.ctx.chat), extensionSettings: structuredClone(host.ctx.extensionSettings) } });
    t.after(() => loaded.close());
    assert.deepEqual(loaded.head().domains, live.domains, 'a reload gives the live state');
    assert.deepEqual(loaded.head().meta.claims, live.meta.claims);
    assert.deepEqual(host.store.problems(), []);
}

test('a fresh chat: the story\'s check and Assist\'s pre-roll roll for the player with no character set', async t => {
    const model = createFakeModel([], { fallback: CHECK });
    const host = await createHost({ modules: [createModule()], callModel: model, settings: { modules: { 'story-block': { assistClassifier: true } } } });
    t.after(() => host.close());
    await host.send('I sneak past the guard.', `You slip by.\n<Changes>\n${CHECK}\n</Changes>`);
    assert.equal(model.calls.length, 1, 'the pre-roll asked the classifier');
    assert.deepEqual(host.turn.problems(), []);
    const receipts = host.ctx.chat.flatMap(message => message.extra?.storySuite?.receipts ?? []);
    assert.match(receipts.find(receipt => receipt.type === 'assist.precheck').summary, /^You try Stealth: d20 \d+ \+0 = \d+ against 20/);
    assert.match(receipts.find(receipt => receipt.type === 'capture.check').summary, /^You try Stealth/);
    assert.deepEqual(log(host).map(check => [check.actor, check.mod]), [[null, 0], [null, 0]]);
    assert.deepEqual(host.sdk.query('checks.policy', {}).actors, {});
    await sameEverywhere(host, t);

    // The reader sets a character afterwards; the next check uses it.
    const policy = host.sdk.query('checks.policy', {});
    ok(await host.sdk.command('checks.actor', { write: 'wr_00000001', name: 'Mara', bonuses: { DEX: 2 }, expectedHash: policy.hash }));
    await host.send('Again, past the second guard.', `You slip by again.\n<Changes>\n? check Stealth — sneak past the second guard | dc: hard\n</Changes>`);
    assert.deepEqual(log(host).at(-1).mod, 2);
    await host.swipe(`This time he turns.\n<Changes>\n? check Stealth — duck behind the cart | dc: normal\n</Changes>`);
    assert.equal(log(host).at(-1).dc, 15);
    await sameEverywhere(host, t);
});
