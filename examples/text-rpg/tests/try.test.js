import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTry } from '../src/module-parts/kinds/try.js';
import { diceBefore, lastDice } from '../src/module-parts/dice-source.js';
import { SID, astra, fakeCtx, line, run, sliceOf } from './helpers/fake-ctx.js';
import { withFoes } from './helpers/foes.js';

// Astra: every stat 12 (stats are not in the roll), Novice in her skills (bonus 0), 14 sp and no wounds. Ordinary is 15, hard 20.
// `threat`: the threat index of a group of foes standing (the code sets the difficulty from it); a `threat:` label on the line is ignored.
const roll = (die, difficulty = 'ordinary', { labels = {}, what = 'Lore', member = astra(), live, options, threat } = {}) => {
    const slice = sliceOf([member], live === undefined ? { list: [die, 10, 10], floor: 0 } : live);
    if (threat !== undefined) withFoes(slice, [['Foes', 3, threat]]);
    const ctx = fakeCtx(slice, options);
    const done = run(applyTry, ctx, line('try', member.name, `${what}; ${difficulty}`, labels));
    return { done, slice, me: slice.members[member.id], data: done.result?.data };
};
const trained = (practice, member = astra()) => Object.assign(member, { practice: { lore: practice, obscure: practice } });

test('a total at the number is a success: no harm, practice +5 on an ordinary roll, the die is used', () => {
    const { data, me, slice } = roll(15);
    assert.equal(data.band, 'success');
    assert.equal(data.total, 15);
    assert.equal(me.wounds, 0);
    assert.equal(me.practice.lore, 5);
    assert.equal(slice.dice[SID].used, 1);
    assert.equal(slice.dice[SID].hardest, 2);
});

test('a hard success teaches most (+10) and a rank up is told', () => {
    const member = astra();
    member.practice.lore = 35;
    const { data, me } = roll(20, 'hard', { member });
    assert.equal(data.band, 'success');
    assert.equal(me.practice.lore, 45);
    assert.equal(data.rankUp, 'Apprentice');
});

test('a trivial roll teaches 1 (a plain use), an easy one 5', () => {
    assert.equal(roll(20, 'trivial').me.practice.lore, 1);
    assert.equal(roll(10, 'easy').me.practice.lore, 5);
});

test('one or two short is success at a cost: a costed skill pays twice with no hit', () => {
    const { data, me } = roll(13, 'ordinary', { what: 'Obscure' });
    assert.equal(data.band, 'cost');
    assert.equal(me.pools.sp.now, 14 - 2 - 2);
    assert.equal(me.wounds, 0);
    assert.equal(data.paid, 'skill');
});

test('success at a cost always costs: a wound stage with a hit; with no hit, foes or not, the skill again, else a step of stamina', () => {
    const struck = roll(13, 'ordinary', { threat: 2, labels: { hit: 'a spear' } });
    assert.deepEqual([struck.data.band, struck.me.wounds, struck.me.pools.sp.now, struck.data.paid], ['cost', 1, 14, 'wound']);
    const unstruck = roll(13, 'ordinary', { threat: 2 });
    assert.deepEqual([unstruck.data.band, unstruck.me.wounds, unstruck.me.pools.sp.now, unstruck.data.paid], ['cost', 0, 14 - 4, 'stamina']);
    const again = roll(13, 'ordinary', { threat: 2, what: 'Obscure' });
    assert.deepEqual([again.data.band, again.me.wounds, again.me.pools.sp.now, again.data.paid], ['cost', 0, 14 - 2 - 2, 'skill']);
    const stat = roll(13, 'ordinary', { what: 'int' });
    assert.deepEqual([stat.data.band, stat.me.wounds, stat.me.pools.sp.now, stat.data.paid], ['cost', 0, 14 - 4, 'stamina'], 'a stat try has no skill cost: a step is a quarter of the pool');
    const free = roll(13, 'ordinary');
    assert.deepEqual([free.me.pools.sp.now, free.data.paid], [14 - 4, 'stamina'], 'a skill with no cost of its own');
    const short = astra();
    short.pools.sp.now = 3;
    const dry = roll(13, 'ordinary', { member: short, what: 'Obscure' });
    assert.deepEqual([dry.data.band, dry.me.pools.sp.now, dry.data.paid], ['cost', 0, 'stamina'], 'cannot pay the skill again: the step, clamped at 0');
    const rorke = astra({ id: 'ac_rorke001', name: 'Rorke', pc: false, companion: { level: 1, strengths: [] } });
    assert.equal(roll(15, 'ordinary', { member: rorke, what: 'riding' }).data.paid, 'none', 'a companion has no sheet to pay from');
    assert.equal(roll(15, 'ordinary', { member: rorke, what: 'riding', threat: 3, labels: { hit: 'a club' } }).data.paid, 'none', 'nor when struck');
});

