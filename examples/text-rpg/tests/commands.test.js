import test from 'node:test';
import assert from 'node:assert/strict';
import { memberNamed } from '../src/module-parts/members.js';
import { create } from '../src/module-parts/commands/create.js';
import { spend, skillEdit } from '../src/module-parts/commands/spend.js';
import { rest } from '../src/module-parts/commands/rest.js';
import { dice } from '../src/module-parts/commands/dice.js';
import { validate } from '../src/domain/validate.js';
import { drawDice } from '../src/dice/record.js';
import { levelOf, pointsOf } from '../src/module-parts/standing.js';
import { astra, fakeCtx, run, sliceOf } from './helpers/fake-ctx.js';

const BUY = { STR: 9, vit: 9, agi: 9, dex: 9, int: 8, wis: 8, cha: 8 };

test('textRpg.create: a point-buy character who is the reader, with up to five skills', () => {
    const slice = sliceOf([], null);
    const done = run(create, fakeCtx(slice), { name: ' Astra  Vale ', stats: BUY, skills: [{ name: 'Obscure', stat: 'AGI', about: 'shadow', cost: { pool: 'sp', n: 2 } }] });
    const me = slice.members[done.result.data.member];
    assert.deepEqual([me.name, me.pc, levelOf(me), me.stats.str, me.wounds, me.skills[0].stat], ['Astra Vale', true, 1, 9, 0, 'agi']);
    assert.deepEqual(validate(slice), []);
});

test('textRpg.create refuses a bad buy: out of range, wrong total, six skills, no name, a second character', () => {
    const refuse = (payload, slice = sliceOf([], null)) => run(create, fakeCtx(slice), payload).code;
    assert.equal(refuse({ name: 'A', stats: { ...BUY, str: 16, cha: 1 } }), 'INVALID');
    assert.equal(refuse({ name: 'A', stats: { ...BUY, str: 10 } }), 'INVALID');
    assert.equal(refuse({ name: 'A', stats: BUY, skills: Array.from({ length: 6 }, (_, at) => ({ name: `S${at}`, stat: 'str' })) }), 'INVALID');
    assert.equal(refuse({ name: ' ', stats: BUY }), 'INVALID');
    assert.equal(refuse({ name: 'B', stats: BUY }, sliceOf()), 'INVALID', 'while the reader\'s character lives');
    assert.equal(run(create, fakeCtx(sliceOf([], null), { on: false }), { name: 'A', stats: BUY }).code, 'FEATURE_OFF');
});

test('textRpg.create when the reader\'s character has fallen: the new one is the reader\'s, the fallen keeps pc false, and the same name finds the living one', () => {
    const fallen = astra({ fallen: { how: 'cut down' } });
    const slice = sliceOf([fallen], null);
    const done = run(create, fakeCtx(slice), { name: 'Astra', stats: BUY });
    assert.equal(done.ok, true);
    const made = slice.members[done.result.data.member];
    assert.deepEqual([made.pc, fallen.pc, Object.values(slice.members).filter(member => member.pc).length], [true, false, 1]);
    assert.equal(memberNamed(slice, 'astra').id, made.id, 'a name finds the living character first');
    assert.deepEqual(validate(slice), []);
    assert.equal(run(create, fakeCtx(slice), { name: 'Third', stats: BUY }).code, 'INVALID', 'a living reader\'s character again refuses');
});

test('textRpg.spend takes stat points as the Party tab sends them and grows the pools', () => {
    const slice = sliceOf([astra({ xp: 150 })]);
    const me = slice.members.ac_astra001;
    assert.equal(pointsOf(me), 2, 'level 3 has earned two');
    const done = run(spend, fakeCtx(slice), { member: 'ac_astra001', stats: { STR: 1, INT: 1 } });
    assert.equal(done.ok, true);
    assert.deepEqual([me.stats.str, me.stats.int, pointsOf(me), me.spent, me.pools.mp.max, me.pools.mp.now], [13, 13, 0, 2, 35, 35]);
    assert.deepEqual(validate(slice), []);
    const tired = sliceOf([astra({ xp: 50 })]);
    tired.members.ac_astra001.pools.sp.now = 20;
    run(spend, fakeCtx(tired), { member: 'Astra', stats: { dex: 1 } });
    assert.equal(tired.members.ac_astra001.pools.sp.now, 21, 'a bigger pool is bigger by the same points, never refilled');
});

test('textRpg.spend refuses more than the member has, a stat past 30, nothing and a stranger', () => {
    const refuse = (payload, member = astra({ xp: 150 })) => run(spend, fakeCtx(sliceOf([member])), payload).code;
    assert.equal(refuse({ member: 'Astra', stats: { str: 3 } }), 'NOT_ENOUGH');
    assert.equal(refuse({ member: 'Astra', stats: { str: 0 } }), 'INVALID');
    assert.equal(refuse({ member: 'Astra', stats: { luck: 1 } }), 'INVALID');
    assert.equal(refuse({ member: 'Zed', stats: { str: 1 } }), 'NOT_FOUND');
    const top = astra({ xp: 150 });
    top.stats.str = 30;
    assert.equal(refuse({ member: 'Astra', stats: { str: 1 } }, top), 'INVALID');
});

