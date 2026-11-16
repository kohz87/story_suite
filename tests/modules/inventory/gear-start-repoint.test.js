// Hand-set gear, the starting kit (`story-block.gear`, docs/v2/GEAR.md "Your own gear"): replay, charfile, greetings, re-pointing, name guess, and stat order.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, READER, add, defOf, kit, refused, reply, rowOf, skip, world } from './gear-start.helpers.js';

test('replay equals live: the state the add left is what a rebuild of the chat gives, and a swipe of the reply after it changes nothing', { skip }, async t => {
    const host = await world(t);
    await add(host, { name: 'Wolfskin Cap', kind: 'equipment', slot: 'head', rarity: 'rare', stats: { VIT: 1, AGI: 1 }, equip: READER });
    await host.send('Hello.', 'The road.');
    const before = JSON.stringify(host.head().domains.inventory.defs);
    await host.swipe('Another road.');
    assert.equal(JSON.stringify(host.head().domains.inventory.defs), before);
    assert.equal(rowOf(host, 'Wolfskin Cap').equipped, 'head');
    await host.turn.onChatChanged();
    assert.equal(JSON.stringify(host.head().domains.inventory.defs), before, 'after a reload of the chat');
    assert.deepEqual(kit(host), { open: false });
});

test('a saved character keeps a hand-set piece exactly: the file carries its slot and bonus, and importing it back gives the same piece', { skip }, async t => {
    const { itemsForFile, parseCharacterFile, buildCharacterFile, fileText } = await import('../../../../modules/rpg/charfile.js');
    const host = await world(t);
    await add(host, { name: 'Wolfskin Cap', kind: 'equipment', slot: 'head', rarity: 'rare', stats: { VIT: 1, AGI: 1 } });
    await add(host, { name: 'Lucky Bone', kind: 'equipment', slot: 'accessory-2', rarity: 'common' });
    const items = itemsForFile(host.sdk.query('inventory.items'));
    const stats = { str: 10, vit: 10, agi: 10, dex: 10, int: 10, luk: 10, cha: 10 };
    const parsed = parseCharacterFile(fileText(buildCharacterFile({ level: 1, points: 0, stats, items })));
    assert.equal(parsed.ok, true, parsed.message);
    assert.deepEqual(parsed.file.items.find(item => item.name === 'Wolfskin Cap'), { name: 'Wolfskin Cap', qty: 1, kind: 'equipment', rarity: 'rare', slot: 'head', stats: { VIT: 1, AGI: 1 } });
    const fresh = await world(t);
    for (const item of parsed.file.items) assert.equal((await add(fresh, { ...item, starting: true })).ok, true);
    assert.deepEqual([defOf(fresh, 'Wolfskin Cap').slot, defOf(fresh, 'Wolfskin Cap').stats, defOf(fresh, 'Wolfskin Cap').rarity], ['head', { VIT: 1, AGI: 1 }, 'rare']);
    assert.equal(defOf(fresh, 'Lucky Bone').slot, 'accessory');
    assert.equal(defOf(fresh, 'Wolfskin Cap').hand, true);
});

test('after the kit, a pack piece not held yet (equipment or above Common) added by name makes the reader\'s own Common "Your <name>" (stored without stats; the usual one point applies), worn; the same by a starting: true import', { skip }, async t => {
    const items = [...ITEMS, { name: 'Storm Hood', kind: 'equipment', slot: 'head', rarity: 'epic', stats: { VIT: 2 } }];
    const host = await world(t, { packs: true, items });
    await host.send('Hello.', 'The road.');
    const out = await add(host, { name: 'Rain-Veil Hood', equip: READER });
    assert.equal(out.ok, true, out.message);
    const own = defOf(host, 'Your Rain-Veil Hood');
    assert.deepEqual([own.kind, own.slot, own.rarity, own.stats, own.hand], ['equipment', 'head', 'common', {}, true]);
    assert.equal(defOf(host, 'Rain-Veil Hood'), undefined);
    assert.equal(rowOf(host, 'Your Rain-Veil Hood').equipped, 'head');
    const two = await add(host, { name: 'Storm Hood', qty: 2 });
    assert.equal(two.ok, true, two.message);
    const storm = defOf(host, 'Your Storm Hood');
    assert.deepEqual([storm.rarity, storm.stats, defOf(host, 'Storm Hood')], ['common', {}, undefined]);
    assert.equal(host.sdk.query('inventory.items').filter(item => item.name === 'Your Storm Hood').reduce((n, item) => n + item.qty, 0), 2);
    const late = await add(host, { name: 'Storm Hood', kind: 'equipment', slot: 'head', starting: true });
    assert.equal(late.ok, true, late.message);
    assert.equal(defOf(host, 'Storm Hood'), undefined);
    assert.deepEqual([storm.rarity, defOf(host, 'Your Storm Hood').stats], ['common', {}]);
    const fresh = await world(t, { packs: true, items });
    await fresh.send('Hello.', 'The road.');
    const imp = await add(fresh, { name: 'Rain-Veil Hood', starting: true });
    assert.equal(imp.ok, true, imp.message);
    assert.equal(defOf(fresh, 'Rain-Veil Hood'), undefined);
    const mine = defOf(fresh, 'Your Rain-Veil Hood');
    assert.deepEqual([mine.rarity, mine.stats], ['common', { VIT: 1 }]);
});

