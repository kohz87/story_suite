// Dice in order (`diceInOrder` mark): a roll line needs no die, code gives the next one. R0-R5 of the batch plan: an old reply replays unchanged,
// and a marked reply comes out the same after Re-read, swipe, edit, Continue and a rebuild; a refusal is shown on the card.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost, hostAvailable } from '../../../../testkit/index.js';
import { LEAN_RPG_FEATURE } from '../../../../src/v2/lean-rpg/index.js';
import { STANDARD_TEMPLATES } from '../../../../src/v2/lean-rpg/templates.js';
import { checksOf } from '../../../../src/v2/lean-rpg/practice.js';
import { reply, success } from '../../data-modules/helpers.js';
import { tailOf } from '../helpers.js';
import { seedCrypto } from '../../qa/helpers/seeded.js';

const available = await hostAvailable();
const skip = available.ok ? false : available.reason;
const definitionOf = name => structuredClone(STANDARD_TEMPLATES.find(entry => entry.name === name).definition);
const NOTE = /Dice for this reply, in order: (\d+), (\d+), (\d+)\./u;

async function world(t) {
    t.after(seedCrypto(7));
    const host = await createHost();
    t.after(() => host.close());
    host.features.set(LEAN_RPG_FEATURE, true);
    await host.send('Begin.', 'Opening.');
    for (const name of ['Character', 'Skills']) success(await host.sdk.command('dm.define', { definition: definitionOf(name) }));
    success(await host.sdk.command('dm.set', { module: 'pack.chat/character', fields: { who: 'Astra', level: 20, dex: 12, cha: 10 } }));
    success(await host.sdk.command('dm.set', { module: 'pack.chat/skills', fields: { who: 'Astra' } }));
    return host;
}
const diceOf = host => host.ctx.chat.at(-1).extra.storySuite.receipts.find(receipt => receipt.type === 'rpg.dice').data.v2.dice.list;
const after = (host, make) => ({ toString() { const found = NOTE.exec(tailOf(host.st.requests.at(-1))); return make(found ? [1, 2, 3].map(n => Number(found[n])) : []); } });
const recordOf = (host, index = host.ctx.chat.length - 1) => host.ctx.chat[index].extra.storySuite;
const checks = (host, index) => checksOf(recordOf(host, index).receipts);
const lines = body => `Story.\n<Changes>\n${body}\n</Changes>`;
const problems = host => host.turn.problems().map(problem => problem.message).join(' ');
const STEP = receipt => receipt.type === 'rpg.check';
const shown = host => JSON.stringify([checks(host), recordOf(host).receipts.find(STEP)?.replan.payload]);

test('a reply written now carries the mark; its roll lines take the dice in order, with or without a written die', { skip }, async t => {
    const host = await world(t);
    await host.send('I try.', after(host, dice => lines(`? roll Astra | cha | easy\n? roll Astra | cha | normal | ${dice[2]}\n? roll Astra | cha | hard | ${dice[2] === 5 ? 6 : 5}`)));
    assert.ok(recordOf(host).rules.includes('diceInOrder'));
    const dice = diceOf(host), results = checks(host);
    assert.deepEqual(results.map(result => result.die), dice, 'the next die each time: a wrong die written changes nothing but the note');
    assert.equal(recordOf(host).receipts.find(STEP).replan.payload.inOrder, true, 'the flag is in the step\'s input, so it is guarded');
    assert.match(problems(host), /was worked with \d+, the next die in order \(the line wrote \d+\)/u);
});

test('a visible refusal: a fourth check has no die left, and says so on the card', { skip }, async t => {
    const host = await world(t);
    await host.send('I try.', lines('? roll Astra | cha | easy\n? roll Astra | cha | easy\n? roll Astra | cha | easy\n? roll Astra | cha | easy'));
    assert.equal(checks(host).length, 3);
    assert.match(problems(host), /"\? roll Astra \| cha \| easy" was not used: more than 3/u);
});

