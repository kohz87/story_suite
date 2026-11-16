import test from "node:test";
import assert from "node:assert/strict";
import { CORE_FEATURE } from "../../../../../core/features.js";
import { PARTY_MAX } from "../../../src/v2/lean-rpg/names.js";
import { definition as filler, pack as dmPack } from "../data-modules/helpers.js";
import { JOIN_ADD, joinDefinitions, partyOf } from "../../../src/v2/lean-rpg/join.js";
import { rpgLib, setRpgLib } from "../../../src/v2/rpg-lazy.js";
import { MARA, NAMES, active, blocks, fields, lastAt, make, packed, packedAsk, prng, problems, rebuilt, reply, settled, skip, templateCharacter, world } from "./join.helpers.js";

// (The reply that holds the reader's own Wessel blocks, message 2, is left alone: deleting it takes those blocks away, which is the
// block engine's business and not the party line's; the test after this one says what a join does when that happens.)

for (const seed of [1, 2, 3, 4, 5, 6]) {
    test(`party lines through swipes, Re-reads, deletes, reloads: rebuild = live, seed ${seed}`, { skip }, async t => {
        const random = prng(seed * 104729);
        const pick = list => list[Math.floor(random() * list.length)];
        const host = await world({ mode: seed % 2 ? 'auto' : 'ask' });
        t.after(() => host.close());
        const trail = [];
        for (let step = 0; step < 24; step += 1) {
            const chat = host.ctx.chat;
            const lastIsReply = chat.length > 1 && !chat.at(-1).is_user;
            const roll = random();
            let label;
            if (roll < 0.4) {
                label = 'send';
                const line = random() < 0.35 ? `- party ${pick(NAMES)}` : `+ party ${pick(NAMES)} | about: someone | class: ${pick(['I', 'III', 'IX', 'XI'])} | best: ${pick(['str', 'int', 'wits'])}`;
                await host.send(`Move ${step}.`, reply(line));
            } else if (roll < 0.55 && lastIsReply) { label = 'swipe'; await host.swipe(random() < 0.5 ? `Quiet ${step}.` : reply(`+ party ${pick(NAMES)}`)); }
            else if (roll < 0.68) {
                label = 'reread';
                const target = pick(chat.map((message, index) => ({ message, index })).filter(({ message, index }) => index > 2 && !message.is_user));
                if (target) assert.equal((await host.turn.reread(target.index)).ok, true);
            } else if (roll < 0.8) {
                label = 'delete';
                const target = pick(chat.map((message, index) => ({ message, index })).filter(({ message, index }) => index > 2 && !message.is_user));
                if (target) await host.st.deleteMessage(target.index);
            } else if (roll < 0.9 && host.sdk.query('rpg.joins', {})?.length) {
                label = 'add';
                await host.sdk.command(JOIN_ADD, host.sdk.query('rpg.joins', {})[0]);
            } else label = 'reload';
            trail.push(label);
            await rebuilt(host, `seed ${seed} step ${step} (${trail.join(' > ')})`);
            const party = partyOf(host.head());
            assert.equal(new Set(party.map(person => person.name.toLowerCase())).size, party.length, 'one block to a name');
            assert.equal(party.length <= PARTY_MAX, true);
            assert.equal(party.every(person => person.soul <= Math.max(3, ...party.map(other => other.soul))), true);
        }
    });
}

test('when the blocks a companion joined are gone (the reply that made them was deleted), the join is skipped with its reason, not failed; a Re-read of that reply keeps them', { skip }, async t => {
    const host = await world();
    t.after(() => host.close());
    await host.send('Ilse walks in.', reply('+ party Ilse'));
    assert.equal(blocks(host).includes('pack.chat/ilse'), true);
    assert.equal((await host.turn.reread(2)).ok, true, 'message 2 holds the reader\'s Wessel blocks');
    assert.deepEqual(blocks(host), ['pack.chat/ilse', 'pack.chat/ilse-skills', 'pack.chat/wessel', 'pack.chat/wessel-skills'], 'a Re-read keeps the reader\'s own blocks and the join');
    await rebuilt(host, 'after a Re-read of the reply that made the blocks');
    await host.st.deleteMessage(2);
    assert.equal(blocks(host).length, 0);
    const skipped = host.store.problems();
    assert.equal(skipped.length, 1);
    assert.match(skipped[0].message, /The blocks this story had when the companion joined are gone; Re-read this action\./);
    const live = JSON.stringify(host.head());
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head()), live);
});

// ---- 2.9.1 ---------------------------------------------------------------------------------------------------------------------------

