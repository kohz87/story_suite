// Held board replies across reload/discard and weapon breaking across replies.
import test from 'node:test';
import assert from 'node:assert/strict';
import { playBoard } from '../../../../src/v2/lean-rpg/board/engine.js';
import { STANDARD_FORMULA } from '../../../../src/v2/lean-rpg/rules.js';
import { character, foeBlock, setup } from '../helpers.js';
import { boardSession, discardBoard, openBoard, stageExchange } from '../../helpers/board-port.js';
import { seedCrypto } from '../../qa/helpers/seeded.js';
import { aiMessage } from '../../../../testkit/fake-st.js';
import { heldForMessage } from '../../../../src/v2/interaction/held.js';
import { gearHost, isBoardFight, openWithGear } from './commit.helpers.js';


test('a late input change holds the received reply until the sheet is restored', async () => {
    const restore = seedCrypto(86);
    const blocks = { hero: { role: 'character', fields: character('Astra', { str: 5 }) }, foes: { role: 'foes', fields: foeBlock([['Rats', 2, 1, 5]]) } };
    const { host } = await setup({ blocks, board: true });
    try {
        const meta = host.ctx.chatMetadata, sid = host.store.carrierSid(host.store.headIndex());
        openBoard(meta, host.head(), { sid, rules: { ...STANDARD_FORMULA, levelDivisor: 5 } });
        const staged = stageExchange(meta, host.head(), [{ who: 'Astra', kind: 'attack', target: 11 }]);
        host.st.addUser('I strike.');
        await host.turn.interceptor([], 8192, () => {}, 'normal');
        // The head changes without an event before the response arrives.
        const edit = host.bus.run('test.set', { slug: 'hero', field: 'str', value: 20 }, { cause: 'system' });
        host.store.append({ ops: edit.ops, receipt: edit.receipt });
        const index = host.st.addMessage(aiMessage('The fight continues.'));
        assert.equal(await host.turn.onMessageReceived(index), null);
        assert.match(host.st.notices.at(-1).reason, /fight read has changed.*discard.*restore.*regenerate/i);
        assert.equal(host.ctx.chat[index].extra?.storySuite?.receipts?.some(isBoardFight) ?? false, false);
        assert.equal(boardSession(meta).exchanges.length, 1);
        const heldSession = host.turn.session();
        host.registry.setRestore('pending', 'Waiting for the saved records.');
        let blocked = false;
        await host.turn.interceptor([], 8192, () => { blocked = true; }, 'normal');
        assert.equal(blocked, true);
        assert.deepEqual(host.turn.session(), heldSession, 'a restore barrier does not discard the held reply');
        host.registry.setRestore('idle');
        assert.equal((await host.sdk.command('test.set', { slug: 'hero', field: 'str', value: 5 })).ok, true);
        for (let n = 0; n < 20 && !host.ctx.chat[index].extra?.storySuite?.receipts?.some(isBoardFight); n += 1) await new Promise(resolve => setImmediate(resolve));
        const receipt = host.ctx.chat[index].extra.storySuite.receipts.find(isBoardFight);
        assert.deepEqual(receipt.data.v2.result.rounds, staged.preview.result.rounds);
        const live = JSON.stringify(host.head());
        host.store.rebuild();
        assert.equal(JSON.stringify(host.head()), live);
    } finally { host.close(); restore(); }
});

test('discarding a held fight allows the reply to be regenerated with the planner', async () => {
    const restore = seedCrypto(87);
    const blocks = { hero: { role: 'character', fields: character('Astra', { str: 5 }) }, foes: { role: 'foes', fields: foeBlock([['Rats', 2, 1, 5]]) } };
    const { host, callModel } = await setup({ blocks, board: true, answers: ['none'] });
    try {
        const meta = host.ctx.chatMetadata, sid = host.store.carrierSid(host.store.headIndex());
        openBoard(meta, host.head(), { sid, rules: { ...STANDARD_FORMULA, levelDivisor: 5 } });
        stageExchange(meta, host.head(), [{ who: 'Astra', kind: 'attack', target: 11 }]);
        host.st.addUser('I strike.');
        await host.turn.interceptor([], 8192, () => {}, 'normal');
        const edit = host.bus.run('test.set', { slug: 'hero', field: 'str', value: 20 }, { cause: 'system' });
        host.store.append({ ops: edit.ops, receipt: edit.receipt });
        const index = host.st.addMessage(aiMessage('The fight continues.'));
        assert.equal(await host.turn.onMessageReceived(index), null);
        assert.equal(discardBoard(meta), true);
        const sent = await host.st.generate('regenerate', { reply: 'A new telling.' });
        assert.notEqual(sent.aborted, true);
        assert.equal(callModel.calls.length, 1);
        assert.equal(host.ctx.chat[sent.index].extra.storySuite.receipts.some(item => isBoardFight(item)), false);
    } finally { host.close(); restore(); }
});

