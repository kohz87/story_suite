// Combat Rules v1 blocks as the block engine plays them: a level gives one point, the bars follow the stats and the level, the story lowers a bar by a stage word and never raises it,
// practice sets the rank, a Foes slot takes a tier. Live = reload = cold rebuild after each step; a swipe, a middle delete and a Re-read (also of an edited reply) agree.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { COMBAT_V1_TEMPLATES } from '../../../src/v2/lean-rpg/templates-combat.js';
import { reply, success, view, rebuilt, reload } from '../data-modules/helpers.js';

const sign = kind => (/^(practice-|set-slot)/u.test(kind) ? '+' : /^clear-/u.test(kind) ? '-' : '~');
const line = (slug, kind, extra = '') => `${sign(kind)} dm ${slug} — why | kind: ${kind}${extra}`;
const sheet = (host, slug) => view(host, `pack.chat/${slug}`).chat;
const at = (host, ...keys) => keys.map(key => sheet(host, 'character')[key]);
// (`jump`: Skills with practice1 editable, so a test can set a practice by hand; the shipped block has it read-only.)
async function story(t, { jump = false } = {}) {
    const host = await createHost(); t.after(() => host.close());
    await host.send('Begin.', 'Opening.');
    for (const { definition } of COMBAT_V1_TEMPLATES) {
        const made = structuredClone(definition);
        if (jump && made.slug === 'skills') delete made.state.practice1.edit;
        success(await host.sdk.command('dm.define', { definition: made }));
    }
    return host;
}
const same = async host => { rebuilt(host); await reload(host); };

const characterV1 = COMBAT_V1_TEMPLATES[0].definition;
test('Character: XP in whole hundreds raises the Level and each Level gives one point; the bars grow with it', async t => {
    const host = await story(t);
    assert.deepEqual(at(host, 'hp', 'mp', 'sp', 'points'), [7, 10, 10, 0]);
    await host.send('Fight.', 'A fight.');
    success(await host.sdk.command('dm.set', { module: 'pack.chat/character', fields: { xp: 350 } }));
    assert.deepEqual(at(host, 'level', 'xp', 'points'), [4, 50, 3], 'three levels, three points (not every third level)');
    assert.deepEqual(at(host, 'hp-max', 'mp-max', 'sp-max'), [6 + 2, 8 + 1 + 2, 8 + 1 + 2], 'level 4: 5 + 1 + 2, 8 + 1 + 2, 8 + 1 + 2');
    assert.deepEqual(at(host, 'hp'), [8], 'the new blocks arrive full');
    await same(host);
});

test('Character: the story lowers HP by a stage word and never raises it; a rest and a heal raise it', async t => {
    const host = await story(t);
    await host.send('Hit.', reply(line('character', 'set-health', ' | to: 1')));
    assert.equal(at(host, 'hp')[0], 1, 'Badly wounded of 7 is 1');
    await host.send('Better?', reply(line('character', 'set-health', ' | to: 5')));
    assert.equal(at(host, 'hp')[0], 1, 'a stage word never raises a bar');
    await host.send('Binding.', reply(line('character', 'heal', ' | amount: 2')));
    assert.equal(at(host, 'hp')[0], 1 + 2 * Math.floor(7 / 4));
    await host.send('Rest.', reply(line('character', 'set-health', ' | to: 1')));
    await host.send('Salve.', reply(line('character', 'heal', ' | amount: Half')));
    assert.equal(at(host, 'hp')[0], 1 + 2 * Math.floor(7 / 4), 'the story says a heal in words (Half = 2 quarters), never a number');
    assert.deepEqual(Object.values(characterV1.kinds.heal.labels.amount.names), ['A quarter', 'Half', 'Three quarters']);
    await host.send('Night.', reply(line('character', 'full-rest')));
    assert.deepEqual(at(host, 'hp', 'mp', 'sp'), [7, 10, 10]);
    await same(host);
});