test('2.9.1: a - party line that names the player\'s own character is refused with one plain Problems line; companions can still leave', { skip }, async t => {
    const host = await world({ mode: 'ask' });
    t.after(() => host.close());
    host.ctx.name1 = 'Wessel';
    await make(host, 'Mara', 2);
    await host.send('They argue.', reply('- party Wessel', '- party mara'));
    assert.equal(fields(host, 'wessel').left, false, 'the player\'s own character stays');
    assert.equal(fields(host, 'mara').left, true, 'a companion leaves as before');
    const refused = problems(host).filter(message => /Wessel is you/.test(message));
    assert.equal(refused.length, 1);
    assert.match(refused[0], /Wessel is you, so they cannot leave the party; a "- party" line is for companions only/);
    assert.equal(problems(host).length, 1, 'nothing else was said');
    await rebuilt(host, 'after a refused leave');
    // The name is matched the way the Party tab does (case and spacing); with no persona name known nothing is held back.
    await host.send('Again.', reply('- party  WESSEL '));
    assert.equal(fields(host, 'wessel').left, false);
    host.ctx.name1 = '';
    await host.send('And again.', reply('- party Wessel'));
    assert.equal(fields(host, 'wessel').left, true, 'no persona name: the line works as it did');
});

test('partyLeft: a Re-read keeps a leave its first run made after the persona is renamed to that companion; a reply saved without the mark is refused as before', { skip }, async t => {
    const host = await world({ mode: 'ask' });
    t.after(() => host.close());
    await make(host, 'Mara', 2);
    await make(host, 'Ilse', 2);
    await host.send('They part.', reply('- party Mara'));
    const marked = host.store.headIndex();
    await host.send('Again.', reply('- party Ilse'));
    const old = host.store.headIndex();
    assert.equal(host.ctx.chat[marked].extra.storySuite.rules.includes('partyLeft'), true);
    delete host.ctx.chat[old].extra.storySuite.rules; // as a reply saved before the rule was
    host.store.rebuild();
    assert.deepEqual([fields(host, 'mara').left, fields(host, 'ilse').left], [true, true]);
    host.ctx.name1 = 'Mara';
    assert.equal((await host.turn.reread(marked)).ok, true);
    assert.equal(fields(host, 'mara').left, true, 'the marked reply still makes Mara leave');
    host.ctx.name1 = 'Ilse';
    assert.equal((await host.turn.reread(old)).ok, true);
    assert.equal(fields(host, 'ilse').left, false, 'the unmarked reply is refused: Ilse is the persona now');
    assert.ok(problems(host).some(message => /Ilse is you/.test(message)));
    assert.equal(host.ctx.chat[old].extra.storySuite.rules, undefined);
    await rebuilt(host, 'after the Re-reads');
});

test('partyLeft: an unmarked leave Re-read with the persona unchanged is the same: same head and same results', { skip }, async t => {
    const host = await world({ mode: 'ask' });
    t.after(() => host.close());
    await make(host, 'Mara', 2);
    const setter = host.store.setRuleMarks;
    host.store.setRuleMarks = () => { throw new Error('old reply'); }; // the reply is first captured as one saved before the rule was
    await host.send('They part.', reply('- party Mara'));
    host.store.setRuleMarks = setter;
    const at = host.store.headIndex();
    assert.equal(host.ctx.chat[at].extra.storySuite.rules, undefined);
    const results = () => JSON.stringify(host.ctx.chat[at].extra.storySuite.receipts.map(receipt => receipt.data?.v2?.result));
    const head = JSON.stringify(host.head()), before = results();
    assert.equal((await host.turn.reread(at)).ok, true);
    assert.equal(JSON.stringify(host.head()), head);
    assert.equal(results(), before);
});

test('2.9.1: the first character a story gets through Add to party also brings the Combat rules and Foes blocks it lacks, in the same action', { skip }, async t => {
    const host = await world({ mode: 'ask', wessel: false });
    t.after(() => host.close());
    assert.deepEqual(blocks(host), []);
    const added = await host.sdk.command(JOIN_ADD, { name: 'Mara', about: 'a hedge-witch', soul: 1, best: 'int' });
    assert.equal(added.ok, true, added.message);
    assert.deepEqual(blocks(host), ['pack.chat/combat-rules', 'pack.chat/foes', 'pack.chat/mara', 'pack.chat/mara-skills']);
    const perReply = host.head().domains.dataModules.perReply;
    assert.equal(perReply[Object.keys(perReply).at(-1)].roots, 1, 'one action');
    const made = host.ctx.chat.flatMap(message => message.extra?.storySuite?.receipts ?? []).filter(receipt => receipt.type.startsWith('dm.'));
    assert.deepEqual(made.map(receipt => receipt.type), ['dm.join']);
    await rebuilt(host, 'after the first join');
    // A later companion brings nothing extra.
    const second = await host.sdk.command(JOIN_ADD, { name: 'Ren', about: '', soul: 1, best: '' });
    assert.equal(second.ok, true, second.message);
    assert.deepEqual(blocks(host), ['pack.chat/combat-rules', 'pack.chat/foes', 'pack.chat/mara', 'pack.chat/mara-skills', 'pack.chat/ren', 'pack.chat/ren-skills']);
    await host.swipe('Nobody comes.');
    assert.deepEqual(blocks(host), [], 'a swipe takes all of it');
    await rebuilt(host, 'after the swipe');
});

