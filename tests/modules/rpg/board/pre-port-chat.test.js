// Chats made before the port (INTERACTION-PLAN 6.4), on the recorded combat corpus: a settled fight stays (the combat-corpus tests pin its replay), an open unsent fight is closed on load with
// one quiet Problem and its old keys go, a swipe or a regenerate of a reply whose fight was settled before the port is written without it (one quiet Problem; swiping back keeps it).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setup } from '../helpers.js';
import { seedCrypto } from '../../../suite/qa/helpers/seeded.js';

const chats = JSON.parse(readFileSync(new URL('../../../core/fixtures/combat-corpus/chats.json', import.meta.url), 'utf8'));
const OLD_KEYS = ['rpgFightBoard', 'rpgFightLast', 'rpgFightAttempts', 'rpgFightSend', 'rpgFightStart', 'rpgFightHeld', 'rpgFightHeldDiscarded'];

async function load(name) {
    const fixture = chats[name], restore = seedCrypto(fixture.seed);
    // (the real hook, `planner: false`: the scripted stand-in for the retired planner would hide what the hook says)
    const { host } = await setup({ blocks: structuredClone(fixture.blocks), board: fixture.board, settings: structuredClone(fixture.settings), planner: false });
    host.ctx.chatMetadata = structuredClone(fixture.chatMetadata);
    await host.st.loadChat(structuredClone(fixture.chat), `pre-port-${name}`);
    return { host, fixture, restore };
}
const codes = host => host.turn.problems().map(problem => problem.code);

test('an open unsent fight from before the port is closed on load: its old keys go, with one quiet Problem; a settled fight keeps its record', async () => {
    const { host, fixture, restore } = await load('board-open');
    try {
        assert.ok(OLD_KEYS.some(key => Object.hasOwn(fixture.chatMetadata, key)), 'the recorded chat holds the old keys');
        for (const key of OLD_KEYS) assert.equal(Object.hasOwn(host.ctx.chatMetadata, key), false, `${key} is gone`);
        const closed = host.turn.problems().filter(problem => problem.code === 'FIGHT_CLOSED');
        assert.equal(closed.length, 1);
        assert.equal(closed[0].quiet, true);
        assert.match(closed[0].message, /A fight that was open before the update was closed\. Start it again from the Fight tab\./);
        const settled = host.ctx.chat[2].extra.storySuite.receipts.find(receipt => receipt.type === 'rpg.resolve');
        assert.ok(settled?.replan?.payload?.board, 'the settled pre-port fight record is untouched');
        assert.equal(host.ctx.chatMetadata.storySuiteInteraction, undefined, 'no interaction scratch is made by loading');
    } finally { host.close(); restore(); }
});

test('a regenerate of a reply whose fight was settled before the port is written without it, with one quiet Problem; a reply with no old link says nothing', async () => {
    const { host, restore } = await load('board-won');
    try {
        assert.equal(Object.hasOwn(host.ctx.chatMetadata, 'rpgFightLast'), false, 'the old regenerate cache is gone');
        assert.ok(!codes(host).includes('FIGHT_CLOSED'), 'nothing was open, so no Problem');
        await host.regenerate('Told another way.');
        const notes = host.turn.problems().filter(problem => problem.code === 'FIGHT_NOT_CARRIED');
        assert.equal(notes.length, 1, 'a Problem says so');
        assert.equal(notes[0].quiet, true);
        assert.equal(notes[0].message, 'This reply\'s fight was made before the update, so the new reply is written without it.');
        assert.ok(!host.ctx.chat[2].extra.storySuite.receipts.some(receipt => receipt.type === 'interaction.settle' || (receipt.type === 'rpg.resolve' && receipt.replan?.payload?.board)), 'the new reply carries no fight');
    } finally { host.close(); restore(); }
    const plain = await load('board-won');
    try {
        delete plain.host.ctx.chat[1].extra.rpgFightLinks;
        await plain.host.regenerate('Again.');
        assert.ok(!codes(plain.host).includes('FIGHT_NOT_CARRIED'), 'no link, no note');
    } finally { plain.host.close(); plain.restore(); }
});

test('a swipe of a reply whose fight was settled before the port is written without the fight, with one quiet Problem; swiping back keeps the old record', async () => {
    const { host, restore } = await load('board-won');
    try {
        const before = structuredClone(host.ctx.chat[2].extra.storySuite.receipts.find(receipt => receipt.type === 'rpg.resolve'));
        await host.swipe('Told another way.');
        const swiped = host.ctx.chat[2].extra.storySuite.receipts;
        assert.ok(!swiped.some(receipt => receipt.type === 'interaction.settle' || (receipt.type === 'rpg.resolve' && receipt.replan?.payload?.board)), 'the new try carries no fight');
        const note = host.turn.problems().find(problem => problem.code === 'FIGHT_NOT_CARRIED');
        assert.ok(note, 'a Problem says so');
        assert.equal(note.quiet, true);
        await host.st.swipeTo(2, 0);
        assert.deepEqual(host.ctx.chat[2].extra.storySuite.receipts.find(receipt => receipt.type === 'rpg.resolve'), before, 'swiping back keeps the fight it had');
    } finally { host.close(); restore(); }
});
