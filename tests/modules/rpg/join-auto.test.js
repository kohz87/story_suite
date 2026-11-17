import test from "node:test";
import assert from "node:assert/strict";
import { PARTY_MAX } from "../../../modules/rpg/names.js";
import { definition as filler } from "../data-modules/helpers.js";
import { DM_OLD_ROOM } from "../../../modules/data-modules/schema.js";
import { JOIN_ADD, checkJoin, partyOf } from "../../../modules/rpg/join.js";
import { setRpgLib } from "../../../modules/rpg/rpg-lazy.js";
import * as leanRpg from "../../../modules/rpg/index.js";
import { partyLines } from "../../../modules/rpg/view/changes-lines.js";
import { MARA, active, blocks, fields, lastAt, lastReceipts, make, packed, packedAsk, problems, rebuilt, reply, settled, skip, templateCharacter, world } from "./join.helpers.js";

// ---- Automatically ------------------------------------------------------------------------------------------------------------------

test('refused plainly, one Problems line each and nothing made: the name is taken, a bad class, a bad best stat, no room, a full reply', { skip }, async t => {
    const host = await world();
    t.after(() => host.close());
    await host.send('Dupes.', reply('+ party Wessel', '+ party wessel | class: I', '+ party Mara | class: XI', '+ party Mara | best: wits'));
    assert.deepEqual(blocks(host), ['pack.chat/wessel', 'pack.chat/wessel-skills'], 'nothing made');
    const told = problems(host);
    assert.equal(told.length, 4);
    assert.match(told[0], /Party: Wessel is already in the party; nothing applied\./);
    assert.match(told[2], /class must be a Soul Class from I to IX/);
    assert.match(told[3], /best must be one of/);

    // No room (a reply from before the partyRoom mark keeps the old eight): Wessel's two blocks and six more fill the story's eight.
    for (const who of ['Ren', 'Ilse', 'Dov']) await make(host, who);
    assert.equal(blocks(host).length, 8);
    const marker = host.store.setRuleMarks;
    host.store.setRuleMarks = () => { throw new Error('old reply'); };
    await host.send('One too many.', reply(MARA));
    host.store.setRuleMarks = marker;
    assert.equal(blocks(host).length, 8);
    assert.match(problems(host).at(-1), /Party: the story has no room for two more blocks \(at most 8\); remove one from Blocks first; nothing applied\./);

    // The reply's own actions are used up: the line is refused with the block engine's plain sentence.
    const fresh = await world({ eight: true });
    t.after(() => fresh.close());
    await fresh.send('Crowd.', reply(...Array.from({ length: 12 }, (_, n) => `+ party P${n}`)));
    assert.equal(partyOf(fresh.head()).length < 12, true, 'some were refused');
    assert.equal(problems(fresh).some(message => /^"\+ party P\d+" was not used: /.test(message)), true);
    assert.equal(partyOf(fresh.head()).length <= PARTY_MAX, true);
    await rebuilt(fresh, 'a crowded reply');
});

test('partyRoom: a marked reply has room for the 3rd to 7th companion, within the bytes; the party stops at 8 active and someone must leave for another', { skip }, async t => {
    const host = await world({ eight: true });
    t.after(() => host.close());
    for (const who of ['Mara', 'Ren', 'Ilse', 'Dov', 'Pip', 'Kit', 'Lou']) await host.send(`${who} comes.`, reply(`+ party ${who}`));
    assert.equal(partyOf(host.head()).length, 8, 'Wessel and seven companions');
    assert.equal(blocks(host).length, 16, 'past the old eight blocks');
    assert.equal(new TextEncoder().encode(JSON.stringify(host.head().domains.dataModules.pins)).length < 262144, true, 'seven companions fit the pin bytes (a pair is about 29 KB)');
    await host.send('One more.', reply('+ party Ann'));
    assert.equal(partyOf(host.head()).length, 8);
    assert.match(problems(host).at(-1), /the party is full \(8 active\); someone must leave first/);
    await host.send('Ren goes.', reply('- party Ren'));
    await host.send('Ann comes.', reply('+ party Ann'));
    assert.deepEqual([partyOf(host.head()).length, partyOf(host.head()).filter(person => person.left).map(person => person.name)], [9, ['Ren']], 'nine sheets, eight active, one left');
    await host.send('Ren is back.', reply('+ party Ren'));
    assert.match(problems(host).at(-1), /the party is full \(8 active\); someone must leave first/, 'a return with 8 active is refused');
    assert.equal(partyOf(host.head()).find(person => person.name === 'Ren').left, true);
    await rebuilt(host, 'a full party');
});