test('2.17.0: a companion made by a party line or Add to party has the same level-up rule as any new character: a point for every multiple of 3 the rise crosses (was: 3 points with each Soul Class rise)', () => {
    const { character } = joinDefinitions({ name: 'Mara', about: '', soul: 1, best: '' });
    const rule = character.rules.find(item => item.id === 'level-up');
    assert.equal(character.rules.some(item => item.id === 'class-up'), false);
    assert.deepEqual(rule.then.find(effect => effect.path[0] === 'points'), { op: 'add', path: ['points'], value: ['sub', ['floorDiv', ['add', ['get', ['level']], ['get', ['rise']]], 3], ['floorDiv', ['get', ['level']], 3]], bounds: 'clamp' });
});

test('wizard characters replay with the RPG off: two made without a roll, join or note stay after a rebuild and a cold reload, the RPG off and then on', { skip }, async t => {
    const host = await world({ feature: false, wessel: false });
    t.after(() => host.close());
    setRpgLib(null);
    await make(host, 'Ann');
    await make(host, 'Bob');
    assert.equal(rpgLib(), null, 'the RPG library was never loaded');
    const both = ['pack.chat/ann', 'pack.chat/ann-skills', 'pack.chat/bob', 'pack.chat/bob-skills'];
    assert.deepEqual(blocks(host), both);
    await settled(host, 'RPG off');
    assert.equal(rpgLib(), null, 'a cold reload did not need the library');
    assert.deepEqual(blocks(host), both, 'both are still there');
    host.features.set(CORE_FEATURE.leanRpg, true);
    await settled(host, 'RPG on');
    assert.deepEqual(blocks(host), both, 'the same with the RPG on');
});

test('a standard Character pinned from a pack keeps the 4-active limit and records the party: refused at four, and with the earlier leave deleted it is skipped, not a fifth', { skip }, async t => {
    const hero = templateCharacter();
    delete hero.slug; hero.slug = 'pinned-hero'; hero.name = 'Pinned hero';
    const host = await packedAsk();
    t.after(() => host.close());
    const installed = await host.packs.packs.install(dmPack([hero]));
    assert.equal(installed.ok, true, JSON.stringify(installed.errors));
    const offer = () => host.sdk.query('dataModules.offers').find(entry => entry.module.endsWith('/pinned-hero'));
    const pinIt = () => host.sdk.command('dm.pin', { module: offer().module, hash: offer().hash, packHash: offer().packHash, subjects: [] });
    const refused = await pinIt();
    assert.equal(refused.ok, false);
    assert.match(refused.message, /the party is full \(4 active\); someone must leave first/);
    await host.send('Ren goes.', reply('- party Ren'));
    const leave = lastAt(host);
    const pinned = await pinIt();
    assert.equal(pinned.ok, true, pinned.message);
    assert.equal(active(host), 4);
    await host.st.deleteMessage(leave);
    await settled(host, 'after deleting the leave');
    assert.equal(active(host), 4, 'Ren is active again and the pin is skipped, not a fifth');
});

// ---- the witness is only "was there room" (fewer than 8 active before) --------------------------------------------------------------------

test('deleting an unrelated earlier member below the cap keeps the later members (rebuild, reload, Re-read); at the cap the later join is still skipped', { skip }, async t => {
    const host = await world({ eight: true });
    t.after(() => host.close());
    const at = {};
    for (const who of ['Ann', 'Bob', 'Cy']) { await host.send(`${who} arrives.`, 'Quiet.'); await make(host, who); at[who] = lastAt(host); }
    assert.equal(active(host), 4);
    await host.st.deleteMessage(at.Ann);
    await settled(host, 'after deleting Ann\'s creation');
    assert.deepEqual(blocks(host), ['pack.chat/bob', 'pack.chat/bob-skills', 'pack.chat/cy', 'pack.chat/cy-skills', 'pack.chat/wessel', 'pack.chat/wessel-skills']);
    assert.equal(active(host), 3);
    assert.equal((await host.turn.reread(lastAt(host))).ok, true);
    await settled(host, 'after a Re-read');
    assert.equal(blocks(host).includes('pack.chat/cy'), true);
    // At the cap: eight active, then the earlier leave that made room for a later member goes: that member is skipped (covered by the routes test); here a story join too.
    const full = await packed();
    t.after(() => full.close());
    await full.send('Ren goes.', reply('- party Ren'));
    const leave = lastAt(full);
    await full.send('Ann comes.', reply('+ party Ann'));
    await full.st.deleteMessage(leave);
    await settled(full, 'at the cap');
    assert.equal(partyOf(full.head()).some(person => person.name === 'Ann'), false);
});

