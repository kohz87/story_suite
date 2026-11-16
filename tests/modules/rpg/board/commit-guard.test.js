// Staged fight resolution and in-flight edit/gear guards on a test host.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boardWitness, equipmentForBoard, playBoard } from '../../../../modules/rpg/board/engine.js';
import { settledNote } from '../../../../modules/rpg/board/note.js';
import { STANDARD_FORMULA } from '../../../../modules/rpg/rules.js';
import { character, foeBlock, setup } from '../helpers.js';
import { boardSession, openBoard, stageExchange } from '../../../../modules/rpg/board/session.js';
import { planGear } from '../../../../modules/rpg/gear.js';
import { readSheet } from '../../../../modules/rpg/read.js';
import { seedCrypto } from '../../../suite/qa/helpers/seeded.js';
import { gearAnswer } from '../../../../packages/story-block/src/v2/domains/gear.js';
import { condOf, defCarry, ENCUMBERED_PENALTY } from '../../../../packages/story-block/src/v2/domains/inventory.js';
import { aiMessage } from '../../../../packages/story-block/testkit/fake-st.js';
import { gearHost, openWithGear } from './commit.helpers.js';


test('the reply resolver commits exactly the staged exchange and refuses a duplicate claim', async () => {
    const blocks = { hero: { role: 'character', fields: character('Astra') }, foes: { role: 'foes', fields: foeBlock([['Rats', 1, 1, 5]]) } };
    const { host } = await setup({ blocks });
    try {
        const setup = { seed: 24, offset: 0, rules: { ...STANDARD_FORMULA, levelDivisor: 5 } };
        setup.witness = { offset: 0, hash: boardWitness(host.head(), setup) };
        const exchanges = [{ actions: [{ who: 'Astra', kind: 'attack', target: 1 }] }];
        const staged = playBoard(host.head(), setup, exchanges);
        assert.equal(staged.error, undefined);
        const payload = { key: '1-abc', board: { id: 'fight-one', groups: [1], setup, exchanges } };
        const result = host.bus.run('rpg.resolve', payload, { cause: 'system' });
        assert.equal(result.ok, true, result.message);
        const recorded = result.receipt.data.v2.result;
        assert.deepEqual(recorded.rounds, staged.result.rounds);
        assert.deepEqual(recorded.hurts, staged.result.hurts);
        assert.equal(result.receipt.summary, settledNote(recorded));
        for (const hurt of staged.result.hurts) assert.equal(result.state.domains.dataModules.instances[hurt.module].chat.fields[hurt.field], hurt.to);
        // A committed fight moves the sheet, so its witness refuses a replay; the claim itself is checked on a fight with no staged rolls.
        const bare = { key: '2-abc', board: { id: 'fight-two', groups: [1], setup: { seed: 24, offset: 0, rules: setup.rules }, exchanges: [] } };
        const first = host.bus.run('rpg.resolve', bare, { cause: 'system' });
        assert.equal(first.ok, true, first.message);
        const twice = host.bus.run('rpg.resolve', bare, { cause: 'system', state: first.state });
        assert.equal(twice.ok, false);
        assert.equal(twice.code, 'CLAIMED');
    } finally { host.close(); }
});

test('the opening is named from the setup without recording it on the board result', async () => {
    const blocks = { hero: { role: 'character', fields: character('Astra') }, foes: { role: 'foes', fields: foeBlock([['Rats', 2, 1, 5]]) } };
    const { host } = await setup({ blocks });
    try {
        const rules = { ...STANDARD_FORMULA, levelDivisor: 5 }, opened = [{ name: 'Rats', count: 2, level: 1 }];
        const made = host.bus.run('rpg.resolve', { key: '6-abc', board: {
            id: 'members-open', groups: [1], exchanges: [],
            setup: { seed: 24, offset: 0, rules, members: 1, opened },
        } }, { cause: 'system' });
        assert.equal(made.ok, true, made.message);
        assert.equal(Object.hasOwn(made.receipt.data.v2.result, 'opened'), false);
        assert.match(made.receipt.summary, /New foes: Rats ×2 \(Lv 1\), each fought on its own\./);
        const old = host.bus.run('rpg.resolve', { key: '7-abc', board: {
            id: 'old-open', groups: [1], exchanges: [], setup: { seed: 24, offset: 0, rules },
        } }, { cause: 'system' });
        assert.equal(old.ok, true, old.message);
        assert.equal(Object.hasOwn(old.receipt.data.v2.result, 'opened'), false);
        assert.equal(Object.hasOwn(old.receipt.data.v2.result, 'members'), false);
    } finally { host.close(); }
});