test('partyRoom: the block cap is 20 of the story\'s own blocks; a reply from before the mark keeps 8 on Re-read, so an old refused join stays refused', { skip }, async t => {
    const host = await world();
    t.after(() => host.close());
    await host.send('Mara comes.', reply('+ party Mara'));
    await host.send('Ren comes.', reply('+ party Ren'));
    for (let n = 0; n < 14; n++) assert.equal((await host.sdk.command('dm.define', { definition: { ...filler(), slug: `filler-${n}`, name: `Filler ${n}`, kinds: {} } })).ok, true);
    assert.equal(blocks(host).length, 20);
    await host.send('Ilse comes.', reply('+ party Ilse'));
    assert.match(problems(host).at(-1), /Party: the story has no room for two more blocks \(at most 20\); remove one from Blocks first; nothing applied\./);
    // An old reply (no mark) in a story of 8: its join stays refused when run again, though the story now has room.
    const old = await world();
    t.after(() => old.close());
    for (const who of ['Ren', 'Ilse', 'Dov']) await make(old, who);
    const marker = old.store.setRuleMarks;
    old.store.setRuleMarks = () => { throw new Error('old reply'); };
    await old.send('One too many.', reply(MARA));
    old.store.setRuleMarks = marker;
    const at = old.ctx.chat.length - 1;
    assert.equal(old.ctx.chat[at].extra.storySuite.rules, undefined);
    const before = JSON.stringify(old.head());
    assert.equal((await old.turn.reread(at)).ok, true);
    assert.equal(JSON.stringify(old.head()), before, 'a Re-read keeps it refused');
    await rebuilt(old, 'an old refused join');
});

test('a marked join records the party it relied on: deleting the earlier leave (or taking its line out and Re-reading it) that made room fails the join\'s guard, and a Re-read decides it again (8 active at most)', { skip }, async t => {
    for (const how of ['delete', 'edit']) {
        const host = await packed();
        t.after(() => host.close());
        await host.send('Ren goes.', reply('- party Ren'));
        const leave = lastAt(host);
        await host.send('Ann comes.', reply('+ party Ann'));
        const join = lastAt(host);
        assert.deepEqual([active(host), partyOf(host.head()).length], [8, 9], 'Ann took the place Ren left');
        if (how === 'delete') await host.st.deleteMessage(leave);
        else { host.ctx.chat[leave].mes = 'Ren stays.'; assert.equal((await host.turn.reread(leave)).ok, true); }   // (the leave line taken out of the reply, then Re-read)
        await settled(host, `after a ${how}`);
        assert.equal(partyOf(host.head()).some(person => person.name === 'Ann' && !person.left) && active(host) > PARTY_MAX, false);
        const at = host.ctx.chat.findIndex(message => /\+ party Ann/.test(message.mes ?? ''));
        assert.ok(at >= 0 && at < join + 1);
        assert.equal((await host.turn.reread(at)).ok, true);
        assert.equal(active(host), 8, 'the Re-read decides it on the party as it is: Ann is refused, still 8');
        assert.equal(partyOf(host.head()).some(person => person.name === 'Ann'), false);
        assert.match(problems(host).at(-1), /the party is full \(8 active\); someone must leave first/);
        await settled(host, `after the Re-read (${how})`);
    }
});

test('a marked return records the party it relied on: deleting the earlier leave behind a return fails its guard, and a Re-read decides it again', { skip }, async t => {
    const host = await packed();
    t.after(() => host.close());
    await host.send('Ren goes.', reply('- party Ren'));
    await host.send('Kit goes.', reply('- party Kit'));
    const second = lastAt(host);
    await host.send('Ann comes.', reply('+ party Ann'));
    await host.send('Ren is back.', reply('+ party Ren'));
    assert.deepEqual([active(host), partyOf(host.head()).filter(person => person.left).map(person => person.name)], [8, ['Kit']]);
    await host.st.deleteMessage(second);
    await settled(host, 'after deleting an earlier leave');
    // (the RETURN, the last `+ party Ren`: the first one is the original join)
    const back = host.ctx.chat.findLastIndex(message => /\+ party Ren/.test(message.mes ?? ''));
    assert.equal(back, lastAt(host));
    // (Ann's join had room without Kit's leave, so it stays; only the return, which needed that leave, is skipped: Ren is still away)
    assert.equal(partyOf(host.head()).find(person => person.name === 'Ren').left, true, 'the return fails its guard: Ren is still away');
    assert.equal(partyOf(host.head()).some(person => person.name === 'Ann'), true);
    assert.equal((await host.turn.reread(back)).ok, true);
    assert.equal(partyOf(host.head()).find(person => person.name === 'Ren').left, true, 'a Re-read decides the return on the party as it is: eight are active, so Ren stays away');
    assert.equal(active(host), 8);
    await settled(host, 'after the Re-read');
});