test('a failure with a hit adds one wound stage; with no hit it costs nothing, foes or not, and an old danger: label is ignored', () => {
    const struck = roll(12, 'hard', { threat: 2, labels: { hit: 'a spear' } });
    assert.equal(struck.data.band, 'failure');
    assert.equal(struck.me.wounds, 1);
    assert.equal(roll(12, 'hard', { threat: 2 }).me.wounds, 0);
    assert.equal(roll(12, 'hard').me.wounds, 0);
    assert.equal(roll(12, 'hard', { labels: { danger: 'yes' } }).me.wounds, 0);
});

test('a line adds at most the stages left to Badly wounded: never past it from one line, and Down is not reached by a roll', () => {
    const hurt = astra({ wounds: 3 });
    const labels = { hit: 'a spear' };
    assert.equal(roll(1, 'ordinary', { member: hurt, labels }).me.wounds, 4, 'a bad failure from Wounded stops at Badly wounded');
    assert.equal(roll(1, 'ordinary', { member: astra({ wounds: 4 }), labels }).me.wounds, 4);
    assert.equal(roll(6, 'ordinary', { member: astra({ wounds: 4 }), threat: 3, labels }).me.wounds, 4);
});

test('the threat is the standing foes\', else this reply\'s earlier one, else the latest earlier reply\'s (for practice), else none; none of them wounds', () => {
    const slice = sliceOf([astra()], { list: [12, 12, 12], floor: 0 });
    const ctx = fakeCtx(slice);
    const me = slice.members.ac_astra001;
    // No earlier reply: no threat, a plain failure teaches 3 and costs nothing.
    run(applyTry, ctx, line('try', 'Astra', 'Lore; hard'));
    assert.deepEqual([me.wounds, me.practice.lore, slice.dice[SID].threat], [0, 3, undefined]);
    // An earlier reply recorded far above: practice doubles (and this reply records nothing of its own), with no wound.
    const later = sliceOf([astra()], null);
    later.dice.sw_before001 = { list: [1, 1, 1], floor: 0, threat: 4 };
    later.dice[SID] = { list: [12, 12, 12], floor: 0 };
    run(applyTry, fakeCtx(later), line('try', 'Astra', 'Lore; hard'));
    assert.deepEqual([later.members.ac_astra001.wounds, later.members.ac_astra001.practice.lore, later.dice[SID].threat], [0, 6, undefined]);
    // Foes standing set it, over the earlier reply's, and start the difficulty.
    const same = sliceOf([astra()], null);
    same.dice.sw_before001 = { list: [1, 1, 1], floor: 0, threat: 4 };
    same.dice[SID] = { list: [12, 12, 12], floor: 0 };
    withFoes(same, [['Foes', 3, 1]]);
    const both = fakeCtx(same);
    run(applyTry, both, line('try', 'Astra', 'Lore; hard'));
    const second = run(applyTry, both, line('try', 'Astra', 'Lore; hard'));
    assert.deepEqual([same.members.ac_astra001.wounds, same.dice[SID].used, second.result.data.difficulty], [0, 2, 1]);
    // A record after this reply's own (a Re-read of an earlier reply) is not an earlier reply's.
    const reread = sliceOf([astra()], { list: [12, 12, 12], floor: 0 });
    reread.dice.sw_after0001 = { list: [1, 1, 1], floor: 0, threat: 4 };
    run(applyTry, fakeCtx(reread), line('try', 'Astra', 'Lore; hard'));
    assert.deepEqual([reread.members.ac_astra001.wounds, reread.members.ac_astra001.practice.lore], [0, 3]);
});