test('a board reply applies its fight and its own sheet and equipment lines', async () => {
    const restore = seedCrypto(88), host = await gearHost();
    try {
        openWithGear(host);
        const staged = stageExchange(host.ctx.chatMetadata, host.head(), [{ who: 'Astra', kind: 'attack', target: 11 }]);
        assert.equal(staged.error, undefined);
        host.st.addUser('I strike.');
        await host.turn.interceptor([], 8192, () => assert.fail('the board should preflight'), 'normal');
        const equipped = Object.values(host.head().domains.inventory.stacks).find(item => item.equipped === 'weapon');
        assert.equal((await host.sdk.command('inventory.unequip', { stack: equipped.id })).code, 'REPLY_BUSY');
        const lines = [
            '~ dm character — a bruise | kind: set-health | to: Hurt',
            '+ dm character — learned | kind: add-xp | amount: 1',
            '~ item Cane Sword — nicked | wear: scuff',
            '- item Cane Sword | qty: 1',
            '+ item New Sword | kind: weapon | equipped: weapon',
        ];
        const index = host.st.addMessage(aiMessage(`The fight continues.\n<Changes>\n${lines.join('\n')}\n</Changes>`));
        const turn = await host.turn.onMessageReceived(index);
        assert.ok(turn, 'the reply was captured');
        assert.deepEqual(turn.steps.find(isBoardFight).data.v2.result.rounds, staged.preview.result.rounds);
        assert.deepEqual(turn.problems, [], JSON.stringify(turn.problems));
        assert.equal(turn.receipts.filter(item => item.cause === 'story').length, lines.length);
        const sheet = host.head().domains.dataModules.instances['pack.chat/character'].chat.fields;
        assert.equal(sheet.health, 5, JSON.stringify(sheet)); // 'Hurt' is stage 3 of 8 health blocks
        assert.equal(sheet.xp, 1);
        const items = host.sdk.query('inventory.items');
        assert.equal(items.some(item => item.name === 'Cane Sword'), false);
        assert.equal(items.find(item => item.name === 'New Sword')?.equipped, 'weapon');
        const live = JSON.stringify(host.head());
        host.store.rebuild();
        assert.equal(JSON.stringify(host.head()), live);
    } finally { host.close(); restore(); }
});