test('Character: Down then still Down ends the story; a swipe takes the death back', async t => {
    const host = await story(t);
    await host.send('Fall.', reply(line('character', 'set-health', ' | to: 0')));
    assert.deepEqual(at(host, 'hp', 'down', 'alive'), [0, true, true], 'Down once is not death');
    await host.send('Worse.', reply(line('character', 'set-health', ' | to: 0')));
    assert.equal(at(host, 'alive')[0], false);
    await host.swipe('Spared.');
    assert.equal(at(host, 'alive')[0], true);
    await same(host);
});

test('Skills: a hundred practice is one rank, up to Legend at 600; a learn line takes a type; a swipe and a Re-read agree', async t => {
    const host = await story(t, { jump: true });
    const LEARN = ' | name: Slash | about: A hard cut. | stat: str | type: area';
    await host.send('Learn.', reply(line('skills', 'learn-1', LEARN)));
    assert.deepEqual([sheet(host, 'skills').skill1, sheet(host, 'skills').type1, sheet(host, 'skills').rank1], ['Slash', 'area', 0]);
    await host.send('Train.', reply(line('skills', 'practice-1', ' | amount: 20')));
    success(await host.sdk.command('dm.set', { module: 'pack.chat/skills', fields: { practice1: 590 } }));
    assert.equal(sheet(host, 'skills').rank1, 5);
    await host.send('More.', reply(line('skills', 'practice-1', ' | amount: 20')));
    assert.deepEqual([sheet(host, 'skills').practice1, sheet(host, 'skills').rank1], [600, 6], 'practice stops at 600, rank 6 is Legend');
    await same(host);
    const index = host.ctx.chat.length - 1;
    host.ctx.chat[index].mes = reply(line('skills', 'practice-1', ' | amount: 5'));
    assert.equal((await host.turn.reread(index)).ok, true);
    assert.equal(sheet(host, 'skills').rank1, 5, 'the edited Re-read decides on the reply as it now reads');
    await same(host);
});

test('Foes: a group with no tier is a standard foe, and a swipe, a Re-read and an edited Re-read agree', async t => {
    const host = await story(t);
    const foes = () => sheet(host, 'foes');
    await host.send('Wolves.', reply(line('foes', 'set-slot-1', ' | name: Wolf | count: 2 | level: 3')));
    assert.deepEqual([foes().foe1, foes().count1, foes().tier1], ['Wolf', 2, 'standard'], 'no tier reads as standard instead of being refused');
    await same(host);
    await host.swipe(reply(line('foes', 'set-slot-1', ' | name: Rat | count: 3 | level: 1')));
    assert.deepEqual([foes().foe1, foes().tier1], ['Rat', 'standard']);
    const index = host.ctx.chat.length - 1;
    assert.equal((await host.turn.reread(index)).ok, true);
    assert.deepEqual([foes().foe1, foes().tier1], ['Rat', 'standard'], 'a Re-read keeps it');
    host.ctx.chat[index].mes = reply(line('foes', 'set-slot-1', ' | name: Rat | count: 3 | level: 1 | tier: boss'));
    assert.equal((await host.turn.reread(index)).ok, true);
    assert.equal(foes().tier1, 'boss', 'an edited Re-read that names a tier takes it');
    host.ctx.chat[index].mes = reply(line('foes', 'set-slot-1', ' | name: Rat | count: 3 | level: 1'));
    assert.equal((await host.turn.reread(index)).ok, true);
    assert.equal(foes().tier1, 'standard', 'and one that drops the tier goes back to standard');
    await same(host);
});

test('Foes: a slot takes a tier and holds at most six; clear empties it; middle delete rebuilds', async t => {
    const host = await story(t);
    await host.send('Wolves.', reply(line('foes', 'set-slot-1', ' | name: Wolf | count: 4 | level: 3 | tier: elite')));
    const foes = () => sheet(host, 'foes');
    assert.deepEqual([foes().foe1, foes().count1, foes().level1, foes().tier1], ['Wolf', 4, 3, 'elite']);
    await host.send('Rats.', reply(line('foes', 'set-slot-2', ' | name: Rat | count: 3 | level: 1 | tier: mob')));
    assert.equal(foes().tier2, 'mob');
    await host.send('Seven?', reply(line('foes', 'set-slot-3', ' | name: Bat | count: 7 | level: 1 | tier: mob')));
    assert.equal(foes().count3, 0, 'seven in a group is refused');
    await host.send('Done.', reply(line('foes', 'clear-1', ' | why: captured')));
    assert.deepEqual([foes().foe1, foes().count1, foes().tier1], ['', 0, 'standard']);
    await same(host);
    await host.st.deleteMessage(3);
    rebuilt(host);
    assert.deepEqual([foes().foe1, foes().foe2, foes().count2], ['', 'Rat', 3], 'the wolves reply goes: the rats stay and the head is rebuilt from the store');
});