test('the threat of the foes standing starts the difficulty: far beneath trivial, beneath easy, a fair match ordinary, above hard, far above very hard, beyond near impossible', () => {
    const got = [0, 1, 2, 3, 4, 5].map(threat => roll(12, 'near impossible', { threat }).data.difficulty);
    assert.deepEqual(got, [0, 1, 2, 3, 4, 5], 'the narrator\'s word does not count when foes stand');
});

test('a threat: on the line is ignored: the narrator\'s word stands with no foes, and the foes\' threat with some', () => {
    assert.deepEqual(['far beneath you', 'beneath', 'a fair match', 'above you', 'beyond you'].map(threat => roll(12, 'hard', { labels: { threat } }).data.difficulty), [3, 3, 3, 3, 3]);
    assert.equal(roll(12, 'hard', { labels: { threat: 'beyond you' } }).me.wounds, 0, 'and it wounds no one');
    assert.equal(roll(12, 'hard', { threat: 1, labels: { threat: 'beyond you' } }).data.difficulty, 1);
});

test('with no threat named the narrator\'s word is the start, and normal is ordinary', () => {
    assert.deepEqual(['trivial', 'easy', 'normal', 'ordinary', 'hard', 'very hard', 'near impossible'].map(word => roll(12, word).data.difficulty), [0, 1, 2, 2, 3, 4, 5]);
});

test('an edge moves the difficulty at most two steps either way; with no reason it is ignored and quietly noted', () => {
    const edge = value => roll(12, 'ordinary', { labels: { edge: value } });
    assert.equal(edge('+1 (the guard sleeps)').data.difficulty, 1);
    assert.equal(edge('-1 (a bad light)').data.difficulty, 3);
    assert.equal(edge('+9 (a perfect plan)').data.difficulty, 0, 'two steps at most');
    assert.equal(edge('-5 (a collapsing floor)').data.difficulty, 4);
    assert.deepEqual([edge('+1 (the guard sleeps)').data.edge, edge('+1 (the guard sleeps)').data.edgeWhy], [1, 'the guard sleeps']);
    assert.match(edge('+1 (the guard sleeps)').done.result.summary, /edge \+1 \(the guard sleeps\)/);
    const none = edge('+2');
    assert.deepEqual([none.data.difficulty, none.data.edge, none.data.edgeIgnored], [2, 0, true]);
    assert.match(none.done.result.summary, /edge ignored: no reason given/);
    assert.equal(edge('lots').data.difficulty, 2);
    assert.equal(roll(12, 'ordinary').data.edge, undefined, 'no edge, nothing noted');
    const threatened = roll(12, 'trivial', { threat: 3, labels: { edge: '+1 (cover)' } });
    assert.equal(threatened.data.difficulty, 2, 'the edge moves the threat\'s start');
    assert.equal(roll(12, 'trivial', { labels: { edge: '+2 (cover)' } }).data.difficulty, 0, 'never below trivial');
    assert.equal(roll(12, 'near impossible', { labels: { edge: '-2 (cover)' } }).data.difficulty, 5, 'never above near impossible');
    const floored = roll(12, 'ordinary', { labels: { edge: '+2 (cover)' }, member: astra({ conditions: [{ name: 'poisoned', until: 'treated' }] }) });
    assert.equal(floored.data.difficulty, 2, 'a condition\'s floor holds against an edge');
});

