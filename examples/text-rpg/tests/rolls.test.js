import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTry } from '../src/module-parts/kinds/try.js';
import { diceNote } from '../src/dice/note.js';
import { rollsOf } from '../src/module-parts/rolls.js';
import { rollCards } from '../src/module-parts/roll-cards.js';
import { tailOf } from '../src/module-parts/tail.js';
import { astra, fakeCtx, line, run, sliceOf } from './helpers/fake-ctx.js';
import { astraOf, reply, tries, withAstra } from './helpers/host.js';

const CARDS = rollCards();
const cardsAt = (host, index) => Object.keys(CARDS).map(key => CARDS[key].for(host.head(), null, { index, query: (name, args) => host.sdk.query(name, args) })).filter(Boolean);
const rowTexts = card => card.rows.map(row => row.text);
const roll = (die, word, { labels = {}, member = astra(), what = 'Lore', time } = {}) => {
    const slice = sliceOf([member], { list: [die, 10, 10], floor: 0 });
    const done = run(applyTry, fakeCtx(slice, { time: () => time ?? null }), line('try', member.name, `${what}; ${word}`, labels));
    assert.equal(done.ok, true, done.message);
    return done.result;
};

test('a raised roll names its reasons: the threat and each live condition, in the receipt and the summary', () => {
    const member = astra({ conditions: [{ name: 'bleeding', until: 'treated' }] });
    const { data, summary } = roll(11, 'easy', { member, labels: { threat: 'a fair match' } });
    assert.equal(data.raised, true);
    assert.deepEqual(data.why, ['threat a fair match', 'bleeding']);
    assert.match(summary, /raised: threat a fair match, bleeding\)/);
});

test('a roll that was not raised has no reasons, and a drained body is named for a physical roll', () => {
    assert.equal(roll(11, 'normal').data.why, undefined);
    const tired = astra();
    tired.pools.sp.now = 1;
    assert.deepEqual(roll(11, 'easy', { member: tired, what: 'str' }).data.why, ['drained']);
});

test('the dice note gives the reasons beside the floor, and none when nothing is named', () => {
    const base = { list: [11, 3, 20], floor: 2 };
    assert.match(diceNote({ ...base, why: ['threat a fair match', 'bleeding'] }), /Nothing this reply is easier than hard \(threat a fair match, bleeding\)\./);
    assert.match(diceNote(base), /Nothing this reply is easier than hard\./);
    assert.doesNotMatch(diceNote({ ...base, floor: 0, why: ['bleeding'] }), /easier than/);
});

test('the tail\'s dice note names the reader\'s own conditions as the reason for the floor', () => {
    const member = astra({ conditions: [{ name: 'bleeding', until: 'treated' }] });
    const slice = sliceOf([member], { list: [11, 3, 20], floor: 2, threat: 2 });
    const view = { state: { domains: { textRpg: slice } }, feature: id => id === 'text-rpg.on', query: name => (name === 'textRpg.dice' ? slice.dice.sw_reply0001 : null), settings: () => ({}) };
    assert.match(tailOf(view).lines[0], /easier than hard \(threat a fair match, bleeding\)/);
});

const receipt = (type, data, index = 4, summary = '') => ({ index, receipt: { type, summary, data } });
const names = { ac_astra001: 'Astra' };

test('a reply\'s rolls are read from its own receipts: what was rolled, why raised, the cost, the practice, the wear, and the reply\'s xp', () => {
    const entries = [
        receipt('capture.try', { member: 'ac_astra001', target: 'Snap Cut', die: 2, bonus: 0, total: 2, difficulty: 1, band: 'bad', raised: false, paid: 'wound', practice: 10, rankUp: null, worn: [{ slot: 'weapon', before: 100, now: 69, broken: false }] }),
        receipt('capture.spend', { member: 'ac_astra001', skill: 'Snap Cut', practice: 0 }),
        receipt('capture.spend', { member: 'ac_astra001', skill: 'Obscure', practice: 5, rankUp: null }),
        receipt('capture.xp', { amount: 5, levels: 0 }, 4, '5 xp for Cut down six rats.'),
        receipt('capture.try', { member: 'ac_astra001', target: 'WIS', die: 9, bonus: 0, total: 9, difficulty: 2, band: 'failure', raised: true, why: ['bleeding'] }, 6),
    ];
    const got = rollsOf(entries, 4, id => names[id]);
    assert.equal(got.rolls.length, 1, 'the other reply\'s roll is not here');
    assert.deepEqual([got.rolls[0].who, got.rolls[0].target, got.rolls[0].practice, got.rolls[0].worn.length], ['Astra', 'Snap Cut', 10, 1]);
    assert.deepEqual(got.spends.map(item => [item.skill, item.practice]), [['Obscure', 5]], 'a spend of a skill the reply rolled, or that taught nothing, is not listed');
    assert.deepEqual(got.xp, [{ summary: '5 xp for Cut down six rats.', amount: 5, levels: 0 }]);
    assert.deepEqual(rollsOf(null, 4).rolls, []);
});

async function battle(t) {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra();
    t.after(() => host.close());
    await host.send('Hello.', 'The road.');
    return host;
}

