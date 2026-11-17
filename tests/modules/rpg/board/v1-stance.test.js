// The stance switch on the v1 fight: a step's `args.stance === false` leaves the stance off for that exchange (no Stamina spent), the view carries the switch, and Auto keeps a stance that was switched off off.
import test from 'node:test';
import assert from 'node:assert/strict';
import { seedCrypto } from '../../../suite/qa/helpers/seeded.js';
import { api, HERO_ID, openFight, stage, step, v1Blocks } from './v1.helpers.js';
import { setup } from '../helpers.js';

const withStance = () => {
    const blocks = v1Blocks({ count: 3, level: 5 });
    blocks.skills.fields = { ...blocks.skills.fields, skill2: 'Shield work', stat2: 'str', type2: 'defence', practice2: 100, rank2: 1 };
    return blocks;
};
const host0 = async () => (await setup({ blocks: withStance(), board: true, planner: false })).host;
const view = host => api(host).current().view;
const hero = host => view(host).party[0];
const stanceLine = host => view(host).result.rounds.at(-1).find(row => row[0] === 'stance');

test('the view carries the stance: on at the first exchange, with the soak with and without it', async () => {
    const restore = seedCrypto(5);
    try {
        const host = await host0();
        assert.equal(openFight(host).ok, true);
        const { stance } = view(host).actors[0];
        assert.equal(stance.name, 'Shield work');
        assert.equal(stance.on, true);
        assert.equal(stance.paid, null);
        assert.ok(stance.soakOn > stance.soakOff && stance.soakOff === 10, `vit 10 soaks 10%; the stance adds its mastery (${JSON.stringify(stance)})`);
        assert.deepEqual(view(host).actor.stance, stance);
    } finally { restore(); }
});

test('args.stance false: the stance line is empty and no Stamina is spent; the default pays 1 SP; replaying the same steps gives the same record', async () => {
    const restore = seedCrypto(6);
    try {
        const on = await host0(), off = await host0();
        assert.equal(openFight(on).ok, true);
        assert.equal(openFight(off).ok, true);
        const sp0 = hero(on).sp;
        assert.equal(stage(on, step('normal')).ok, true);
        assert.equal(stage(off, step('normal', { target: '1.1', stance: false })).ok, true);
        assert.equal(hero(on).sp, sp0 - 1, 'on: the upkeep is paid');
        assert.equal(hero(off).sp, sp0, 'off: nothing is spent');
        assert.equal(view(on).actors[0].stance.on, true);
        assert.equal(view(off).actors[0].stance.on, false, 'the switch starts where the last exchange left it');
        const live = JSON.stringify(view(off));
        off.store.rebuild();
        assert.equal(JSON.stringify(view(off)), live, 'rebuilt: the same view');
    } finally { restore(); }
});

test('Auto keeps a stance switched off off, and an Auto after an on pick leaves it to the engine', async () => {
    const restore = seedCrypto(7);
    try {
        const host = await host0();
        assert.equal(openFight(host).ok, true);
        assert.equal(stage(host, step('normal', { target: '1.1', stance: false })).ok, true);
        const id = host.ctx.chatMetadata.storySuiteInteraction.open.id;
        assert.equal(api(host).auto(id, 1).ok, true);
        assert.deepEqual(stanceLine(host), ['stance', 'Astra', []], 'the Auto exchange did not turn the stance back on');
        assert.equal(view(host).actors[0].stance.on, false);
        // an Auto after a pick that left it on is the engine's own policy: the stance is up and paid
        const other = await host0();
        assert.equal(openFight(other).ok, true);
        assert.equal(stage(other, step('normal')).ok, true);
        assert.equal(api(other).auto(other.ctx.chatMetadata.storySuiteInteraction.open.id, 1).ok, true);
        assert.deepEqual(stanceLine(other), ['stance', 'Astra', ['defence']]);
    } finally { restore(); }
});

const spOf = host => host.head().domains.dataModules.instances['pack.chat/character'].chat.fields.sp;

test('a stance switched off for an exchange stays off, and nothing is spent, after the reply is sent, a swipe, swipe back, an edited Re-read (grown and shrunk) and a reload; with it on the Stamina is paid once', async () => {
    const restore = seedCrypto(8);
    try {
        const off = await host0(), on = await host0();
        for (const [host, args] of [[off, { target: '1.1', stance: false }], [on, { target: '1.1' }]]) {
            assert.equal(openFight(host).ok, true);
            assert.equal(stage(host, step('normal', args)).ok, true);
            await host.send('Go.', 'Done.');
        }
        assert.equal(spOf(on), spOf(off) - 1, 'on: one Stamina for the stance; off: none');
        const was = spOf(off), wasOn = spOf(on);
        for (const [host, wanted] of [[off, was], [on, wasOn]]) {
            await host.swipe('Told again.');
            assert.equal(spOf(host), wanted, 'swipe');
            await host.st.swipeTo(2, 0);
            assert.equal(spOf(host), wanted, 'swipe back');
            const text = host.ctx.chat[2].mes;
            await host.st.editMessage(2, `${text}\nAnd more words.`);
            assert.equal((await host.sdk.reread(2)).ok, true);
            assert.equal(spOf(host), wanted, 'Re-read grown');
            await host.st.editMessage(2, text);
            assert.equal((await host.sdk.reread(2)).ok, true);
            assert.equal(spOf(host), wanted, 'Re-read shrunk');
            await host.store.flush();
            const chat = structuredClone(host.ctx.chat), meta = structuredClone(host.ctx.chatMetadata);
            await host.st.loadChat(chat, 'stance-lifecycle');
            host.ctx.chatMetadata = meta;
            assert.equal(spOf(host), wanted, 'reload');
        }
    } finally { restore(); }
});