test('the roll is d20 + rank × 2: a stat try +0, a skill not on the sheet -3, and no practice or cost for it', () => {
    assert.equal(roll(15, 'ordinary', { what: 'str' }).data.bonus, 0);
    assert.deepEqual([0, 40, 100, 180, 280, 420, 600].map(practice => roll(15, 'ordinary', { member: trained(practice) }).data.bonus), [0, 2, 4, 6, 8, 10, 12], 'Novice 0, Apprentice 2 … Legend 12');
    const unlearned = roll(18, 'ordinary', { what: 'Juggling' });
    assert.deepEqual([unlearned.data.bonus, unlearned.data.total, unlearned.data.band, unlearned.data.unlearned, unlearned.data.practice], [-3, 15, 'success', true, 0]);
    assert.deepEqual([unlearned.me.pools.sp.now, unlearned.me.practice.juggling], [14, undefined]);
    assert.equal(roll(14, 'ordinary', { what: 'Juggling' }).data.band, 'failure', '15 needs 18 on the die');
    assert.equal(roll(18, 'ordinary').data.unlearned, undefined);
});

test('a natural 20 or 1 changes only the quality: a natural 20 that misses is a miss, a natural 1 that succeeds is a success', () => {
    const miss = roll(20, 'very hard');
    assert.deepEqual([miss.data.band, miss.data.quality, miss.data.total], ['failure', 'well done', 20]);
    assert.match(miss.done.result.summary, /failure \(well done\)/);
    assert.deepEqual([roll(20, 'near impossible').data.band, roll(20, 'near impossible').data.quality], ['bad', 'well done']);
    const lucky = roll(1, 'trivial', { member: trained(600) });
    assert.deepEqual([lucky.data.band, lucky.data.quality, lucky.me.wounds], ['success', 'clumsy', 0]);
    assert.match(lucky.done.result.summary, /success \(clumsy\)/);
    const clumsy = roll(1, 'ordinary', { labels: { hit: 'a fall' } });
    assert.deepEqual([clumsy.data.band, clumsy.data.quality, clumsy.me.wounds], ['bad', 'clumsy', 2], 'a natural 1 that misses is a bad failure by the margin');
    assert.equal(roll(20, 'ordinary').data.band, 'success');
    assert.equal(roll(10, 'ordinary').data.quality, undefined);
});

test('a miss by 10 or more is a bad failure; with a hit it costs two stages even with no foes, without one none', () => {
    const struck = roll(5, 'ordinary', { labels: { hit: 'a fall' } });
    assert.deepEqual([struck.data.band, struck.me.wounds], ['bad', 2]);
    assert.deepEqual([roll(5, 'ordinary').data.band, roll(5, 'ordinary').me.wounds], ['bad', 0]);
    assert.deepEqual([roll(6, 'ordinary').data.band, roll(6, 'ordinary').me.wounds], ['failure', 0]);
});

test('the recorded floor raises a difficulty the narrator named too low, and the line says so', () => {
    const { data, done } = roll(12, 'easy', { live: { list: [12, 10, 10], floor: 3 } });
    assert.equal(data.raised, true);
    assert.equal(data.difficulty, 3);
    assert.equal(data.band, 'failure');
    assert.match(done.result.summary, /raised/);
});

test('a condition raises the floor to ordinary; fatigue does the same for a physical roll only', () => {
    const sick = astra({ conditions: [{ name: 'poisoned', until: 'treated' }] });
    assert.equal(roll(11, 'easy', { member: sick }).data.difficulty, 2);
    const tired = astra();
    tired.pools.sp.now = 2;
    assert.equal(roll(11, 'easy', { member: tired, what: 'str' }).data.difficulty, 2);
    assert.equal(roll(11, 'easy', { member: tired, what: 'int' }).data.difficulty, 1);
});