test('the kit is open while the chat holds only greetings: a group chat with two member greetings opens it; a reader message or a Story Block reply closes it; deleting only your own messages after replies keeps it closed', { skip }, async t => {
    const host = await world(t);
    host.ctx.chat.splice(0, host.ctx.chat.length, { name: 'A', is_user: false, mes: 'First greeting.' }, { name: 'B', is_user: false, mes: 'Second greeting.' });
    assert.deepEqual(kit(host), { open: true });
    for (const [name, stat] of [['Group Cap', 'VIT'], ['Group Ring', 'AGI']]) {
        const made = await add(host, { name, kind: 'equipment', slot: name.endsWith('Cap') ? 'head' : 'accessory', rarity: 'rare', stats: { [stat]: 1 } });
        assert.equal(made.ok, true, made.message);
        assert.deepEqual(kit(host), { open: true });
    }
    await host.st.generate('normal', { reply: 'A voice answers.' });
    assert.deepEqual(kit(host), { open: false });
    const closed = await world(t);
    await closed.send('Hello.', reply('+ item Ash-grey Longsword | kind: equipment | rarity: rare | slot: weapon | STR +2'));
    assert.deepEqual(kit(closed), { open: false });
    await closed.st.deleteMessage(1);
    assert.deepEqual(kit(closed), { open: false });
});

test('a captured reply keeps the kit closed even when the only record on it is a reader edit: plain reply, AI-only plain reply, and a "+ 3 silver" reply, each with a reader add, then deleting your own message', { skip }, async t => {
    for (const text of ['The road.', reply('+ 3 silver')]) {
        const host = await world(t);
        await host.send('Hello.', text);
        assert.equal((await add(host, { name: 'Trail Bread' })).ok, true);
        assert.deepEqual(kit(host), { open: false });
        await host.st.deleteMessage(1);
        assert.equal(host.ctx.chat.length, 2);
        assert.deepEqual(kit(host), { open: false });
        await refused(add(host, { name: 'Crown', kind: 'equipment', slot: 'head', rarity: 'legendary', stats: { STR: 2, DEX: 2 } }), /after the first message/);
    }
    const alone = await world(t);
    await alone.st.generate('normal', { reply: 'A voice answers.' });
    assert.deepEqual(kit(alone), { open: false });
    assert.equal((await add(alone, { name: 'Trail Bread' })).ok, true);
    assert.deepEqual(kit(alone), { open: false });
});

test('a chat written before the reply mark (records without it) stays closed once a non-head message holds a record', { skip }, async t => {
    const host = await world(t);
    await host.send('Hello.', 'The road.');
    assert.equal((await add(host, { name: 'Trail Bread' })).ok, true);
    for (const message of host.ctx.chat) {
        const records = [message.extra?.storySuite, ...(message.swipe_info ?? []).map(info => info?.extra?.storySuite)];
        for (const record of records) if (record) { delete record.reply; delete record.mv; }
    }
    await host.st.deleteMessage(1);
    assert.deepEqual(kit(host), { open: false });
});

test('swiping a reply after deleting your message keeps the kit closed; swiping the opening greeting keeps it open', { skip }, async t => {
    const host = await world(t);
    await host.send('Hello.', reply('+ item Ash-grey Longsword | kind: equipment | rarity: rare | slot: weapon | STR +2'));
    await host.st.deleteMessage(1);
    assert.deepEqual(kit(host), { open: false });
    await host.swipe(reply('+ 2 silver'));
    assert.deepEqual(kit(host), { open: false });
    const plain = await world(t);
    await plain.st.generate('normal', { reply: 'A voice answers.' });
    await plain.swipe('Another voice.');
    assert.deepEqual(kit(plain), { open: false });
    const greet = await world(t);
    await greet.swipe('Another greeting.');
    assert.deepEqual(kit(greet), { open: true });
});