test('editing a staged sheet holds generation until the original input is restored', async () => {
    const restore = seedCrypto(81);
    const blocks = { hero: { role: 'character', fields: character('Astra', { str: 5 }) }, foes: { role: 'foes', fields: foeBlock([['Rats', 2, 1, 5]]) } };
    const { host, callModel } = await setup({ blocks, board: true });
    try {
        const meta = host.ctx.chatMetadata, sid = host.store.carrierSid(host.store.headIndex());
        openBoard(meta, host.head(), { sid, rules: { ...STANDARD_FORMULA, levelDivisor: 5 } });
        const staged = stageExchange(meta, host.head(), [{ who: 'Astra', kind: 'attack', target: 11 }]);
        assert.equal(staged.error, undefined);
        assert.equal((await host.sdk.command('test.set', { slug: 'hero', field: 'str', value: 20 })).ok, true);
        const blocked = await host.send('I strike.', 'Should not be sent.');
        assert.equal(blocked.aborted, true);
        assert.match(host.st.notices.at(-1).reason, /restore|discard/i);
        assert.equal(boardSession(meta).exchanges.length, 1);
        assert.equal(callModel.calls.length, 0);
        assert.equal((await host.sdk.command('test.set', { slug: 'hero', field: 'str', value: 5 })).ok, true);
        const sent = await host.st.generate('normal', { reply: 'The fight continues.' });
        assert.notEqual(sent.aborted, true);
        const receipt = host.ctx.chat.at(-1).extra.storySuite.receipts.find(item => item.type === 'rpg.resolve');
        assert.deepEqual(receipt.data.v2.result.rounds, staged.preview.result.rounds);
    } finally { host.close(); restore(); }
});

test('staging retains the recorded carry penalty when mounts are off', async () => {
    const restore = seedCrypto(7), host = await gearHost();
    try {
        const state = structuredClone(host.head()), stack = Object.values(state.domains.inventory.stacks)[0];
        stack.qty = 16;
        state.domains.scene.mounts = { mare: { name: 'Mare', kind: 'horse', count: 1, pace: 35, condition: '', where: '' } };
        const query = (name, args) => name === 'inventory.gear'
            ? gearAnswer(state, args, { condOf, carryOf: defCarry, penalty: ENCUMBERED_PENALTY, mounts: [] }) : host.sdk.query(name, args);
        const gear = planGear(readSheet(state), query);
        assert.equal(gear.who.astra.enc, -2);
        assert.equal(equipmentForBoard(state, gear).gear.who.astra.enc, -2);
    } finally { host.close(); restore(); }
});

test('unequipping staged gear holds generation and restoring it keeps the rolls', async () => {
    const restore = seedCrypto(7), host = await gearHost();
    try {
        openWithGear(host);
        const staged = stageExchange(host.ctx.chatMetadata, host.head(), [{ who: 'Astra', kind: 'attack', target: 11 }]);
        const stack = Object.values(host.head().domains.inventory.stacks).find(item => item.equipped === 'weapon');
        assert.equal((await host.sdk.command('inventory.unequip', { stack: stack.id })).ok, true);
        const blocked = await host.send('I strike.', 'Should not be sent.');
        assert.equal(blocked.aborted, true);
        assert.match(host.st.notices.at(-1).reason, /gear.*restore|gear.*discard/i);
        assert.equal((await host.sdk.command('item.equip', { stack: stack.id, slot: 'weapon' })).ok, true);
        const sent = await host.st.generate('normal', { reply: 'The fight continues.' });
        assert.notEqual(sent.aborted, true);
        const receipt = host.ctx.chat.at(-1).extra.storySuite.receipts.find(item => item.type === 'rpg.resolve');
        assert.deepEqual(receipt.data.v2.result.rounds, staged.preview.result.rounds);
    } finally { host.close(); restore(); }
});