test('a held reply survives reload and captures its fight only after inputs are restored', async () => {
    const restore = seedCrypto(89);
    const blocks = { hero: { role: 'character', fields: character('Astra', { str: 5 }) }, foes: { role: 'foes', fields: foeBlock([['Rats', 2, 1, 5]]) } };
    const { host } = await setup({ blocks, board: true });
    try {
        const meta = host.ctx.chatMetadata, sid = host.store.carrierSid(host.store.headIndex());
        openBoard(meta, host.head(), { sid, rules: { ...STANDARD_FORMULA, levelDivisor: 5 } });
        const staged = stageExchange(meta, host.head(), [{ who: 'Astra', kind: 'attack', target: 11 }]);
        host.st.addUser('I strike.');
        await host.turn.interceptor([], 8192, () => assert.fail('the board should preflight'), 'normal');
        const edit = host.bus.run('test.set', { slug: 'hero', field: 'str', value: 20 }, { cause: 'system' });
        host.store.append({ ops: edit.ops, receipt: edit.receipt });
        const index = host.st.addMessage(aiMessage('The fight continues.'));
        assert.equal(await host.turn.onMessageReceived(index), null);
        await host.store.flush();
        const savedChat = structuredClone(host.st.saves.at(-1)), savedMeta = structuredClone(host.ctx.chatMetadata);
        host.ctx.chatMetadata = savedMeta;
        await host.st.loadChat(savedChat, 'held-reload');
        const record = host.ctx.chat[index].extra?.storySuite;
        assert.ok(record?.sid);
        assert.ok(savedMeta.storySuiteInteraction?.held?.[record.sid], 'the marker belongs to the reply sid');
        assert.equal(record.receipts.some(isBoardFight), false);
        assert.match(host.turn.problems().at(-1).message, /restore.*discard.*regenerate/i);
        assert.equal((await host.turn.reread(index)).ok, false, 'Re-read cannot capture the story without the fight');
        const blocked = await host.st.generate('normal', { reply: 'Not yet.' });
        assert.equal(blocked.aborted, true);
        assert.equal((await host.sdk.command('test.set', { slug: 'hero', field: 'str', value: 5 })).ok, true);
        for (let n = 0; n < 30 && !host.ctx.chat[index].extra?.storySuite?.receipts?.some(isBoardFight); n += 1) await new Promise(resolve => setImmediate(resolve));
        const receipt = host.ctx.chat[index].extra.storySuite.receipts.find(isBoardFight);
        assert.deepEqual(receipt.data.v2.result.rounds, staged.preview.result.rounds);
        const live = JSON.stringify(host.head());
        host.store.rebuild();
        assert.equal(JSON.stringify(host.head()), live);
        await host.turn.onChatChanged();
        assert.equal(heldForMessage(host.ctx.chatMetadata, host.ctx.chat[index]), null, 'a captured reply is no longer held');
    } finally { host.close(); restore(); }
});

test('after reload a held reply cannot read story lines before its fight', async () => {
    const restore = seedCrypto(94), host = await gearHost();
    try {
        openWithGear(host);
        const staged = stageExchange(host.ctx.chatMetadata, host.head(), [{ who: 'Astra', kind: 'attack', target: 11 }]);
        host.st.addUser('I strike.');
        await host.turn.interceptor([], 8192, () => assert.fail('the board should preflight'), 'normal');
        const edit = host.bus.run('dm.set', { module: 'pack.chat/character', field: 'str', value: 8 }, { cause: 'ui' });
        assert.equal(edit.ok, true, edit.message);
        host.store.append({ ops: edit.ops, receipt: edit.receipt, ...(edit.block ? { block: edit.block } : {}) });
        await host.store.flush();
        const index = host.st.addMessage(aiMessage('A bruise.\n<Changes>\n~ dm character — hurt | kind: set-health | to: 2\n</Changes>'));
        assert.equal(await host.turn.onMessageReceived(index), null);
        await host.store.flush();
        const chat = structuredClone(host.st.saves.at(-1));
        host.ctx.chatMetadata = structuredClone(host.ctx.chatMetadata);
        await host.st.loadChat(chat, 'held-with-lines');
        assert.equal((await host.turn.reread(index)).ok, false);
        assert.equal(host.ctx.chat[index].extra.storySuite.receipts.length, 0);
        assert.equal((await host.sdk.command('dm.set', { module: 'pack.chat/character', field: 'str', value: 3 })).ok, true);
        for (let n = 0; n < 30 && !host.ctx.chat[index].extra.storySuite.receipts.some(isBoardFight); n += 1) await new Promise(resolve => setImmediate(resolve));
        const receipts = host.ctx.chat[index].extra.storySuite.receipts;
        assert.deepEqual(receipts.find(isBoardFight).data.v2.result.rounds, staged.preview.result.rounds);
        assert.equal(receipts.filter(item => item.cause === 'story').length, 1);
        assert.equal(host.head().domains.dataModules.instances['pack.chat/character'].chat.fields.health, 3);
        const live = JSON.stringify(host.head());
        host.store.rebuild();
        assert.equal(JSON.stringify(host.head()), live);
    } finally { host.close(); restore(); }
});

