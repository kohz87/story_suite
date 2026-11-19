// The Combat Rules v1 Skills learn line shows `type` to the narrator as required (no brackets) while the reader still takes a line without it and stores `attack`
// (the same on a swipe, a middle delete, a rewind, a Re-read, an edited Re-read, a rebuild and a reload); a bad type is still refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { COMBAT_V1_TEMPLATES } from '../../../modules/rpg/templates-combat.js';
import { validateDataModules } from '../../../modules/data-modules/check.js';
import { fullModuleGrammar } from '../../../modules/data-modules/grammar.js';
import { RPG_STRINGS } from '../../../modules/rpg/strings.js';
import { reply, success, view, rebuilt, reload } from '../data-modules/helpers.js';

const learn = extra => `~ dm skills — why | kind: learn-1 | name: Slash | about: A hard cut. | stat: str${extra}`;
const sheet = host => view(host, 'pack.chat/skills').chat;
async function story(t) {
    const host = await createHost(); t.after(() => host.close());
    await host.send('Begin.', 'Opening.');
    for (const { definition } of COMBAT_V1_TEMPLATES) success(await host.sdk.command('dm.define', { definition: structuredClone(definition) }));
    return host;
}
const same = async host => { rebuilt(host); await reload(host); };

test('the grammar line shows the v1 learn type without brackets; the label is not optional', () => {
    const definition = COMBAT_V1_TEMPLATES.find(entry => entry.definition.slug === 'skills').definition;
    assert.equal(definition.kinds['learn-1'].labels.type.optional, undefined);
    const checked = validateDataModules([structuredClone(definition)], { packId: 'chat', capabilities: ['data-modules-v1'] }).definitions[0];
    const text = fullModuleGrammar(checked, 'skills');
    assert.ok(text.includes('| type: attack|area|defence|speed|focus|heal|utility'), text);
    assert.ok(!text.includes('[type:'), 'no brackets');
});

test('a learn line with no type stores attack, and replay agrees (swipe, Re-read, edited Re-read, rebuild, reload); a bad type is refused', async t => {
    const host = await story(t);
    await host.send('Learn.', reply(learn('')));
    assert.deepEqual([sheet(host).skill1, sheet(host).type1], ['Slash', 'attack']);
    await same(host);
    await host.swipe(reply(learn('')));
    assert.equal(sheet(host).type1, 'attack', 'a swipe');
    const index = host.ctx.chat.length - 1;
    assert.equal((await host.turn.reread(index)).ok, true);
    assert.equal(sheet(host).type1, 'attack', 'a Re-read');
    host.ctx.chat[index].mes = reply(learn(' | type: heal'));
    assert.equal((await host.turn.reread(index)).ok, true);
    assert.equal(sheet(host).type1, 'heal', 'an edited Re-read');
    host.ctx.chat[index].mes = reply(learn(''));
    assert.equal((await host.turn.reread(index)).ok, true);
    assert.equal(sheet(host).type1, 'attack', 'an edited Re-read back');
    await same(host);
    const bad = await story(t);
    await bad.send('Learn.', reply(learn(' | type: combat')));
    assert.equal(sheet(bad).skill1, '', 'a type that is not one of the seven is refused');
});

test('a type-less learn replays as live: swipe back, a middle delete of an earlier reply, a rewind (branch), a reload and a chat change', async t => {
    const host = await story(t);
    await host.send('Hurt.', reply('~ dm character — why | kind: set-health | to: 2'));
    await host.send('Learn.', reply(learn('')));
    await host.send('Next.', reply('+ dm skills — why | kind: practice-1 | amount: 5'));
    const learnAt = host.ctx.chat.flatMap((message, index) => (message.is_user ? [] : [index])).at(-2);
    const now = () => JSON.stringify([sheet(host).skill1, sheet(host).type1, sheet(host).practice1]);
    const live = now();
    assert.equal(live, JSON.stringify(['Slash', 'attack', 5]));
    await same(host);
    await host.swipe(reply(learn(' | type: heal')));
    await host.st.swipeTo(host.ctx.chat.length - 1, 0);
    assert.equal(now(), live, 'swipe back');
    await same(host);
    // rewind: a branch at the learn reply holds the skill, typed attack, from the store alone
    assert.ok(await host.ctx.branchChat(learnAt));
    assert.deepEqual([sheet(host).skill1, sheet(host).type1, sheet(host).practice1], ['Slash', 'attack', 0]);
    await same(host);
    // middle delete of the hurt reply (before the learn): the learn stays, typed attack; then a chat change (the saved chat loaded again)
    await host.st.loadChat(JSON.parse(JSON.stringify(host.st.chats[Object.keys(host.st.chats)[0]])));
    await host.st.deleteMessage(learnAt - 2);
    assert.deepEqual([sheet(host).skill1, sheet(host).type1], ['Slash', 'attack']);
    await same(host);
    // middle delete of the learn reply itself: the skill goes
    await host.st.deleteMessage(host.ctx.chat.findIndex(message => /kind: learn-1/.test(String(message.mes))));
    assert.equal(sheet(host).skill1, '');
    await same(host);
});