test('a board prelude refused after another cue stops generation with a reason', async () => {
    const restore = seedCrypto(82);
    const blocks = { hero: { role: 'character', fields: character('Astra', { str: 5 }) }, foes: { role: 'foes', fields: foeBlock([['Rats', 2, 1, 5]]) } };
    const { host, callModel } = await setup({ blocks, board: true });
    try {
        const meta = host.ctx.chatMetadata, sid = host.store.carrierSid(host.store.headIndex());
        openBoard(meta, host.head(), { sid, rules: { ...STANDARD_FORMULA, levelDivisor: 5 } });
        stageExchange(meta, host.head(), [{ who: 'Astra', kind: 'attack', target: 11 }]);
        await host.sdk.registerModule({ id: 'change-before-fight', name: 'Change before fight', version: '1.0.0', hooks: {
            beforeGenerate: () => ({ commands: [{ type: 'test.set', payload: { slug: 'hero', field: 'str', value: 20 } }] }),
        } });
        const sent = await host.send('I strike.', 'This should not be sent.');
        assert.equal(sent.aborted, true);
        assert.equal(sent.request, null);
        assert.match(host.st.notices.at(-1).reason, /fight could not be prepared.*restore.*discard/i);
        assert.equal(boardSession(meta).exchanges.length, 1);
        assert.equal(callModel.calls.length, 0);
    } finally { host.close(); restore(); }
});

test('sheet edits and preview commits cannot change board inputs while the reply is in flight', async () => {
    const restore = seedCrypto(83);
    const blocks = { hero: { role: 'character', fields: character('Astra', { str: 5 }) }, foes: { role: 'foes', fields: foeBlock([['Rats', 2, 1, 5]]) } };
    const { host } = await setup({ blocks, board: true });
    try {
        const meta = host.ctx.chatMetadata, sid = host.store.carrierSid(host.store.headIndex());
        openBoard(meta, host.head(), { sid, rules: { ...STANDARD_FORMULA, levelDivisor: 5 } });
        const staged = stageExchange(meta, host.head(), [{ who: 'Astra', kind: 'attack', target: 11 }]);
        const payload = { slug: 'hero', field: 'str', value: 20 };
        const preview = host.bus.preview('test.set', payload);
        assert.equal(preview.ok, true);
        host.st.addUser('I strike.');
        let aborted = false;
        await host.turn.interceptor([], 8192, () => { aborted = true; }, 'normal');
        assert.equal(aborted, false);
        const edit = await host.sdk.command('test.set', payload);
        assert.equal(edit.code, 'REPLY_BUSY');
        assert.match(edit.message, /wait.*reply.*sheet or gear/i);
        assert.equal(host.bus.commit(preview.token).code, 'REPLY_BUSY');
        assert.equal(host.head().domains.dataModules.instances['pack.chat/hero'].chat.fields.str, 5);
        const index = host.st.addMessage(aiMessage('The fight continues.'));
        await host.turn.onMessageReceived(index);
        const receipt = host.ctx.chat[index].extra.storySuite.receipts.find(item => item.type === 'rpg.resolve');
        assert.deepEqual(receipt.data.v2.result.rounds, staged.preview.result.rounds);
        const live = JSON.stringify(host.head());
        host.store.rebuild();
        assert.equal(JSON.stringify(host.head()), live);
        assert.equal((await host.sdk.command('test.set', payload)).ok, true, 'edits work once capture is complete');
    } finally { host.close(); restore(); }
});