test('the cards under the reply: one per roll with the words of the roll, then what the reply earned; a swipe shows its own', async t => {
    const host = await battle(t);
    await host.send('Strike.', reply('The rats swarm.', ['? try Astra | Lore | hard | threat: a fair match', '~ spend Astra — Obscure', '+ xp Party — Cut down the rats | size: minor']));
    const at = host.ctx.chat.length - 1;
    const first = cardsAt(host, at);
    const rolled = tries(host).at(-1).data;
    assert.equal(first.length, 1, 'one card for the reply');
    assert.equal(first[0].title, 'Rolls');
    assert.match(first[0].rows[0].text, new RegExp(`^Lore, hard → .* \\(${rolled.die} [+−] ${Math.abs(rolled.bonus)} vs 16\\)`));
    assert.match(first[0].rows[0].text, /practice \+\d+/);
    assert.equal(first[0].rows.length, 2, 'the roll, then Earned');
    assert.match(first[0].rows.at(-1).text, /^Earned: .*5 xp/);
    assert.match(first[0].rows.at(-1).text, /Astra practised Obscure \+1/);
    const before = JSON.stringify(first);
    await host.swipe(reply('A calmer way.', ['~ spend Astra — Obscure']));
    const swiped = cardsAt(host, at);
    assert.deepEqual(swiped.map(card => card.title), ['Earned'], 'the swipe\'s own receipts: no roll, no xp');
    assert.equal(swiped[0].rows.length, 1);
    assert.match(swiped[0].rows[0].text, /^Earned: Astra practised Obscure/);
    host.store.rebuild();
    assert.equal(JSON.stringify(cardsAt(host, at)), JSON.stringify(swiped), 'a rebuild shows the same');
    assert.notEqual(JSON.stringify(swiped), before);
    assert.deepEqual(host.store.problems(), []);
    assert.ok(astraOf(host));
});

const one = (over = {}) => ({ member: 'ac_astra001', target: 'Snap Cut', die: 2, bonus: 0, total: 2, difficulty: 1, band: 'bad', raised: false, why: [], paid: 'wound', practice: 10, worn: [{ slot: 'weapon', before: 100, now: 69, broken: false }, { slot: 'body', before: 100, now: 69, broken: false }], ...over });
const cardOf = entries => CARDS['text-rpg-rolls'].for({ domains: {} }, null, { index: 4, query: (name, args) => (name === 'textRpg.rolls' ? rollsOf(entries, args.index, id => names[id]) : null) });

test('a roll row says the roll, its cost, practice and wear in one line', () => {
    const card = cardOf([receipt('capture.try', one())]);
    assert.equal(card.title, 'Rolls');
    assert.equal(card.tone, 'bad');
    assert.deepEqual(rowTexts(card), ['Snap Cut, normal → a bad failure (2 + 0 vs 12) · a wound · practice +10 · wear: weapon 69, armour 69']);
});

test('a raised roll names why inside its difficulty; a rank up and a broken piece are said briefly', () => {
    const card = cardOf([receipt('capture.try', one({ target: 'Shadow Step', die: 16, bonus: -2, difficulty: 2, band: 'cost', raised: true, why: ['threat a fair match', 'bleeding'], rankUp: 'Apprentice', worn: [{ slot: 'body', before: 69, now: 39, broken: false }, { slot: 'weapon', before: 39, now: 0, broken: true }] }))]);
    assert.equal(card.tone, 'accent');
    assert.deepEqual(rowTexts(card), ['Shadow Step, hard (threat a fair match, bleeding) → success at a cost (16 − 2 vs 16) · a wound · practice +10 (Shadow Step reaches Apprentice) · wear: armour 39, weapon broken']);
});

test('five rolls are five rows, the card takes the worst band and an Earned row ends it', () => {
    const bands = ['success', 'great', 'failure', 'cost', 'success'];
    const entries = [...bands.map((band, at) => receipt('capture.try', one({ target: `Skill ${at + 1}`, band, paid: 'none', worn: [], practice: 0 }))), receipt('capture.xp', { amount: 5, levels: 0 }, 4, 'Cut down the rats')];
    const card = cardOf(entries);
    assert.equal(card.rows.length, 6);
    assert.equal(card.tone, 'info', 'a failure is the worst of these');
    assert.deepEqual(rowTexts(card).slice(0, 5).map(text => text.split(',')[0]), ['Skill 1', 'Skill 2', 'Skill 3', 'Skill 4', 'Skill 5']);
    assert.match(card.rows[5].text, /^Earned: Cut down the rats/);
    assert.equal(CARDS['text-rpg-rolls'].rows, 8);
});

test('more rolls than the card holds are not dropped: the last ones share one row', () => {
    const entries = Array.from({ length: 10 }, (_, at) => receipt('capture.try', one({ target: `Skill ${at + 1}`, band: 'success', paid: 'none', worn: [], practice: 0 })));
    const card = cardOf(entries);
    assert.equal(card.rows.length, 8);
    assert.match(card.rows[7].text, /^and 3 more: Skill 8 \(success\), Skill 9 \(success\), Skill 10 \(success\)$/);
    assert.equal(card.tone, 'good');
});

test('a reply with nothing rolled and nothing earned has no card', () => {
    assert.equal(cardOf([]), null);
});

test('a spend of a skill the reply rolled is not listed, even when the names differ in spacing or case', () => {
    const card = cardOf([receipt('capture.try', one({ target: 'Snap  Cut', paid: 'none', worn: [] })), receipt('capture.spend', { member: 'ac_astra001', skill: 'snap cut', practice: 5 })]);
    assert.equal(card.rows.length, 1);
});

test('a training scene is told on the Earned row with its rank up, and a roll of the same skill hides it', () => {
    const train = { member: 'ac_astra001', skill: 'Lore', practice: 1, rankUp: 'Apprentice' };
    assert.match(cardOf([receipt('capture.train', train)]).rows[0].text, /^Earned: Astra practised Lore \+1 \(reaches Apprentice\)$/);
    assert.equal(cardOf([receipt('capture.try', one({ target: 'Lore', paid: 'none', worn: [] })), receipt('capture.train', train)]).rows.length, 1);
});
