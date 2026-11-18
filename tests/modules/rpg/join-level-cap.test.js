// A companion whose `+ party` line names a class never starts above the party's highest level (SOAK2CORE #3: class II into a level 1 party
// came in at level 15): the Ask card says the capped level, Edit first opens at it, Add to party and Automatically make it, and it replays as live.
import test from 'node:test';
import assert from 'node:assert/strict';
import { skip, reply, fields, rebuilt, world, joinCardOf } from './join.helpers.js';
import { CHOOSER_TEMPLATES as STANDARD_TEMPLATES } from '../../../modules/rpg/templates.js';
import { levelOfJoinClass } from '../../../modules/rpg/formula.js';
import { JOIN_ADD, joinDraft } from '../../../modules/rpg/join.js';

const MARA = '+ party Mara | about: a hedge witch | class: II | best: int';

// Wessel at `level` (the helpers' make() only takes a class).
async function makeAt(host, who, level) {
    const defs = Object.fromEntries(STANDARD_TEMPLATES.filter(entry => ['character', 'skills'].includes(entry.definition.role)).map(entry => [entry.definition.role, structuredClone(entry.definition)]));
    defs.character.slug = who.toLowerCase(); defs.character.name = who; defs.character.state.who.default = who; defs.character.state.level.default = level;
    defs.skills.slug = `${who.toLowerCase()}-skills`; defs.skills.name = `${who}'s skills`; defs.skills.state.who.default = who;
    assert.equal((await host.sdk.command('dm.define', { definition: defs.character })).ok, true);
    assert.equal((await host.sdk.command('dm.define', { definition: defs.skills, after: `pack.chat/${defs.character.slug}` })).ok, true);
}

test('levelOfJoinClass: the class\'s level, never above the party\'s highest level', () => {
    assert.equal(levelOfJoinClass(2), 15);
    assert.equal(levelOfJoinClass(2, 1), 1);
    assert.equal(levelOfJoinClass(2, 12), 12);
    assert.equal(levelOfJoinClass(2, 40), 15);
    assert.equal(levelOfJoinClass(1, 30), 1);
});

test('Ask: a class II offer to a level 1 party says level 1, Edit first opens at level 1, Add to party makes level 1; replay as live', { skip }, async t => {
    const host = await world({ mode: 'ask', wessel: false });
    t.after(() => host.close());
    await makeAt(host, 'Wessel', 1);
    await host.send('Mara walks in.', reply(MARA));
    const card = joinCardOf(host);
    assert.match(card.rows[0].text, /\bLevel 1\b/, card.rows[0].text);
    const edit = card.actions.find(action => action.id === 'edit');
    assert.equal(edit.payload.level, 1);
    assert.equal(joinDraft(edit.payload).level ?? 1, 1, 'Edit first: the wizard opens at level 1 (a level 1 draft carries no level)');
    const added = await host.sdk.command(JOIN_ADD, host.sdk.query('rpg.joins', {})[0]);
    assert.equal(added.ok, true, added.message);
    assert.equal(fields(host, 'mara').level, 1);
    await rebuilt(host, 'after Add to party');
});

test('a level 7 party (Soul Class I by level): the card, Edit first, Add to party and Automatically all give level 7 for a class II line', { skip }, async t => {
    const ask = await world({ mode: 'ask', wessel: false });
    t.after(() => ask.close());
    await makeAt(ask, 'Wessel', 7);
    await ask.send('Mara walks in.', reply(MARA));
    const card = joinCardOf(ask);
    assert.match(card.rows[0].text, /\bLevel 7\b/, card.rows[0].text);
    assert.equal(joinDraft(card.actions.find(action => action.id === 'edit').payload).level, 7, 'Edit first');
    assert.equal((await ask.sdk.command(JOIN_ADD, ask.sdk.query('rpg.joins', {})[0])).ok, true);
    assert.equal(fields(ask, 'mara').level, 7, 'Add to party');
    await rebuilt(ask, 'Add at 7');
    const auto = await world({ mode: 'auto', wessel: false });
    t.after(() => auto.close());
    await makeAt(auto, 'Wessel', 7);
    await auto.send('Mara walks in.', reply(MARA));
    assert.equal(fields(auto, 'mara').level, 7, 'Automatically');
    await rebuilt(auto, 'auto at 7');
});

test('Automatically: a class II line joins a level 12 party at level 12 (not 15); swipe, swipe back, edited Re-read and rebuild agree', { skip }, async t => {
    const host = await world({ mode: 'auto', wessel: false });
    t.after(() => host.close());
    await makeAt(host, 'Wessel', 12);
    await host.send('Mara walks in.', reply(MARA));
    assert.equal(fields(host, 'mara').level, 12);
    await rebuilt(host, 'after the join');
    const before = JSON.stringify(host.head());
    await host.swipe('Nobody comes.');
    assert.equal(fields(host, 'mara'), undefined);
    await host.st.swipeTo(host.ctx.chat.length - 1, 0);
    assert.equal(JSON.stringify(host.head()), before, 'swipe back: the same state');
    const at = host.ctx.chat.length - 1, text = host.ctx.chat[at].mes;
    await host.st.editMessage(at, text.replace('best: int', 'best: dex'));
    assert.equal((await host.sdk.reread(at)).ok, true);
    assert.equal(fields(host, 'mara').level, 12, 'an edited Re-read keeps the cap');
    await rebuilt(host, 'edited Re-read');
});

test('the capped join holds through an edited Re-read grown and shrunk, a middle delete, a rewind and a chat change', { skip }, async t => {
    const host = await world({ mode: 'auto', wessel: false });
    t.after(() => host.close());
    await makeAt(host, 'Wessel', 12);
    await host.send('We wait.', 'Nothing yet.');
    await host.send('Mara walks in.', reply(MARA));
    const at = host.ctx.chat.length - 1, text = host.ctx.chat[at].mes;
    await host.st.editMessage(at, text.replace(MARA, `${MARA}\n+ item Rope`));
    assert.equal((await host.sdk.reread(at)).ok, true);
    assert.equal(fields(host, 'mara').level, 12, 'grown');
    await host.st.editMessage(at, text.replace(MARA, ''));
    assert.equal((await host.sdk.reread(at)).ok, true);
    assert.equal(fields(host, 'mara'), undefined, 'shrunk: no join');
    await host.st.editMessage(at, text);
    assert.equal((await host.sdk.reread(at)).ok, true);
    assert.equal(fields(host, 'mara').level, 12, 'restored');
    await rebuilt(host, 'Re-reads');
    await host.st.deleteMessage(at - 2);
    assert.equal(fields(host, 'mara').level, 12, 'a middle delete');
    await rebuilt(host, 'middle delete');
    await host.send('On.', 'They walk on.\n<Changes>\n+ item Lamp\n</Changes>');
    const last = host.store.receipts().at(-1);
    await host.sdk.rewind({ index: last.index, beforeRev: last.receipt.rev });
    assert.equal(fields(host, 'mara').level, 12, 'a rewind');
    await host.turn.onChatChanged();
    assert.equal(fields(host, 'mara').level, 12, 'a chat change and back');
    await rebuilt(host, 'rewind');
});