test('a non-reader command is not refused by the in-flight edit guard', async () => {
    const restore = seedCrypto(93);
    const blocks = { hero: { role: 'character', fields: character('Astra', { str: 5 }) }, foes: { role: 'foes', fields: foeBlock([['Rats', 2, 1, 5]]) } };
    const { host } = await setup({ blocks, board: true });
    try {
        const meta = host.ctx.chatMetadata, sid = host.store.carrierSid(host.store.headIndex());
        openBoard(meta, host.head(), { sid, rules: { ...STANDARD_FORMULA, levelDivisor: 5 } });
        stageExchange(meta, host.head(), [{ who: 'Astra', kind: 'attack', target: 11 }]);
        host.st.addUser('I strike.');
        let aborted = false;
        await host.turn.interceptor([], 8192, () => { aborted = true; }, 'normal');
        const edit = host.bus.command('test.set', { slug: 'hero', field: 'str', value: 20 }, { cause: 'system' });
        assert.equal(edit.ok, true, edit.message);
        host.events.emit('committed', { receipt: edit.receipt });
        assert.equal(aborted, true, 'an input change still stops the reply');
    } finally { host.close(); restore(); }
});

test('gear cannot be unequipped while a board reply is in flight', async () => {
    const restore = seedCrypto(84), host = await gearHost();
    try {
        openWithGear(host);
        const staged = stageExchange(host.ctx.chatMetadata, host.head(), [{ who: 'Astra', kind: 'attack', target: 11 }]);
        const stack = Object.values(host.head().domains.inventory.stacks).find(item => item.equipped === 'weapon');
        host.st.addUser('I strike.');
        await host.turn.interceptor([], 8192, () => assert.fail('the board should preflight'), 'normal');
        const edit = await host.sdk.command('inventory.unequip', { stack: stack.id });
        assert.equal(edit.code, 'REPLY_BUSY');
        assert.match(edit.message, /wait.*reply.*gear/i);
        const index = host.st.addMessage(aiMessage('The fight continues.'));
        await host.turn.onMessageReceived(index);
        const receipt = host.ctx.chat[index].extra.storySuite.receipts.find(item => item.type === 'rpg.resolve');
        assert.deepEqual(receipt.data.v2.result.rounds, staged.preview.result.rounds);
        const live = JSON.stringify(host.head());
        host.store.rebuild();
        assert.equal(JSON.stringify(host.head()), live);
    } finally { host.close(); restore(); }
});

test('a rebuilt sheet that changes during a reply invokes the stop callback and explains why', async () => {
    const restore = seedCrypto(85);
    const blocks = { hero: { role: 'character', fields: character('Astra', { str: 5 }) }, foes: { role: 'foes', fields: foeBlock([['Rats', 2, 1, 5]]) } };
    const { host } = await setup({ blocks, board: true });
    try {
        const meta = host.ctx.chatMetadata, sid = host.store.carrierSid(host.store.headIndex());
        openBoard(meta, host.head(), { sid, rules: { ...STANDARD_FORMULA, levelDivisor: 5 } });
        const staged = stageExchange(meta, host.head(), [{ who: 'Astra', kind: 'attack', target: 11 }]);
        host.st.addUser('I strike.');
        let aborted = false;
        await host.turn.interceptor([], 8192, () => { aborted = true; }, 'normal');
        // Simulate a timeline rebuild, which changes the head without going through the command commit guard.
        const edit = host.bus.run('test.set', { slug: 'hero', field: 'str', value: 20 }, { cause: 'system' });
        host.store.append({ ops: edit.ops, receipt: edit.receipt });
        host.events.emit('head', { reason: 'edit' });
        assert.equal(aborted, true);
        assert.match(host.st.notices.at(-1).reason, /sheet or gear changed.*restore.*discard/i);
        assert.equal(boardSession(meta).exchanges.length, 1);
        assert.equal((await host.sdk.command('test.set', { slug: 'hero', field: 'str', value: 5 })).ok, true);
        host.turn.onGenerationEnded();
        const sent = await host.st.generate('normal', { reply: 'The fight continues.' });
        const receipt = host.ctx.chat[sent.index].extra.storySuite.receipts.find(item => item.type === 'rpg.resolve');
        assert.deepEqual(receipt.data.v2.result.rounds, staged.preview.result.rounds);
    } finally { host.close(); restore(); }
});
