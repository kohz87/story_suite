// R2: the story facts a settled fight shares with NPC State (pack format 4, §5.4): a level the XP gains is written to the person's record (only up), and a higher
// Level NPC State holds raises the sheet first (never lowers it). Replay equals live: swipe, swipe back, edited Re-read (grown, shrunk), middle delete, rewind, reload.
import test from 'node:test';
import assert from 'node:assert/strict';
import { seedCrypto } from '../../../suite/qa/helpers/seeded.js';
import { peopleEdits } from '../../../../modules/people/domain/edits.js';
import { openFight, stage, step, v1Host } from './v1.helpers.js';

const CHAR = 'pack.chat/character';
const person = level => ({ v: 1, order: ['npc_astra'], npcs: { npc_astra: { id: 'npc_astra', name: 'Astra', ...(level ? { level } : {}) } } });
const mount = level => ({ domains: { people: { initial: () => person(level) } }, commands: Object.fromEntries(Object.entries(peopleEdits('people')).map(([name, edit]) => [name, edit.handler])) });
const sheet = host => { const fields = host.head().domains.dataModules.instances[CHAR].chat.fields; return { level: fields.level, xp: fields.xp, points: fields.points }; };
const story = host => host.head().domains.people.npcs.npc_astra.level;
const both = host => JSON.stringify([sheet(host), story(host)]);
const won = async ({ level, hero = {} }) => {
    const made = await v1Host({ ...mount(level), hero: { str: 30, xp: 95, points: 0, ...hero }, count: 1, level: 5, tier: 'standard' });
    assert.equal(openFight(made.host).ok, true);
    for (let at = 0; at < 14; at += 1) stage(made.host, step('skill'));
    await made.host.send('Go.', 'Done.');
    return made;
};
const reload = async (host, label) => {
    await host.store.flush();
    const chat = structuredClone(host.ctx.chat), meta = structuredClone(host.ctx.chatMetadata);
    await host.st.loadChat(chat, `facts-${label}`);
    host.ctx.chatMetadata = meta;
};

test('a level the fight\'s XP gains is written to the person\'s record, and only a level up', async () => {
    const restore = seedCrypto(5);
    const { host } = await won({ level: 5 });
    try {
        assert.deepEqual(sheet(host), { level: 6, xp: 10, points: 1 }, '95 + 15 XP rises Astra to 6');
        assert.equal(story(host), 6, 'NPC State holds it');
    } finally { host.close(); restore(); }
    const none = await won({ level: 5, hero: { xp: 0 } });
    try {
        assert.equal(sheet(none.host).level, 5);
        assert.equal(story(none.host), 5, 'no level gained: nothing written');
    } finally { none.host.close(); restore(); }
});

test('a higher Level in NPC State raises the sheet before the XP (one point a level, never lowered); a record with no Level is given the sheet\'s', async () => {
    const restore = seedCrypto(6);
    const high = await won({ level: 9, hero: { xp: 0 } });
    try {
        assert.deepEqual(sheet(high.host), { level: 9, xp: 15, points: 4 }, 'raised 5 -> 9, then the fight\'s 15 XP');
        assert.equal(story(high.host), 9);
    } finally { high.host.close(); }
    const low = await won({ level: 2, hero: { xp: 0 } });
    try {
        assert.equal(sheet(low.host).level, 5, 'a lower NPC State level never lowers the sheet');
        assert.equal(story(low.host), 2, 'and the person keeps theirs (a story fact only goes up)');
    } finally { low.host.close(); }
    const blank = await won({ level: 0, hero: { xp: 95 } });
    try {
        assert.equal(story(blank.host), 6, 'a record with no Level is given the sheet\'s new one');
    } finally { blank.host.close(); restore(); }
});

test('replay equals live: swipe, swipe back, edited Re-read (grown, shrunk), rewind, middle delete, reload', async () => {
    const restore = seedCrypto(9);
    const { host } = await won({ level: 5 });
    try {
        const live = both(host), whole = JSON.stringify(host.head());
        assert.equal(live, JSON.stringify([{ level: 6, xp: 10, points: 1 }, 6]), 'the level is written in the live reply');
        host.store.rebuild();
        assert.equal(both(host), live, 'rebuild');
        await reload(host, 'one');
        assert.equal(both(host), live, 'reload');
        await host.swipe('Told again.');
        assert.equal(both(host), live, 'swipe: written once');
        await host.st.swipeTo(2, 0);
        assert.equal(JSON.stringify(host.head()), whole, 'swipe back: as before');
        const text = host.ctx.chat[2].mes;
        await host.st.editMessage(2, `${text}\nAnd more words.`);
        assert.equal((await host.sdk.reread(2)).ok, true);
        assert.equal(both(host), live, 'Re-read grown');
        await host.st.editMessage(2, text);
        assert.equal((await host.sdk.reread(2)).ok, true);
        assert.equal(both(host), live, 'Re-read shrunk');
        const entry = host.store.receipts().filter(item => item.index === 2).find(item => item.receipt.type === 'interaction.settle');
        assert.equal((await host.sdk.rewind({ index: entry.index, beforeRev: entry.receipt.rev })).ok, true);
        assert.equal(both(host), JSON.stringify([{ level: 5, xp: 95, points: 0 }, 5]), 'rewind: before the fight, both');
    } finally { host.close(); restore(); }
    const again = await won({ level: 5 });
    try {
        await again.host.send('Later.', 'A later reply.');
        await again.host.st.deleteMessage(2);
        await again.host.st.deleteMessage(1);
        assert.equal(both(again.host), JSON.stringify([{ level: 5, xp: 95, points: 0 }, 5]), 'a middle delete takes the fight and its level with it');
        const kept = both(again.host);
        again.host.store.rebuild();
        assert.equal(both(again.host), kept, 'live == rebuild');
        await reload(again.host, 'two');
        assert.equal(both(again.host), kept, 'live == reload');
    } finally { again.host.close(); restore(); }
});
