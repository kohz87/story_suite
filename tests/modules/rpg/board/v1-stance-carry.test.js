// A stance switched off stays off across the replies of one fight and with Auto: the next reply's setup carries it (from the steps sent), the view shows it off, a pick without a switch and Auto keep it off,
// turning it on writes `stance: true`, Auto reads the switch as left for this exchange, and every replay (swipe, swipe back, Re-read, reload) leaves the same state.
import test from 'node:test';
import assert from 'node:assert/strict';
import { seedCrypto } from '../../../suite/qa/helpers/seeded.js';
import { api, HERO_ID, openFight, stage, step, v1Blocks } from './v1.helpers.js';
import { setup } from '../helpers.js';

const host0 = async () => {
    const blocks = v1Blocks({ count: 3, level: 5 });
    blocks.skills.fields = { ...blocks.skills.fields, skill2: 'Shield work', stat2: 'str', type2: 'defence', practice2: 100, rank2: 1 };
    return (await setup({ blocks, board: true, planner: false })).host;
};
const open = host => host.ctx.chatMetadata.storySuiteInteraction.open;
const view = host => api(host).current().view;
const lastStance = host => view(host).result.rounds.at(-1).find(row => row[0] === 'stance');
const spOf = host => host.head().domains.dataModules.instances['pack.chat/character'].chat.fields.sp;
// the fight left off in reply one and still open in reply two
const secondReply = async (args = { target: '1.1', stance: false }) => {
    const host = await host0();
    assert.equal(openFight(host).ok, true);
    assert.equal(stage(host, step('normal', args)).ok, true);
    await host.send('Go.', 'Done.');
    assert.equal(view(host).result.stop, 'open');
    return host;
};

test('the next reply starts with the stance off (view and carried setup), and a pick with no switch pays nothing', async () => {
    const restore = seedCrypto(11);
    try {
        const host = await secondReply();
        assert.equal(open(host).setup.stance[HERO_ID], false);
        assert.equal(view(host).actors[0].stance.on, false, 'the row does not show on again');
        const sp = spOf(host);
        assert.equal(stage(host, step('normal')).ok, true);
        assert.deepEqual(lastStance(host), ['stance', 'Astra', []]);
        assert.equal(spOf(host), sp, 'no Stamina is paid');
    } finally { restore(); }
});

test('the next reply: Auto keeps it off; turning it on (stance true) pays it and clears the carry', async () => {
    const restore = seedCrypto(12);
    try {
        const host = await secondReply(), on = await secondReply();
        assert.equal(api(host).auto(open(host).id, 1).ok, true);
        assert.deepEqual(lastStance(host), ['stance', 'Astra', []]);
        assert.equal(stage(on, step('normal', { target: '1.1', stance: true })).ok, true);
        assert.deepEqual(lastStance(on), ['stance', 'Astra', ['defence']]);
        assert.equal(view(on).actors[0].stance.on, true);
    } finally { restore(); }
});

test('Auto honours the switch as left for this exchange: off with nothing staged, and on over a carried off', async () => {
    const restore = seedCrypto(13);
    try {
        const fresh = await host0();
        assert.equal(openFight(fresh).ok, true);
        assert.equal(api(fresh).auto(open(fresh).id, 1, { [HERO_ID]: false }).ok, true);
        assert.deepEqual(lastStance(fresh), ['stance', 'Astra', []]);
        assert.equal(open(fresh).steps[0].inputs[0].args.stance, false, 'the stored step says so, so a replay needs no switch');
        const carried = await secondReply();
        assert.equal(api(carried).auto(open(carried).id, 1, { [HERO_ID]: true }).ok, true);
        assert.deepEqual(lastStance(carried), ['stance', 'Astra', ['defence']]);
    } finally { restore(); }
});

test('what a fight left off is the same after the reply is sent again, a swipe, swipe back, an edited Re-read (grown and shrunk), a reload', async () => {
    const restore = seedCrypto(14);
    try {
        const host = await secondReply();
        await host.send('Again.', 'Done again.');
        const next = JSON.stringify(open(host).setup), sp = spOf(host), shown = JSON.stringify(view(host).actors);
        assert.equal(JSON.parse(next).stance[HERO_ID], false, 'still off after the second reply');
        const check = what => { assert.equal(JSON.stringify(open(host).setup), next, what); assert.equal(spOf(host), sp, what); assert.equal(JSON.stringify(view(host).actors), shown, what); };
        await host.swipe('Told again.'); check('swipe');
        await host.st.swipeTo(host.ctx.chat.length - 1, 0); check('swipe back');
        const at = host.ctx.chat.length - 1, text = host.ctx.chat[at].mes;
        await host.st.editMessage(at, `${text}\nAnd more words.`);
        assert.equal((await host.sdk.reread(at)).ok, true); check('Re-read grown');
        await host.st.editMessage(at, text);
        assert.equal((await host.sdk.reread(at)).ok, true); check('Re-read shrunk');
        await host.store.flush();
        const chat = structuredClone(host.ctx.chat), meta = structuredClone(host.ctx.chatMetadata);
        await host.st.loadChat(chat, 'stance-carry');
        host.ctx.chatMetadata = meta;
        check('reload');
    } finally { restore(); }
});