test('discarding a reloaded held fight requires regenerating its reply', async () => {
    const restore = seedCrypto(90);
    const blocks = { hero: { role: 'character', fields: character('Astra', { str: 5 }) }, foes: { role: 'foes', fields: foeBlock([['Rats', 2, 1, 5]]) } };
    const { host, callModel } = await setup({ blocks, board: true, answers: ['none'] });
    try {
        const meta = host.ctx.chatMetadata, sid = host.store.carrierSid(host.store.headIndex());
        openBoard(meta, host.head(), { sid, rules: { ...STANDARD_FORMULA, levelDivisor: 5 } });
        stageExchange(meta, host.head(), [{ who: 'Astra', kind: 'attack', target: 11 }]);
        host.st.addUser('I strike.');
        await host.turn.interceptor([], 8192, () => {}, 'normal');
        const edit = host.bus.run('test.set', { slug: 'hero', field: 'str', value: 20 }, { cause: 'system' });
        host.store.append({ ops: edit.ops, receipt: edit.receipt });
        const index = host.st.addMessage(aiMessage('The fight continues.'));
        assert.equal(await host.turn.onMessageReceived(index), null);
        await host.store.flush();
        const chat = structuredClone(host.st.saves.at(-1));
        host.ctx.chatMetadata = structuredClone(meta);
        await host.st.loadChat(chat, 'held-discard');
        assert.equal(discardBoard(host.ctx.chatMetadata), true);
        assert.equal((await host.turn.reread(index)).ok, false);
        const sent = await host.st.generate('regenerate', { reply: 'A new telling.' });
        assert.notEqual(sent.aborted, true);
        assert.equal(callModel.calls.length, 1);
        assert.equal(host.ctx.chat[sent.index].extra.storySuite.receipts.some(item => isBoardFight(item)), false);
    } finally { host.close(); restore(); }
});

test('a weapon breaking in one exchange changes later rolls, including across replies', async () => {
    for (const split of [false, true]) {
        const restore = seedCrypto(7), host = await gearHost();
        try {
            assert.equal(host.bus.command('gear.wear', { owner: 'party', slot: 'weapon', steps: 2 }, { cause: 'system' }).ok, true);
            const meta = host.ctx.chatMetadata, action = [{ who: 'Astra', kind: 'attack', target: 11 }];
            let first;
            for (let attempt = 0; attempt < 200; attempt += 1) {
                assert.equal(openWithGear(host).error, undefined);
                first = stageExchange(meta, host.head(), action);
                if (first.preview?.result.stop === 'open' && first.preview.result.wear?.some(event => event.to === 'broken')) break;
                discardBoard(meta); first = null;
            }
            assert.ok(first, 'found a deterministic break in the first exchange');
            const together = playBoard(host.head(), boardSession(meta).setup, [...boardSession(meta).exchanges, { actions: action }]);
            assert.equal(together.error, undefined);
            assert.ok(together.result.rounds[0].lines.some(line => line.pc?.gear?.some(item => item.name === 'Cane Sword')));
            assert.ok(together.result.rounds[1].lines.every(line => !line.pc?.gear?.some(item => item.name === 'Cane Sword')));
            assert.equal(together.result.rounds[1].lines.find(line => line.kind === 'act').pc.stat, 'str');
            let staged;
            if (split) {
                await host.send('First.', 'The fight continues.');
                staged = stageExchange(meta, host.head(), action);
                assert.equal(staged.error, undefined);
                assert.deepEqual(staged.preview.result.rounds[0], together.result.rounds[1]);
            } else staged = stageExchange(meta, host.head(), action);
            assert.equal(staged.error, undefined);
            await host.send('Strike.', 'The fight goes on.');
            const receipt = host.ctx.chat.at(-1).extra.storySuite.receipts.find(isBoardFight);
            for (const [key, value] of Object.entries(staged.preview.result)) assert.deepEqual(receipt.data.v2.result[key], value, key);
            assert.equal(host.sdk.query('inventory.gear', { owner: 'party' }).slots.weapon.cond, 0);
            await host.swipe('Another telling.');
            assert.equal(host.sdk.query('inventory.gear', { owner: 'party' }).slots.weapon.cond, 0);
            assert.equal((await host.turn.reread(host.ctx.chat.length - 1)).ok, true);
            assert.equal(host.sdk.query('inventory.gear', { owner: 'party' }).slots.weapon.cond, 0);
        } finally { host.close(); restore(); }
    }
});