test('replay equals live for all three blocks: swipe, swipe back, plain Re-read, middle delete, rewind (branch) and reload', async t => {
    const host = await story(t);
    const A = reply(line('character', 'set-health', ' | to: 2'));
    const B = reply(line('skills', 'learn-1', ' | name: Slash | about: A hard cut. | stat: dex | type: area'), line('skills', 'practice-1', ' | amount: 15'));
    const C = reply(line('foes', 'set-slot-1', ' | name: Wolf | count: 4 | level: 3 | tier: elite'));
    await host.send('Hurt.', A); await host.send('Learn.', B); await host.send('Wolves.', C);
    const now = () => JSON.stringify([at(host, 'hp', 'mp', 'sp'), sheet(host, 'skills').skill1, sheet(host, 'skills').practice1, sheet(host, 'foes').foe1, sheet(host, 'foes').tier1, sheet(host, 'foes').count1]);
    const replies = () => host.ctx.chat.flatMap((message, index) => (message.is_user ? [] : [index]));   // (the greeting, the Opening, then the Hurt, Learn and Wolves replies)
    const [, , hurtAt, learnAt] = replies();
    const live = now();
    assert.equal(live, JSON.stringify([[3, 10, 10], 'Slash', 15, 'Wolf', 'elite', 4]), 'Badly... Hurt of 7 is 3 (2/5 of 7 rounded)');
    await same(host);
    // swipe: a different third reply; swipe back to the first: the same head as before.
    await host.swipe(reply(line('foes', 'set-slot-1', ' | name: Rat | count: 2 | level: 1 | tier: mob')));
    assert.equal(sheet(host, 'foes').foe1, 'Rat'); await same(host);
    await host.st.swipeTo(host.ctx.chat.length - 1, 0);
    assert.equal(now(), live, 'swipe back'); await same(host);
    // a plain Re-read of the last reply and of the first one
    const last = await host.turn.reread(host.ctx.chat.length - 1); assert.equal(last.ok, true, JSON.stringify(last));
    assert.equal(now(), live, 'Re-read of the last reply'); await same(host);
    const first = await host.turn.reread(hurtAt); assert.equal(first.ok, true, JSON.stringify(first));
    assert.equal(now(), live, 'Re-read of the first reply'); await same(host);
    // rewind: a branch at the Skills reply holds the state up to it, from the store alone.
    const before = host.ctx.chat.length;
    assert.ok(await host.ctx.branchChat(learnAt));
    assert.deepEqual([host.ctx.chat.length < before, sheet(host, 'foes').count1, sheet(host, 'skills').skill1, at(host, 'hp')[0]], [true, 0, 'Slash', 3], 'foes not yet, the skill and the hurt kept');
    await same(host);
    // middle delete, then reload: the Skills reply goes, the rest stays.
    await host.st.loadChat(JSON.parse(JSON.stringify(host.st.chats[Object.keys(host.st.chats)[0]])));
    await host.st.deleteMessage(learnAt);
    assert.deepEqual([sheet(host, 'skills').skill1, sheet(host, 'foes').foe1, at(host, 'hp')[0]], ['', 'Wolf', 3]);
    await same(host);
});

test('Character: the death latch and recovery come from one definition: no kind writes XP or a number', () => {
    assert.deepEqual(Object.keys(characterV1.kinds).sort(), ['button-rest', 'full-rest', 'heal', 'rest', 'set-health', 'set-mana', 'set-stamina']);
});