test('a wizard Character skipped on replay takes its Skills block with it, and the same person can be made again', { skip }, async t => {
    const host = await packedAsk();
    t.after(() => host.close());
    await host.send('Ren goes.', reply('- party Ren'));
    const leave = lastAt(host);
    await make(host, 'Ann');
    assert.equal(active(host), 4);
    await host.st.deleteMessage(leave);
    await settled(host, 'after deleting the leave');
    assert.equal(blocks(host).some(id => id.includes('ann')), false, 'neither the Character nor an orphan Skills block');
    const refused = await host.sdk.command('dm.define', { definition: { ...structuredClone(host.head().domains.dataModules.pins[host.head().domains.dataModules.active['pack.chat/ren-skills'].hash].definition), slug: 'x-skills', name: 'X' }, after: 'pack.chat/nobody' });
    assert.equal(refused.ok, false, 'a Skills block can only follow a Character of this chat');
    await host.send('Ren goes again.', reply('- party Ren'));
    await make(host, 'Ann');
    assert.equal(active(host), 4);
    assert.equal(blocks(host).filter(id => id.includes('ann')).length, 2);
    assert.equal(fields(host, 'ann-skills')?.who, 'Ann');
    await settled(host, 'after making Ann again');
    assert.equal(blocks(host).filter(id => id.includes('ann')).length, 2);
});

test('setting a Character\'s Left to false by hand is a return: refused at four active, and witnessed: with an earlier leave deleted it is skipped, not a fifth', { skip }, async t => {
    const host = await packed(4);
    t.after(() => host.close());
    const moduleOf = who => partyOf(host.head()).find(person => person.name === who).module;
    const back = who => host.sdk.command('dm.set', { module: moduleOf(who), field: 'left', value: false });
    await host.send('Ren goes.', reply('- party Ren'));
    await host.send('Ann comes.', reply('+ party Ann'));
    assert.equal(active(host), 4);
    const refused = await back('Ren');
    assert.equal(refused.ok, false);
    assert.match(refused.message, /the party is full \(4 active\); someone must leave first/);
    await host.send('Mara goes.', reply('- party Mara'));
    await host.send('Ilse goes.', reply('- party Ilse'));
    const ilse = lastAt(host);
    await host.send('Quiet.', 'Quiet.');   // (the hand returns go in a reply of their own, after the leave)
    assert.equal(active(host), 2);
    assert.equal((await back('Ren')).ok, true);
    assert.equal((await back('Mara')).ok, true, 'a second hand return, with room');
    assert.equal(active(host), 4);
    await settled(host, 'live');
    await host.st.deleteMessage(ilse);
    await settled(host, 'after deleting an earlier leave');
    assert.equal(active(host), 4, 'Ilse never left, so Mara\'s hand return would be a fifth: skipped');
    assert.equal(partyOf(host.head()).find(person => person.name === 'Mara').left, true);
    assert.equal(partyOf(host.head()).find(person => person.name === 'Ren').left, false, 'Ren\'s return still had room');
});

test('an old reply (before the mark) at 16 pins: it replays, a rebuild and a reload keep it, a Re-read decides it the old way, and one more old join is refused', { skip }, async t => {
    const host = await world();
    t.after(() => host.close());
    const many = Array.from({ length: 12 }, (_, n) => ({ ...filler(), slug: `f${n}`, name: `F${n}`, kinds: {} }));
    assert.equal((await host.packs.packs.install(dmPack(many))).ok, true);
    for (const offer of host.sdk.query('dataModules.offers')) assert.equal((await host.sdk.command('dm.pin', { module: offer.module, hash: offer.hash, packHash: offer.packHash, subjects: [] })).ok, true);
    assert.equal(blocks(host).length, 14);
    const marker = host.store.setRuleMarks;
    host.store.setRuleMarks = () => { throw new Error('old reply'); };
    await host.send('Mara comes.', reply(MARA));
    const join = lastAt(host);
    await host.send('Ren comes.', reply('+ party Ren'));
    host.store.setRuleMarks = marker;
    assert.equal(blocks(host).length, 16, 'the old 16 pins');
    assert.equal(partyOf(host.head()).some(person => person.name === 'Ren'), false, 'the second old join was refused');
    await settled(host, 'old 16');
    assert.equal(blocks(host).length, 16);
    assert.equal((await host.turn.reread(join)).ok, true);
    assert.equal(blocks(host).length, 16, 'a Re-read keeps the old room');
    await settled(host, 'old 16 after a Re-read');
});
