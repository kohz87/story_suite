// The Skills block never overwrites a slot (USER, 3 Nov): a `learn-N` line of a name some slot holds updates that slot, a new name goes to
// slot N if it is empty else the first free one, none free is refused (one Problems line); a `practice-N` whose reason names one of the
// character's skills is credited to that skill's slot. Receipts name the skill. live = swipe = Re-read = rebuild = reload.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { CHOOSER_TEMPLATES as STANDARD_TEMPLATES } from '../../../modules/rpg/templates.js';
import { reply, success, view, rebuilt, reload } from '../data-modules/helpers.js';

const IAI = ' | name: Iaijutsu | about: Drawing cuts. | stat: dex | type: attack';
const SHADOW = ' | name: Shadow Cut | about: A cut from the dark. | stat: agi | type: attack';
const learn = (n, extra, why = 'learned') => `~ dm skills — ${why} | kind: learn-${n}${extra}`;
const practice = (n, why, amount = 10) => `+ dm skills — ${why} | kind: practice-${n} | amount: ${amount}`;
const sheet = host => view(host, 'pack.chat/skills').chat;
async function story(t, templates = STANDARD_TEMPLATES) {
    const host = await createHost(); t.after(() => host.close());
    await host.send('Begin.', 'Opening.');
    success(await host.sdk.command('dm.define', { definition: structuredClone(templates.find(entry => entry.name === 'Skills').definition) }));
    await host.send('Learn.', reply(learn(1, IAI)));
    return host;
}
const told = host => host.turn.problems().map(problem => problem.message);

test('the Standard Skills template guards learn-N itself (a filled slot refuses)', () => {
    const standard = STANDARD_TEMPLATES.find(entry => entry.name === 'Skills').definition;
    for (const n of [1, 2, 3, 4, 5]) {
        assert.deepEqual(standard.kinds[`learn-${n}`].when, ['eq', ['get', [`skill${n}`]], '']);
    }
});

test('receipts say which skill was learned or practised; a swipe, a Re-read and a delete replay the same', async t => {
    const host = await story(t);
    await host.send('Learn.', reply(learn(1, SHADOW)));
    const at = host.ctx.chat.length - 1;
    const receipt = () => host.ctx.chat[at].extra.storySuite.receipts.map(entry => entry.summary ?? entry.receipt?.summary ?? JSON.stringify(entry)).join(' ');
    assert.match(receipt(), /learn-2 \(Shadow Cut\)/);
    await host.send('Train.', reply(practice(1, 'Practiced Shadow Cut')));
    assert.match(host.ctx.chat.at(-1).extra.storySuite.receipts.map(entry => JSON.stringify(entry)).join(' '), /practice-2 \(Shadow Cut\)/);
    const after = JSON.stringify(sheet(host));
    assert.equal((await host.turn.reread(host.ctx.chat.length - 1)).ok, true);
    assert.equal(JSON.stringify(sheet(host)), after, 'Re-read');
    await host.swipe(reply(practice(2, 'Practiced Iaijutsu', 5)));
    assert.deepEqual([sheet(host).practice1, sheet(host).practice2], [5, 0], 'a swipe takes the first reply\'s credit back and applies its own');
    rebuilt(host);
    await reload(host);
    await host.st.deleteMessage(host.ctx.chat.length - 2);
    rebuilt(host);
});

test('a named practice goes to its slot; ambiguous names are refused while an unnamed reason uses N', async t => {
    const host = await story(t);
    await host.send('Learn.', reply(learn(4, SHADOW)));
    assert.deepEqual([sheet(host).skill2, sheet(host).skill4], ['', 'Shadow Cut']);
    await host.send('Learn.', reply(learn(2, ' | name: Cut | about: A plain cut. | stat: str | type: attack')));
    assert.equal(sheet(host).skill2, 'Cut');
    await host.send('Train.', reply(practice(1, 'Practiced Shadow Cut and Iaijutsu')));
    assert.deepEqual([sheet(host).practice1, sheet(host).practice2, sheet(host).practice4], [0, 0, 0], 'two skills named: no arbitrary credit');
    assert.ok(told(host).some(message => message.includes('Name exactly one known skill')));
    await host.send('Train.', reply(practice(1, 'Practiced Shadow Cut')));
    assert.deepEqual([sheet(host).practice4, sheet(host).practice2], [10, 0], 'Shadow Cut, not its part Cut');
    await host.send('Train.', reply(practice(3, 'nothing to name')));
    assert.equal(sheet(host).practice3, 0, 'slot 3 is empty: refused as before');
    rebuilt(host);
});

test('explicit skill labels credit the named utility slot; unknown and ambiguous names never default to slot 1', async t => {
    const host = await story(t);
    for (const [n, name] of [[2, 'Flash'], [3, 'Shadow Step'], [4, 'Obscure']]) {
        await host.send('Learn.', reply(learn(n, ` | name: ${name} | about: Skill. | stat: dex${n === 4 ? ' | type: utility' : ''}`)));
    }
    await host.send('Use.', reply('+ dm skills — practiced | kind: practice-1 | skill: Obscure | amount: 10'));
    assert.deepEqual([1, 2, 3, 4].map(n => sheet(host)[`practice${n}`]), [0, 0, 0, 10]);
    await host.send('Use both.', reply('+ dm skills — practiced | kind: practice-1 | skill: Obscure | amount: 7', '+ dm skills — practiced | kind: practice-1 | skill: Flash | amount: 7'));
    assert.deepEqual([sheet(host).practice1, sheet(host).practice2, sheet(host).practice4], [0, 7, 17]);
    await host.send('Use.', reply('+ dm skills — practiced | kind: practice-1 | name: Unknown | amount: 10'));
    assert.deepEqual([sheet(host).practice1, sheet(host).practice4], [0, 17]);
    const live = JSON.stringify(sheet(host));
    assert.equal((await host.turn.reread(host.ctx.chat.length - 3)).ok, true);
    assert.equal(JSON.stringify(sheet(host)), live);
    rebuilt(host);
    await reload(host);
});

test('changing an earlier skill name cannot leave later practice on the wrong skill', async t => {
    const host = await story(t);
    await host.send('Learn.', reply(learn(4, ' | name: Obscure | about: Hide. | stat: dex | type: utility')));
    const earlier = host.ctx.chat.length - 1;
    await host.send('Train.', reply('+ dm skills — practiced | kind: practice-1 | skill: Obscure | amount: 10'));
    assert.equal(sheet(host).practice4, 10);
    host.ctx.chat[earlier].mes = host.ctx.chat[earlier].mes.replace('name: Obscure', 'name: Vanish');
    assert.equal((await host.turn.reread(earlier)).ok, true);
    assert.equal(sheet(host).skill4, 'Vanish');
    assert.equal(sheet(host).practice4, 0, 'a no-longer-matching skill gets no practice');
    rebuilt(host);
});

test('an old unmarked ambiguous practice line keeps its slot on Re-read', async t => {
    const host = await story(t);
    await host.send('Learn.', reply(learn(2, SHADOW)));
    const setter = host.store.setRuleMarks;
    host.store.setRuleMarks = () => { throw new Error('old reply'); };
    await host.send('Train.', reply(practice(1, 'Practiced Shadow Cut and Iaijutsu')));
    host.store.setRuleMarks = setter;
    const at = host.ctx.chat.length - 1;
    assert.deepEqual([sheet(host).practice1, sheet(host).practice2], [10, 0]);
    assert.equal((await host.turn.reread(at)).ok, true);
    assert.deepEqual([sheet(host).practice1, sheet(host).practice2], [10, 0]);
    rebuilt(host);
});
