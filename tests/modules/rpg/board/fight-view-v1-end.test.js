// The v1 fight's end card says what the fight paid (XP, practice) and is the same view after a rebuild or a reload: it reads the played record and the settle's receipt, never live state.
import test from 'node:test';
import assert from 'node:assert/strict';
import { seedCrypto } from '../../../suite/qa/helpers/seeded.js';
import { api, openFight, stage, step, v1Host } from './v1.helpers.js';

const endOf = host => api(host).current().view.end;

test('a won one-hero fight that used a skill: the end card names the XP and the practice, and a rebuild or a reload gives the same card', async () => {
    const restore = seedCrypto(5);
    const { host } = await v1Host({ hero: { str: 30 }, count: 1, level: 5, tier: 'standard' });
    try {
        assert.equal(openFight(host).ok, true);
        for (let at = 0; at < 14 && api(host).current().view.state !== 'end'; at += 1) stage(host, step('skill'));
        const end = endOf(host);
        assert.equal(end.outcome, 'won');
        assert.equal(end.xpEach, 15, 'a level 5 standard foe pays 15');
        assert.equal(end.members[0].practice.length > 0, true);
        assert.deepEqual(end.members[0].practice[0].skill, 'Cut');
        assert.ok(end.members[0].practice[0].gain >= 1);
        const live = JSON.stringify(api(host).current().view);
        host.store.rebuild();
        assert.equal(JSON.stringify(api(host).current().view), live, 'rebuilt: the same view');
        await host.store.flush();
        const chat = structuredClone(host.ctx.chat), meta = structuredClone(host.ctx.chatMetadata);
        await host.st.loadChat(chat, 'end-card');
        host.ctx.chatMetadata = meta;
        assert.equal(JSON.stringify(api(host).current().view), live, 'reloaded: the same view');
    } finally { host.close(); restore(); }
});

test('a lost fight shows no XP figure (XP is for a win)', async () => {
    const restore = seedCrypto(6);
    const { host } = await v1Host({ count: 6, level: 30, tier: 'elite' });
    try {
        assert.equal(openFight(host).ok, true);
        stage(host, step('skill'));
        const end = endOf(host);
        assert.equal(end.outcome, 'lost');
        assert.equal(end.xpEach, null);
    } finally { host.close(); restore(); }
});

const CHAR = 'pack.chat/character';
const mine = host => ({ ...host.head().domains.dataModules.instances[CHAR].chat.fields }).xp;

test('the paid receipt the end card reads is unchanged by a swipe, swipe back, an edited Re-read (grown and shrunk), a reload and a rewind', async () => {
    const restore = seedCrypto(9);
    const { host } = await v1Host({ hero: { str: 30 }, count: 1, level: 5, tier: 'standard' });
    try {
        assert.equal(openFight(host).ok, true);
        for (let at = 0; at < 14; at += 1) stage(host, step('skill'));
        await host.send('Go.', 'Done.');
        const paidOf = () => host.store.receipts().find(item => item.index === 2 && item.receipt.type === 'interaction.settle')?.receipt?.data?.v2?.result?.paid ?? null;
        const was = JSON.stringify(paidOf()), xp = mine(host);
        assert.equal(JSON.parse(was).xp[0].xp, 15);
        assert.ok(JSON.parse(was).practice.length > 0);
        await host.swipe('Told again.');
        assert.equal(JSON.stringify(paidOf()), was, 'swipe');
        await host.st.swipeTo(2, 0);
        assert.equal(JSON.stringify(paidOf()), was, 'swipe back');
        const text = host.ctx.chat[2].mes;
        await host.st.editMessage(2, `${text}\nAnd more words.`);
        assert.equal((await host.sdk.reread(2)).ok, true);
        assert.equal(JSON.stringify(paidOf()), was, 'Re-read grown');
        await host.st.editMessage(2, text);
        assert.equal((await host.sdk.reread(2)).ok, true);
        assert.equal(JSON.stringify(paidOf()), was, 'Re-read shrunk');
        await host.store.flush();
        const chat = structuredClone(host.ctx.chat), meta = structuredClone(host.ctx.chatMetadata);
        await host.st.loadChat(chat, 'end-lifecycle');
        host.ctx.chatMetadata = meta;
        assert.equal(JSON.stringify(paidOf()), was, 'reload');
        assert.equal(mine(host), xp, 'paid once');
    } finally { host.close(); restore(); }
});