// ---- Re-pointing: the reader moves the points of any unbound piece (story, pack, own after the kit); the total and the rarity never change.
const REPOINT = reply('+ item Steel Sword | kind: weapon | rarity: rare');
const statsOfRow = (host, name) => host.sdk.query('gear.view').rows[rowOf(host, name).stack].repoint;
const edit = (host, name, payload) => host.sdk.command('inventory.edit', { stack: rowOf(host, name).stack, group: true, ...payload });

test('re-point: the story\'s piece (kit closed) moves its 3 points between stats, keeping the total, and the def is untouched', { skip }, async t => {
    const host = await world(t);
    await host.send('Hello.', REPOINT);
    assert.deepEqual(statsOfRow(host, 'Steel Sword'), { budget: 3, stats: { DEX: 3 } });
    const before = JSON.stringify(defOf(host, 'Steel Sword'));
    const out = await edit(host, 'Steel Sword', { stats: { AGI: 2, DEX: 1 } });
    assert.equal(out.ok, true, out.message);
    assert.deepEqual(statsOfRow(host, 'Steel Sword'), { budget: 3, stats: { AGI: 2, DEX: 1 } });
    assert.equal(JSON.stringify(defOf(host, 'Steel Sword')), before, 'the def keeps its own stats and rarity');
    assert.equal(defOf(host, 'Steel Sword').rarity, 'rare');
    assert.equal(host.sdk.query('inventory.gear', { owner: 'party' }).statBonus.AGI, 0, 'not worn: no bonus yet');
});

test('re-point: worn, the new stats are what the bonus counts; it survives Re-read, rebuild and reload', { skip }, async t => {
    const host = await world(t);
    await host.send('Hello.', reply('+ item Steel Sword | kind: weapon | rarity: rare | equipped: weapon'));
    const moved = await edit(host, 'Steel Sword', { stats: { AGI: 3 } });
    assert.equal(moved.ok, true, moved.message ?? JSON.stringify(moved));
    const bonus = () => host.sdk.query('inventory.gear', { owner: 'party' }).statBonus;
    assert.deepEqual([bonus().AGI, bonus().DEX], [3, 0]);
    const at = host.ctx.chat.length - 1;
    const live = JSON.stringify(host.head());
    assert.equal((await host.turn.reread(at)).ok, true);
    assert.deepEqual([bonus().AGI, bonus().DEX], [3, 0], 'a Re-read keeps the reader\'s choice');
    assert.equal(JSON.stringify(host.head()), live);
    await host.st.loadChat(JSON.parse(JSON.stringify(host.ctx.chat)));
    assert.deepEqual([bonus().AGI, bonus().DEX], [3, 0], 'and a reload');
});