test('under a threat each live condition and a drained body add a step on top of the threat\'s start; with only the narrator\'s word they are a floor', () => {
    const sick = astra({ conditions: [{ name: 'poisoned', until: 'treated' }] });
    const with2 = astra({ conditions: [{ name: 'poisoned', until: 'treated' }, { name: 'stunned', until: 'treated' }] });
    const tired = astra();
    tired.pools.sp.now = 2;
    const under = (member, threat, what = 'Lore', word = 'trivial') => roll(12, word, { member, what, threat }).data.difficulty;
    assert.equal(under(astra(), 3), 3);
    assert.equal(under(sick, 3), 4, 'above you + a condition: very hard');
    assert.equal(under(with2, 3), 5, 'two conditions');
    assert.equal(under(sick, 0), 2, 'far beneath + a condition: the floor, ordinary');
    assert.equal(under(sick, 2), 3, 'a fair match + a condition: hard');
    assert.equal(under(tired, 3, 'str'), 4, 'a drained body on a physical roll');
    assert.equal(under(tired, 3, 'int'), 3, 'not on a mental one');
    assert.equal(under(sick, 5), 5, 'held at near impossible');
    assert.equal(roll(12, 'hard', { member: sick }).data.difficulty, 3, 'the word hard + a condition: still hard (a floor, as before)');
    assert.equal(roll(12, 'easy', { member: sick }).data.difficulty, 2, 'the word easy + a condition: raised to ordinary');
    const edged = roll(12, 'hard', { member: sick, threat: 3, labels: { edge: '+1 (cover)' } }).data;
    assert.equal(edged.difficulty, 3, 'the edge eases the start, the condition adds its step: 3 − 1 + 1');
    assert.equal(edged.raised, true);
    assert.deepEqual(edged.why, ['poisoned']);
});

test('an injury that hampers the stat takes 2 from the bonus', () => {
    const hurt = astra({ injuries: [{ name: 'cracked rib', hampers: ['agi'], heals: 9999, grave: 'minor' }] });
    assert.equal(roll(12, 'ordinary', { member: hurt, what: 'Obscure' }).data.bonus, -2);
    assert.equal(roll(12, 'ordinary', { member: hurt, what: 'Lore' }).data.bonus, 0);
    assert.equal(roll(12, 'ordinary', { member: hurt, what: 'agi' }).data.bonus, -2, 'a stat try too');
});

const boots = bonus => ({ query: name => (name === 'gear.view' ? { slots: { feet: { name: 'Wolfhide Boots', rarity: bonus.rarity, bonus: bonus.text, broken: false } } } : null) });

test('gear is not in the roll: boots that raise AGI add nothing', () => {
    assert.equal(roll(12, 'ordinary', { what: 'agi', options: boots({ rarity: 'rare', text: '+2 AGI' }) }).data.bonus, 0);
    assert.equal(roll(12, 'ordinary', { what: 'Obscure', options: boots({ rarity: 'rare', text: '+9 AGI' }) }).data.bonus, 0);
});

test('the tone moves the difficulty: gritty one step harder, heroic one easier', () => {
    assert.equal(roll(11, 'ordinary', { options: { settings: { tone: 'gritty' } } }).data.difficulty, 3);
    assert.equal(roll(11, 'ordinary', { options: { settings: { tone: 'standard' } } }).data.difficulty, 2);
    assert.equal(roll(11, 'ordinary', { options: { settings: { tone: 'heroic' } } }).data.difficulty, 1);
    assert.equal(roll(11, 'near impossible', { options: { settings: { tone: 'gritty' } } }).data.difficulty, 5, 'held at near impossible');
    assert.equal(roll(11, 'trivial', { options: { settings: { tone: 'heroic' } } }).data.difficulty, 0);
});

test('a companion rolls +2 for a named strength, else +0 (no level), and takes no harm on the sheet', () => {
    const rorke = astra({ id: 'ac_rorke001', name: 'Rorke', pc: false, level: 12, companion: { level: 12, strengths: ['swordplay'] } });
    const { data, me } = roll(6, 'ordinary', { member: rorke, what: 'swordplay', threat: 3 });
    assert.equal(data.bonus, 2);
    assert.equal(me.wounds, 0);
    assert.equal(roll(6, 'ordinary', { member: rorke, what: 'riding' }).data.bonus, 0);
});