test('R0: a reply whose record lacks the mark keeps the four-part rules and their refusals, the same on every Re-read', { skip }, async t => {
    const host = await world(t);
    await host.send('I try.', after(host, () => 'Story.'));
    const index = host.ctx.chat.length - 1, dice = diceOf(host);
    recordOf(host).rules = recordOf(host).rules.filter(rule => rule !== 'diceInOrder');
    host.ctx.chat[index].mes = lines(`? roll Astra | cha | normal | ${dice[0]}\n? roll Astra | cha | easy`);
    success(await host.turn.reread(index));
    const first = JSON.stringify([host.head(), shown(host)]);
    assert.equal(checks(host).length, 1, 'the four-part line works; the three-part line is refused as before');
    assert.equal(checks(host)[0].die, dice[0]);
    assert.equal(recordOf(host).receipts.find(STEP).replan.payload.inOrder, undefined);
    assert.match(problems(host), /needs four parts/u);
    success(await host.turn.reread(index));
    const again = JSON.stringify([host.head(), shown(host)]);
    assert.equal(again, first);
});

async function marked(t) {
    const host = await world(t);
    await host.send('I try.', after(host, () => lines('? roll Astra | cha | normal\n? roll Astra | cha | hard')));
    return host;
}

test('R1: Re-read gives the same head hash, results and step input', { skip }, async t => {
    const host = await marked(t);
    const index = host.ctx.chat.length - 1, head = JSON.stringify(host.head()), results = shown(host);
    success(await host.turn.reread(index));
    assert.equal(JSON.stringify(host.head()), head);
    assert.equal(shown(host), results, 'the same results and step input (only the receipts\' ordinal bookkeeping moves)');
});

test('R2: a swipe works its own dice, and going back to the first swipe restores its state', { skip }, async t => {
    const host = await marked(t);
    const index = host.ctx.chat.length - 1, first = JSON.stringify(host.head()), firstDice = diceOf(host);
    await host.swipe(after(host, () => lines('? roll Astra | cha | easy')));
    assert.equal(checks(host).length, 1);
    assert.notDeepEqual(diceOf(host), firstDice, 'its own dice');
    assert.equal(checks(host)[0].die, diceOf(host)[0]);
    const second = JSON.stringify(host.head());
    await host.st.swipeTo(index, 0);
    assert.equal(JSON.stringify(host.head()), first);
    await host.st.swipeTo(index, 1);
    assert.equal(JSON.stringify(host.head()), second);
});

test('R3: a prose edit changes nothing; an edit of the line is worked once from the new line', { skip }, async t => {
    const host = await marked(t);
    const index = host.ctx.chat.length - 1, head = JSON.stringify(host.head()), dice = diceOf(host);
    await host.st.editMessage(index, lines('? roll Astra | cha | normal\n? roll Astra | cha | hard').replace('Story.', 'Other words.'));
    success(await host.turn.reread(index));
    assert.equal(JSON.stringify(host.head()), head);
    await host.st.editMessage(index, lines('? roll Astra | cha | very hard'));
    success(await host.turn.reread(index));
    assert.deepEqual(checks(host).map(result => [result.difficulty, result.die]), [['very hard', dice[0]]]);
    const live = JSON.stringify(host.head());
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head()), live);
});

test('R4: Continue applies nothing twice', { skip }, async t => {
    const host = await marked(t);
    const before = checks(host).length;
    await host.cont(`\n\n${reply('More words.')}`);
    assert.equal(checks(host).length, before, 'the Continue text has no new roll line: the checks are not worked again');
    const live = JSON.stringify(host.head());
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head()), live);
});

test('R5: deleting an earlier message and reloading gives the hash built live', { skip }, async t => {
    const host = await marked(t);
    await host.send('Again.', after(host, () => lines('? roll Astra | cha | easy')));
    await host.st.deleteMessage(1);
    await host.turn.onChatChanged();
    const rebuilt = JSON.stringify(host.head());
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head()), rebuilt);
    await host.st.loadChat(structuredClone(host.ctx.chat));
    assert.equal(JSON.stringify(host.head()), rebuilt);
    assert.equal(checks(host).length, 1, 'the last reply keeps its one check, worked with its own recorded dice');
});