test('re-point: a total that differs, a third stat, no points or a non-piece are refused with a sentence', { skip }, async t => {
    const host = await world(t);
    await host.send('Hello.', REPOINT);
    await refused(edit(host, 'Steel Sword', { stats: { AGI: 1, DEX: 1 } }), /^Keep this piece's 3 points in total: these add up to 2\.$/);
    await refused(edit(host, 'Steel Sword', { stats: { AGI: 2, DEX: 2 } }), /in total: these add up to 4\./);
    await refused(edit(host, 'Steel Sword', { stats: { AGI: 1, DEX: 1, LUK: 1 } }), /at most 2 different stats/);
    await refused(edit(host, 'Steel Sword', { stats: {} }), /add up to 0/);
    await refused(edit(host, 'Steel Sword', { stats: { AGI: 2, DEX: 1 }, rarity: 'epic' }), /Rarity and bonuses come from the story|come from the story/);
    assert.deepEqual(statsOfRow(host, 'Steel Sword').stats, { DEX: 3 });
});

test('re-point: a pack piece keeps its pack def untouched, and its bonus is the total', { skip }, async t => {
    const host = await world(t, { packs: true, items: [{ name: 'Bonus Blade', kind: 'equipment', slot: 'weapon', rarity: 'rare', bonus: 2, stats: { STR: 2 } }] });
    await host.send('Hello.', 'The road.');
    await host.send('Onward.', reply('+ item Bonus Blade'));
    const row = rowOf(host, 'Bonus Blade');
    assert.ok(row, 'the pack piece is held');
    const def = JSON.stringify(Object.values(host.head().domains.inventory.defs).find(item => item.name === 'Bonus Blade'));
    await refused(edit(host, 'Bonus Blade', { stats: { STR: 1, DEX: 2 } }), /Keep this piece's 2 points in total: these add up to 3\./);
    assert.equal((await edit(host, 'Bonus Blade', { stats: { STR: 1, DEX: 1 } })).ok, true);
    assert.deepEqual(statsOfRow(host, 'Bonus Blade'), { budget: 2, stats: { STR: 1, DEX: 1 } });
    assert.equal(JSON.stringify(Object.values(host.head().domains.inventory.defs).find(item => item.name === 'Bonus Blade')), def);
});

test('re-point: the reader\'s own piece after the kit closes moves its points too (it was refused before)', { skip }, async t => {
    const host = await world(t);
    await add(host, { name: 'Wolfskin Cap', kind: 'equipment', slot: 'head', rarity: 'rare', stats: { VIT: 3 } });
    await host.send('Hello.', 'The road.');
    assert.equal((await edit(host, 'Wolfskin Cap', { stats: { VIT: 1, AGI: 2 } })).ok, true);
    assert.deepEqual(statsOfRow(host, 'Wolfskin Cap').stats, { VIT: 1, AGI: 2 });
    await refused(edit(host, 'Wolfskin Cap', { rarity: 'epic' }), /after the first message/);
});

test('re-point: while the kit is open the reader\'s own piece still edits the def\'s stats (and drops a piece override)', { skip }, async t => {
    const host = await world(t);
    await add(host, { name: 'Wolfskin Cap', kind: 'equipment', slot: 'head', rarity: 'rare', stats: { VIT: 3 } });
    assert.equal((await edit(host, 'Wolfskin Cap', { stats: { VIT: 2 } })).ok, true, 'a smaller total is the kit\'s to choose');
    assert.deepEqual(defOf(host, 'Wolfskin Cap').stats, { VIT: 2 });
});

test('name guess: quick weapons raise AGI in items a new reply defines ("Cane Sword" included); an unmarked reply keeps DEX', { skip }, async t => {
    const host = await world(t);
    await host.send('Hello.', reply('+ item Cane Sword | kind: weapon | rarity: common', '+ item Estoc Dagger | kind: weapon | rarity: common', '+ item Moon Rapier | kind: weapon | rarity: common',
        '+ item Silver Katana | kind: weapon | rarity: common', '+ item Rapier Shield | kind: shield | rarity: common', '+ item Iron Sword | kind: weapon | rarity: common'));
    const stat = name => Object.keys(defOf(host, name)?.stats ?? { missing: 1 })[0];
    assert.deepEqual(['Cane Sword', 'Estoc Dagger', 'Moon Rapier', 'Silver Katana', 'Iron Sword'].map(stat), ['AGI', 'AGI', 'AGI', 'AGI', 'DEX']);
    assert.equal(stat('Rapier Shield'), 'VIT', 'a finesse word does not win over armour');
    const old = await world(t), setter = old.store.setRuleMarks;
    old.store.setRuleMarks = () => { throw new Error('old reply'); };
    await old.send('Hello.', reply('+ item Cane Sword | kind: weapon | rarity: common'));
    old.store.setRuleMarks = setter;
    assert.equal(Object.keys(defOf(old, 'Cane Sword').stats)[0], 'DEX', 'a reply captured before the rule keeps the old guess');
});

test('order: a line over its rarity budget keeps the stats in the order it wrote them (new replies); an unmarked reply keeps the old order', { skip }, async t => {
    const host = await world(t);
    await host.send('Hello.', reply('+ item Odd Blade | kind: weapon | rarity: uncommon | LUK: 1 | STR: 1 | DEX: 1'));
    assert.deepEqual(defOf(host, 'Odd Blade').stats, { LUK: 1, STR: 1 });
    const old = await world(t), setter = old.store.setRuleMarks;
    old.store.setRuleMarks = () => { throw new Error('old reply'); };
    await old.send('Hello.', reply('+ item Odd Blade | kind: weapon | rarity: uncommon | LUK: 1 | STR: 1 | DEX: 1'));
    old.store.setRuleMarks = setter;
    assert.deepEqual(defOf(old, 'Odd Blade').stats, { STR: 1, DEX: 1 });
});