test('every way in records the party: Add to party, the wizard (New character, Edit first) and the template make a member who is skipped when the earlier leave that made room goes', { skip }, async t => {
    for (const route of ['add', 'wizard', 'template']) {
        const host = await packedAsk();
        t.after(() => host.close());
        await host.send('Ren goes.', reply('- party Ren'));
        const leave = lastAt(host);
        assert.equal(active(host), 3);
        if (route === 'add') {
            await host.send('Ann walks in.', reply('+ party Ann | about: a tinker | class: I | best: int'));
            const added = await host.sdk.command(JOIN_ADD, host.sdk.query('rpg.joins', {})[0]);
            assert.equal(added.ok, true, added.message);
        } else if (route === 'wizard') {
            await host.send('Quiet.', 'Quiet.');
            await make(host, 'Ann');
        } else {
            await host.send('Quiet.', 'Quiet.');
            assert.equal((await host.sdk.command('dm.define', { definition: templateCharacter() })).ok, true);
        }
        assert.equal(active(host), 4, `${route}: took the place Ren left`);
        await host.st.deleteMessage(leave);
        await settled(host, `${route}: after deleting the leave`);
        assert.equal(active(host), 4, `${route}: Ren is active again and the new member is skipped, not a ninth`);
        assert.equal(partyOf(host.head()).find(person => person.name === 'Ren').left, false);
        assert.equal(partyOf(host.head()).some(person => person.name === 'Ann' || person.module === 'pack.chat/template-hero'), false, `${route}: not made`);
        assert.equal((await host.turn.reread(lastAt(host))).ok, true);
        await settled(host, `${route}: after a Re-read`);
    }
});

test('a Character made by the template or the wizard with 4 active is refused with the party-full sentence; the same at 3 is made', { skip }, async t => {
    const host = await packedAsk();
    t.after(() => host.close());
    for (const definition of [templateCharacter(), (() => { const d = templateCharacter(); d.slug = 'ann'; d.name = 'Ann'; d.state.who.default = 'Ann'; return d; })()]) {
        const refused = await host.sdk.command('dm.define', { definition });
        assert.equal(refused.ok, false);
        assert.match(refused.message, /the party is full \(4 active\); someone must leave first/);
    }
    assert.equal(active(host), 4);
    await host.send('Ren goes.', reply('- party Ren'));
    assert.equal((await host.sdk.command('dm.define', { definition: templateCharacter() })).ok, true);
    assert.equal(active(host), 4);
});

test('the reader\'s Add to party keeps the limit of 4 even on an offer from a reply with only the partyRoom mark: refused with the party-full sentence', { skip }, async t => {
    const host = await world({ mode: 'ask', eight: true });
    t.after(() => host.close());
    for (const who of ['Mara', 'Ren', 'Ilse']) await make(host, who);
    assert.equal(active(host), 4);
    await host.send('Ann walks in.', reply('+ party Ann | about: a tinker | class: I | best: int'));
    const offer = host.sdk.query('rpg.joins', {})[0];
    assert.equal(offer.four, undefined, 'an eight-limit reply: the ordinary Ask card');
    const refused = await host.sdk.command(JOIN_ADD, offer);
    assert.equal(refused.ok, false);
    assert.match(refused.message, /the party is full \(4 active\); someone must leave first/);
    assert.equal(partyOf(host.head()).some(person => person.name === 'Ann'), false);
});