test('a refusal changes nothing: no mana for the skill, a Down character, no dice, all dice used', () => {
    const dry = astra();
    dry.pools.sp.now = 1;
    const noSp = roll(11, 'ordinary', { member: dry, what: 'Obscure' });
    assert.deepEqual([noSp.done.code, noSp.slice.dice[SID].used], ['NOT_ENOUGH', undefined]);
    assert.match(noSp.done.message, /no stamina for Obscure/);
    const down = astra();
    down.down = true;
    assert.equal(roll(11, 'ordinary', { member: down }).done.code, 'REFUSED');
    assert.equal(roll(11, 'ordinary', { live: null }).done.code, 'REFUSED');
    assert.equal(roll(11, 'ordinary', { live: { list: [1, 2, 3], floor: 0, used: 3 } }).done.code, 'LIMITED');
});

test('dice are taken in order, one per roll', () => {
    const slice = sliceOf([astra()], { list: [11, 3, 20], floor: 0 });
    const ctx = fakeCtx(slice);
    const dice = ['Lore', 'Lore', 'Lore'].map(what => run(applyTry, ctx, line('try', 'Astra', `${what}; ordinary`)).result.data.die);
    assert.deepEqual(dice, [11, 3, 20]);
});

test('off means off: Text RPG not on, or the RPG on, refuses quietly with FEATURE_OFF', () => {
    assert.equal(roll(11, 'ordinary', { options: { on: false } }).done.code, 'FEATURE_OFF');
    assert.equal(roll(11, 'ordinary', { options: { rpg: true } }).done.code, 'FEATURE_OFF');
});

const step = (index, list, floor = 0) => ({ index, receipt: { type: 'textRpg.dice', data: { list, floor } } });

test('the first roll of a reply makes its record from the dice step: its own receipt on a Re-read, else the latest before it', () => {
    const fresh = () => sliceOf([astra()], null);
    const first = fakeCtx(fresh(), { receipts: [step(0, [3, 4, 5]), step(1, [11, 12, 13], 1)] });
    const done = run(applyTry, first, line('try', 'Astra', 'Lore; ordinary'));
    assert.deepEqual([done.result.data.die, done.result.data.difficulty], [11, 2]);
    const slice = fresh();
    const again = run(applyTry, fakeCtx(slice, { receipts: [step(0, [3, 4, 5])], standingReceipts: [{ type: 'textRpg.dice', data: { list: [15, 2, 3], floor: 0, own: true } }] }), line('try', 'Astra', 'Lore; ordinary'));
    assert.equal(again.result.data.die, 15, 'a Re-read uses the swipe\'s own dice step the reply holds');
    assert.deepEqual(slice.dice[SID], { list: [15, 2, 3], floor: 0, used: 1, hardest: 2, won: true });
    assert.equal(run(applyTry, fakeCtx(fresh(), { receipts: [{ index: 0, receipt: { type: 'textRpg.dice', data: { list: [1, 2], floor: 0 } } }] }), line('try', 'Astra', 'Lore; ordinary')).code, 'REFUSED', 'a damaged record is no dice');
});

test('the dice step a reply reads is the one before it: a later reply\'s step on its carrier and an earlier swipe\'s own are not its dice', () => {
    const at = (index, list, own = false) => ({ index, receipt: { type: 'textRpg.dice', data: { list, floor: 0, own } } });
    // Reply 2 follows carrier 0 (its step); reply 4's step sits on carrier 2; reply 2 was swiped (own step on carrier 2, before reply 4's).
    const chat = [at(0, [1, 1, 1]), at(2, [2, 2, 2], true), at(2, [4, 4, 4])];
    assert.deepEqual(diceBefore(2, chat).list, [2, 2, 2], 'its own swipe step wins over the next reply\'s');
    assert.deepEqual(diceBefore(2, [at(0, [1, 1, 1]), at(2, [4, 4, 4])]).list, [1, 1, 1], 'a normal send: the step on the carrier before');
    assert.deepEqual(diceBefore(4, [at(0, [1, 1, 1]), at(2, [2, 2, 2], true), at(2, [4, 4, 4])]).list, [4, 4, 4], 'reply 4 reads the step on carrier 2 that is not an own step');
    assert.equal(diceBefore(2, [at(2, [4, 4, 4])]), null, 'no step before it: no dice');
    assert.deepEqual(lastDice(chat).list, [4, 4, 4], 'the next reply is offered the latest');
});

