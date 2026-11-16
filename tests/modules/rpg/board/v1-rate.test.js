// The XP rate setting reaches a v1 fight the board view opens (the Fight tab's start and a pre-check offer's board), and so the win's pay; never only the opening's setup.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoardView } from '../../../../modules/rpg/board/view.js';
import { xpRateFrom } from '../../../../modules/rpg/levels.js';
import { STANDARD_FORMULA } from '../../../../modules/rpg/rules.js';
import { seedCrypto } from '../../../suite/qa/helpers/seeded.js';
import { setupDom } from '../../../ui/view/mounts/helpers.js';
import { rollReceipt } from '../helpers.js';
import { stage, step, v1Host } from './v1.helpers.js';

const CHAR = 'pack.chat/character';
const xp = host => host.head().domains.dataModules.instances[CHAR].chat.fields.xp;
const paid = host => rollReceipt(host, 2)?.data?.v2?.result?.paid?.xp;

// The board view as the mount builds it: `rate` is the setting read when the fight opens.
function viewOf(host, values) {
    const meta = () => host.ctx.chatMetadata;
    return createBoardView({ doc: setupDom(), headState: () => host.head(), meta, store: host.store, interaction: host.sdk.interaction ?? null, rules: () => STANDARD_FORMULA,
        query: (name, args) => host.sdk.query(name, args), readerName: () => 'Astra', levels: () => ({ ranks: [], playerRank: null }), on: () => true, rate: () => xpRateFrom(values) });
}

test('a v1 fight the board view opens carries the XP rate setting, and its win pays at that rate (swipe and reload keep it)', async t => {
    const restore = seedCrypto(5);
    const { host } = await v1Host({ hero: { str: 30 }, count: 1, level: 5, tier: 'standard' });
    t.after(() => { host.close(); restore(); });
    assert.ok(host.sdk.interaction?.open, 'the host gives the view its interaction port');
    const view = viewOf(host, { rpgXpRate: 200 });
    assert.equal(view.open(), true);
    assert.equal(host.ctx.chatMetadata.storySuiteInteraction.open.setup.rate, 200, 'the setting is in the fight\'s own setup');
    for (let at = 0; at < 14; at += 1) stage(host, step('skill'));
    await host.send('Go.', 'Done.');
    assert.deepEqual(paid(host), [{ who: 'Astra', xp: 30 }], '30, not 15');
    assert.equal(xp(host), 30);
    await host.swipe('Told again.');
    assert.equal(xp(host), 30, 'swipe: paid once');
    await host.store.flush();
    await host.st.loadChat(structuredClone(host.ctx.chat), 'rate-reload');
    assert.equal(xp(host), 30, 'reload');
});

test('with no rate setting the fight pays at 100 (the view asks for the setting, not a default of its own)', async t => {
    const restore = seedCrypto(5);
    const { host } = await v1Host({ hero: { str: 30 }, count: 1, level: 5, tier: 'standard' });
    t.after(() => { host.close(); restore(); });
    assert.equal(viewOf(host, null).open(), true);
    for (let at = 0; at < 14; at += 1) stage(host, step('skill'));
    await host.send('Go.', 'Done.');
    assert.deepEqual(paid(host), [{ who: 'Astra', xp: 15 }]);
});