test('a join captured before the mark replays with the old room (8 own blocks): the removal it relied on going makes it skipped, as Re-read refuses it', { skip }, async t => {
    const host = await world();
    t.after(() => host.close());
    for (const who of ['Ren', 'Ilse']) await make(host, who);
    assert.equal((await host.sdk.command('dm.define', { definition: { ...filler(), slug: 'filler-0', name: 'Filler 0', kinds: {} } })).ok, true);
    assert.equal(blocks(host).length, 7);
    await host.send('Quiet.', 'Quiet.');
    const removal = lastAt(host);
    assert.equal((await host.sdk.command('dm.remove', { module: 'pack.chat/filler-0' })).ok, true);
    const marker = host.store.setRuleMarks;
    host.store.setRuleMarks = () => { throw new Error('old reply'); };
    await host.send('Mara comes.', reply(MARA));
    host.store.setRuleMarks = marker;
    const join = lastAt(host);
    assert.equal(host.ctx.chat[join].extra.storySuite.rules, undefined);
    assert.equal(blocks(host).length, 8, 'six and two');
    await host.st.deleteMessage(removal);
    await settled(host, 'after deleting the removal');
    assert.equal(blocks(host).length, 7, 'the old guard keeps 8: the join is skipped, not a ninth block');
    assert.equal(partyOf(host.head()).some(person => person.name === 'Mara'), false);
    const at = host.ctx.chat.findIndex(message => /\+ party Mara/.test(message.mes ?? ''));
    assert.equal((await host.turn.reread(at)).ok, true);
    assert.equal(blocks(host).length, 7, 'and a Re-read refuses it the same way');
    await settled(host, 'after the Re-read');
});

test('the pin bytes refuse a join on a marked reply, and the old 16 pins refuse one on a reply from before the mark', { skip }, async t => {
    // Bytes: ten pairs would be about 290 KB against the 262144 cap, so with companions leaving to make room one of the joins is refused for the bytes.
    const host = await packed();
    t.after(() => host.close());
    const names = ['Ann', 'Bo', 'Cy', 'Di'];
    let refused = null;
    for (const [n, who] of names.entries()) {
        await host.send(`${['Mara', 'Ren', 'Ilse', 'Dov'][n]} goes.`, reply(`- party ${['Mara', 'Ren', 'Ilse', 'Dov'][n]}`));
        await host.send(`${who} comes.`, reply(`+ party ${who}`));
        refused = problems(host).find(message => /Retained pin budget exhausted/.test(message));
        if (refused) break;
    }
    assert.match(refused ?? '', /Retained pin budget exhausted/, 'a join was refused for the pin bytes');
    assert.equal(new TextEncoder().encode(JSON.stringify(host.head().domains.dataModules.pins)).length <= 262144, true);
    // The old pin limit: 15 pins (13 from a pack, two of the story's own) leave no room for two more under 16; the new room is 28.
    const state = count => ({ domains: { dataModules: { active: Object.fromEntries(Array.from({ length: count }, (_, n) => [`m${n}`, { hash: `h${n}` }])), pins: Object.fromEntries(Array.from({ length: count }, (_, n) => [`h${n}`, { packId: n < 2 ? 'chat' : 'pack' }])) } } });
    const request = { op: '+', name: 'Mara', about: '', soul: 1, best: '' };
    assert.match(checkJoin(state(15), request, DM_OLD_ROOM).why, /no room for two more blocks/, 'old: 15 pins + 2 is over 16');
    assert.equal(checkJoin(state(14), request, DM_OLD_ROOM).ok, true, 'old: 14 + 2 fits 16');
    assert.equal(checkJoin(state(15), request).ok, true, 'marked: 28 pins');
    assert.match(checkJoin(state(27), request).why, /no room for two more blocks \(at most 20\)/, 'marked: 27 + 2 is over 28');
});

test('a swipe takes the companion back; a Re-read and a rebuild and a reload keep it; deleting the reply takes it away', { skip }, async t => {
    const host = await world();
    t.after(() => host.close());
    await host.send('Mara walks in.', reply(MARA));
    const at = host.ctx.chat.length - 1;
    assert.equal(blocks(host).includes('pack.chat/mara'), true);
    const done = await host.turn.reread(at);
    assert.equal(done.ok, true);
    assert.equal(blocks(host).includes('pack.chat/mara'), true, 'a Re-read makes it the same way');
    assert.deepEqual(partyOf(host.head()).map(person => person.name), ['Wessel', 'Mara']);
    await rebuilt(host, 'after a Re-read');
    await host.swipe('Nobody comes.');
    assert.deepEqual(blocks(host), ['pack.chat/wessel', 'pack.chat/wessel-skills'], 'a swipe takes it back');
    await rebuilt(host, 'after a swipe');
    await host.send('Mara again.', reply(MARA));
    await host.st.deleteMessage(host.ctx.chat.length - 1);
    assert.equal(blocks(host).includes('pack.chat/mara'), false, 'deleting the reply takes it away');
    await rebuilt(host, 'after a delete');
});