test('textRpg.skillEdit edits, adds into a free slot and removes, keeping practice', () => {
    const slice = sliceOf();
    const me = slice.members.ac_astra001;
    me.practice.lore = 150;
    const ctx = fakeCtx(slice);
    run(skillEdit, ctx, { member: 'Astra', name: 'lore', about: 'forgotten kings', stat: 'WIS', cost: { pool: 'mp', n: 1 } });
    assert.deepEqual(me.skills[1], { name: 'Lore', about: 'forgotten kings', stat: 'wis', type: 'utility', cost: { pool: 'mp', n: 1 } });
    assert.equal(me.practice.lore, 150);
    run(skillEdit, ctx, { member: 'Astra', name: 'Knots', stat: 'dex', type: 'craft' });
    assert.equal(me.skills.length, 3);
    assert.equal(run(skillEdit, ctx, { member: 'Astra', name: 'Nameless' }).code, 'INVALID', 'a new skill needs a stat');
    run(skillEdit, ctx, { member: 'Astra', name: 'Knots', remove: true });
    assert.deepEqual(me.skills.map(skill => skill.name), ['Obscure', 'Lore']);
    assert.equal(run(skillEdit, ctx, { member: 'Astra', name: 'Knots', remove: true }).code, 'NOT_FOUND');
});

test('textRpg.rest: a short rest fills mana and stamina; a day also heals one stage and ages injuries', () => {
    const hurt = astra({ wounds: 3, injuries: [{ name: 'rib', hampers: ['str'], heals: 1400, grave: 'minor' }, { name: 'leg', hampers: ['agi'], heals: 9000, grave: 'serious' }] });
    const slice = sliceOf([hurt]);
    hurt.pools.mp.now = 3;
    hurt.pools.sp.now = 3;
    run(rest, fakeCtx(slice, { time: 0 }), { kind: 'short' });
    assert.deepEqual([hurt.wounds, hurt.pools.mp.now, hurt.pools.sp.now], [3, 34, 34]);
    run(rest, fakeCtx(slice, { time: 0 }), { kind: 'day' });
    assert.equal(hurt.wounds, 2);
    assert.deepEqual(hurt.injuries.map(item => [item.name, item.heals]), [['leg', 7560]]);
    assert.equal(run(rest, fakeCtx(slice), { kind: 'nap' }).code, 'INVALID');
    assert.equal(run(rest, fakeCtx(slice), { kind: 'short', member: 'Zed' }).code, 'NOT_FOUND');
});

test('textRpg.rest: an injury with no end time keeps without a clock, and a day with one starts its count; a wound stage never goes below Unhurt', () => {
    const hurt = astra({ injuries: [{ name: 'rib', hampers: ['str'], heals: null, grave: 'minor' }] });
    const slice = sliceOf([hurt]);
    run(rest, fakeCtx(slice), { kind: 'day' });
    assert.deepEqual([hurt.injuries.length, hurt.injuries[0].heals, hurt.wounds], [1, null, 0]);
    run(rest, fakeCtx(slice, { time: 5000 }), { kind: 'day' });
    assert.deepEqual(hurt.injuries.map(item => item.heals), [5000 + 3 * 1440 - 1440]);
});

test('textRpg.dice is the system\'s: three dice from the seed, the floor kept in the receipt data, a swipe draws anew, never by an action', () => {
    const slice = sliceOf([astra()], null);
    const draw = random => run(dice, fakeCtx(slice, { cause: 'system', random }), { floor: 2 });
    const first = draw(0.1);
    assert.equal(first.ok, true);
    assert.equal(first.result.narrate, false);
    assert.equal(first.result.replan, undefined, 'a Re-read keeps what was drawn');
    assert.deepEqual(first.result.data, { ...drawDice(Math.floor(0.1 * 4294967296) >>> 0, 2), own: false });
    assert.equal(run(dice, fakeCtx(slice, { cause: 'system' }), { floor: 0, own: true }).result.data.own, true);
    assert.notDeepEqual(draw(0.7).result.data.list, first.result.data.list);
    assert.deepEqual(slice.dice, {}, 'the domain is not written');
    assert.equal(run(dice, fakeCtx(slice, { cause: 'ui' }), {}).code, 'REFUSED');
    assert.equal(run(dice, fakeCtx(slice, { cause: 'system', caller: 'other' }), {}).code, 'REFUSED');
    assert.equal(run(dice, fakeCtx(slice, { cause: 'system', on: false }), {}).code, 'FEATURE_OFF');
});

test('the dice record keeps the optional used, hardest and threat, and refuses bad ones', () => {
    const slice = sliceOf([astra()], { list: [1, 2, 3], floor: 0, used: 1, hardest: 3, threat: 5 });
    assert.deepEqual(validate(slice), []);
    for (const bad of [{ used: 4 }, { hardest: 5 }, { threat: 6 }, { extra: 1 }]) {
        assert.ok(validate(sliceOf([astra()], { list: [1, 2, 3], floor: 0, ...bad })).length > 0, JSON.stringify(bad));
    }
});