test('the difficulty word is found among extra parts: `? try Who | skill | what is tried | hard`', () => {
    const slice = sliceOf([astra()], { list: [11, 10, 10], floor: 0 });
    const done = run(applyTry, fakeCtx(slice), line('try', 'Astra', 'Lore; slip past the guards; hard'));
    assert.equal(done.result.data.difficulty, 3);
});

test('the receipt names the difficulty word actually rolled against, after the tone step', () => {
    const gritty = roll(11, 'ordinary', { options: { settings: { tone: 'gritty' } } });
    assert.match(gritty.done.result.summary, /, hard: /);
    assert.equal(gritty.data.difficulty, 3);
    assert.match(roll(11, 'ordinary', { options: { settings: { tone: 'standard' } } }).done.result.summary, /, ordinary: /);
    assert.match(roll(11, 'ordinary', { options: { settings: { tone: 'heroic' } } }).done.result.summary, /, easy: /);
});

test('an edge in the roller\'s favour does not cost practice: an easy roll made trivial by +1 still teaches as easy (+5 a success, 3 a failure)', () => {
    const made = roll(15, 'easy', { labels: { edge: '+1 (the guard sleeps)' } });
    assert.equal(made.data.difficulty, 0, 'the edge made it trivial');
    assert.equal(made.me.practice.lore, 5, 'practice is judged at easy: +5 for a success');
    assert.equal(made.data.practice, 5);
    assert.equal(roll(2, 'easy', { labels: { edge: '+1 (the guard sleeps)' } }).me.practice.lore, 3, 'a failure at easy: 3');
    assert.equal(roll(15, 'trivial').me.practice.lore, 1, 'trivial with no edge is a plain use');
});

test('an edge against the roller teaches at the harder difficulty actually rolled', () => {
    const made = roll(20, 'ordinary', { labels: { edge: '-1 (a bad light)' } });
    assert.equal(made.data.difficulty, 3);
    assert.equal(made.me.practice.lore, 10, 'hard: +10 for a success');
});

test('practice is the difficulty the roll would have had with no edge: a trivial task stays trivial, a floor is not counted twice, an ignored edge changes nothing', () => {
    const trivial = roll(20, 'trivial', { labels: { edge: '+1 (cover)' } });
    assert.deepEqual([trivial.data.difficulty, trivial.me.practice.lore], [0, 1], 'trivial with an edge teaches as trivial: 1');
    const held = roll(20, 'ordinary', { labels: { edge: '+2 (cover)' }, member: astra({ conditions: [{ name: 'poisoned', until: 'treated' }] }) });
    assert.deepEqual([held.data.difficulty, held.me.practice.lore], [2, 5], 'the floor held it at ordinary: +5, not hard\'s +10');
    const noReason = roll(20, 'trivial', { labels: { edge: '+2' } });
    assert.deepEqual([noReason.data.edgeIgnored, noReason.me.practice.lore], [true, 1]);
});

test('a use far beneath the threat still teaches 1', () => {
    const { me } = roll(15, 'ordinary', { threat: 3, live: { list: [15, 10, 10], floor: 0, threat: 0 } });
    assert.ok(me.practice.lore >= 1);
    const slice = sliceOf([astra()], { list: [15, 10, 10], floor: 0, threat: 0 });
    const done = run(applyTry, fakeCtx(slice), line('try', 'Astra', 'Lore; ordinary'));
    assert.equal(done.result.data.practice, 1, 'the threat is far beneath (×0): 1, not 0');
});