test('an earlier stance word on a learn line is its new type (evasion, movement: speed; support: focus), the same on a Re-read and a reload', async t => {
    const host = await story(t);
    const learnOf = (n, name, stat, type) => `~ dm skills — why | kind: learn-${n} | name: ${name} | about: A skill. | stat: ${stat} | type: ${type}`;
    await host.send('Learn.', reply(learnOf(1, 'Sidestep', 'agi', 'evasion')));
    assert.deepEqual([sheet(host).skill1, sheet(host).type1], ['Sidestep', 'speed']);
    const index = host.ctx.chat.length - 1;
    assert.equal((await host.turn.reread(index)).ok, true);
    assert.equal(sheet(host).type1, 'speed', 'a Re-read');
    await same(host);
    assert.equal(sheet(host).type1, 'speed', 'a rebuild and a reload');
    const other = await story(t);
    await other.send('Learn.', reply(learnOf(1, 'Rally', 'wis', 'support')));
    assert.deepEqual([sheet(other).skill1, sheet(other).type1, sheet(other).stat1], ['Rally', 'focus', 'wis']);
    await other.send('Learn.', reply(learnOf(2, 'Dash', 'agi', 'movement')));
    assert.equal(sheet(other).skill2, '', 'a second stance (movement is speed) is refused: one stance per character');
});

test('a focus skill line on another stat is taken on WIS (INT and WIS tie), a held focus skill moved to another stat is adjusted too; swipe, Re-read, edited Re-read, middle delete and reload agree', async t => {
    const host = await story(t);
    const learnOf = (name, stat, type) => `~ dm skills — why | kind: learn-1 | name: ${name} | about: A skill. | stat: ${stat} | type: ${type}`;
    const note = RPG_STRINGS.join.focusStat.replace('{skill}', 'Calm').replace('{stat}', 'WIS');
    await host.send('Hurt.', reply('~ dm character — why | kind: set-health | to: 2'));
    await host.send('Learn.', reply(learnOf('Calm', 'str', 'focus')));
    assert.deepEqual([sheet(host).skill1, sheet(host).type1, sheet(host).stat1], ['Calm', 'focus', 'wis'], 'STR focus is held on WIS');
    assert.ok(JSON.stringify(host.ctx.chat).includes(note) || JSON.stringify(host.st.chats).includes(note), 'the receipt carries the note');
    const index = host.ctx.chat.length - 1;
    assert.equal((await host.turn.reread(index)).ok, true);
    assert.equal(sheet(host).stat1, 'wis', 'a Re-read');
    host.ctx.chat[index].mes = reply(learnOf('Calm', 'cha', 'support'));
    assert.equal((await host.turn.reread(index)).ok, true);
    assert.deepEqual([sheet(host).skill1, sheet(host).stat1], ['Calm', 'wis'], 'an edited Re-read (support is focus)');
    host.ctx.chat[index].mes = reply(learnOf('Calm', 'int', 'focus'));
    assert.equal((await host.turn.reread(index)).ok, true);
    assert.equal(sheet(host).stat1, 'int', 'an edited Re-read to a valid stat: no adjustment');
    host.ctx.chat[index].mes = reply(learnOf('Calm', 'agi', 'focus'));
    assert.equal((await host.turn.reread(index)).ok, true);
    assert.equal(sheet(host).stat1, 'wis', 'an edited Re-read, shrunk back to an adjusted stat');
    await same(host);
    await host.send('Learn.', reply(learnOf('Calm', 'int', 'focus')));
    await host.send('Again.', reply(learnOf('Calm', 'str', 'focus')));
    assert.deepEqual([sheet(host).skill1, sheet(host).stat1], ['Calm', 'wis'], 'the update path rewrites the stat on WIS');
    await host.swipe(reply(learnOf('Calm', 'cha', 'focus')));
    assert.equal(sheet(host).stat1, 'wis', 'a swipe');
    await same(host);
    assert.deepEqual([sheet(host).skill1, sheet(host).type1, sheet(host).stat1], ['Calm', 'focus', 'wis'], 'a rebuild and a reload');
    await host.st.deleteMessage(host.ctx.chat.findIndex(message => /set-health/.test(String(message.mes))));
    await same(host);
    assert.deepEqual([sheet(host).skill1, sheet(host).stat1], ['Calm', 'wis'], 'a middle delete of an earlier reply');
});
