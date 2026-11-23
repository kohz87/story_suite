import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMAIN, LIMITS, initialState, newMember } from '../src/domain/shape.js';
import { validate } from '../src/domain/validate.js';
import { memberId } from '../src/domain/member-id.js';

const skill = (over = {}) => ({
    name: 'Obscure',
    about: 'melts into shadow',
    stat: 'agi',
    type: 'magic',
    cost: { pool: 'mp', n: 2 },
    ...over,
});

const astra = () => newMember({
    id: 'astra',
    name: 'Astra',
    pc: true,
    stats: { str: 12, vit: 8, agi: 14, dex: 10, int: 13, wis: 9, cha: 11 },
    skills: [skill()],
});

function one(member = astra(), dice = {}) {
    return { v: 1, members: { [member.id]: member }, dice };
}

function damaged(change) {
    const member = astra();
    const slice = one(member);
    change(slice, member);
    return validate(slice);
}

function hasPath(problems, path) {
    return problems.some(problem => problem.includes(path));
}

function expectPath(change, path) {
    const problems = damaged(change);
    assert.ok(problems.length > 0, `expected a problem for ${path}`);
    assert.ok(hasPath(problems, path), `expected ${path} in:\n${problems.join('\n')}`);
}

test('the public constants and initial state match the frozen contract', () => {
    assert.equal(DOMAIN, 'textRpg');
    assert.deepEqual(LIMITS, {
        members: 6,
        skills: 12,
        injuries: 3,
        conditions: 4,
        name: 60,
        about: 160,
        strengths: 3,
        statMin: 1,
        statMax: 30,
        levelMax: 99,
        practiceMax: 600,
        diceReplies: 200,
    });
    assert.equal(Object.isFrozen(LIMITS), true);
    assert.deepEqual(initialState(), { v: 1, members: {}, dice: {} });
    assert.notEqual(initialState().members, initialState().members);
    assert.deepEqual(validate(initialState()), []);
});

test('a new member fills every field, clamps stats and derives its pools', () => {
    const member = newMember({
        id: 'astra',
        name: 'Astra',
        pc: true,
        stats: { str: 0, vit: 8, agi: 31, dex: 10, int: 'bad', wis: 9 },
        skills: [skill(), { ...skill(), name: 'Ash Staff', type: 'attack', stat: 'str', cost: null }],
    });
    assert.deepEqual(
        { id: member.id, name: member.name, pc: member.pc, xp: member.xp, spent: member.spent, wounds: member.wounds },
        { id: 'astra', name: 'Astra', pc: true, xp: 0, spent: 0, wounds: 0 },
    );
    assert.equal(Object.hasOwn(member, 'level') || Object.hasOwn(member, 'points'), false, 'level and points are derived, never stored');
    assert.deepEqual(member.stats, { str: 1, vit: 8, agi: 30, dex: 10, int: 5, wis: 9, cha: 5 });
    assert.deepEqual(member.pools, {
        mp: { now: 24, max: 24 },
        sp: { now: 50, max: 50 },
    });
    assert.deepEqual(member.skills[0], skill());
    assert.deepEqual(member.skills[1], {
        name: 'Ash Staff', about: 'melts into shadow', stat: 'str', type: 'attack', cost: null,
    });
    assert.deepEqual(member.injuries, []);
    assert.deepEqual(member.conditions, []);
    assert.equal(member.companion, null);
    assert.equal(member.fallen, null);
    assert.deepEqual(validate(one(member)), []);
});

test('a wound count a replay pushed past 0..5, and an injury with no end time yet, are valid: every read clamps', () => {
    const member = newMember({ id: 'astra', name: 'Astra' });
    member.wounds = -2;
    member.injuries = [{ name: 'rib', hampers: [], heals: null, grave: 'minor' }];
    assert.deepEqual(validate(one(member)), []);
    member.wounds = 7;
    assert.deepEqual(validate(one(member)), []);
});

test('new member is safe without input and keeps only five usable starting skills', () => {
    const blank = newMember();
    assert.equal(blank.id, 'member');
    assert.equal(blank.name, '');
    assert.equal(blank.pc, false);
    assert.deepEqual(blank.stats, { str: 5, vit: 5, agi: 5, dex: 5, int: 5, wis: 5, cha: 5 });
    assert.deepEqual(validate(one(blank)), []);

    const fromName = newMember({ name: 'Edda Rorke', skills: [null, {}, 1, {}, {}, {}, {}, {}] });
    assert.equal(fromName.id, 'edda-rorke');
    assert.equal(fromName.skills.length, 5);
    assert.deepEqual(validate(one(fromName)), []);
});

test('validation names the path of every kind of damaged member field', () => {
    const cases = [
        ['version', slice => { slice.v = 2; }, 'slice.v'],
        ['unknown root key', slice => { slice.extra = true; }, 'slice.extra'],
        ['unknown member key', (slice, member) => { member.extra = true; }, 'members.astra.extra'],
        ['member id', (slice, member) => { member.id = 'Astra'; }, 'members.astra.id'],
        ['member id key', (slice, member) => { slice.members.edda = member; }, 'members.edda.id'],
        ['member name', (slice, member) => { member.name = 'x'.repeat(61); }, 'members.astra.name'],
        ['pc', (slice, member) => { member.pc = 'yes'; }, 'members.astra.pc'],
        ['xp', (slice, member) => { member.xp = -1; }, 'members.astra.xp'],
        ['spent', (slice, member) => { member.spent = 1.5; }, 'members.astra.spent'],
        ['wounds', (slice, member) => { member.wounds = 1.5; }, 'members.astra.wounds'],
        ['stat value', (slice, member) => { member.stats.agi = 31; }, 'members.astra.stats.agi'],
        ['unknown stat', (slice, member) => { member.stats.luck = 5; }, 'members.astra.stats.luck'],
        ['pool max', (slice, member) => { member.pools.mp.max += 1; }, 'members.astra.pools.mp.max'],
        ['pool now', (slice, member) => { member.pools.sp.now = -1; }, 'members.astra.pools.sp.now'],
        ['skill stat', (slice, member) => { member.skills[0].stat = 'luck'; }, 'members.astra.skills.0.stat'],
        ['skill type', (slice, member) => { member.skills[0].type = 'song'; }, 'members.astra.skills.0.type'],
        ['skill cost pool', (slice, member) => { member.skills[0].cost.pool = 'hp'; }, 'members.astra.skills.0.cost.pool'],
        ['skill practice', (slice, member) => { member.practice.obscure = 601; }, 'members.astra.practice.obscure'],
        ['injury name', (slice, member) => {
            member.injuries.push({ name: '', hampers: ['str'], heals: 3, grave: 'minor' });
            member.injuries[0].name = 7;
        }, 'members.astra.injuries.0.name'],
        ['injury hampers', (slice, member) => {
            member.injuries.push({ name: 'cracked rib', hampers: ['str', 'luck'], heals: 3, grave: 'minor' });
        }, 'members.astra.injuries.0.hampers'],
        ['injury heals', (slice, member) => {
            member.injuries.push({ name: 'cracked rib', hampers: ['str'], heals: -1, grave: 'minor' });
        }, 'members.astra.injuries.0.heals'],
        ['injury grave', (slice, member) => {
            member.injuries.push({ name: 'cracked rib', hampers: ['str'], heals: 3, grave: 'fatal' });
        }, 'members.astra.injuries.0.grave'],
        ['condition name', (slice, member) => {
            member.conditions.push({ name: 'x'.repeat(41), until: 'treated' });
        }, 'members.astra.conditions.0.name'],
        ['condition until', (slice, member) => {
            member.conditions.push({ name: 'poisoned', until: -1 });
        }, 'members.astra.conditions.0.until'],
        ['companion level', (slice, member) => { member.companion = { level: 100, strengths: [] }; }, 'members.astra.companion.level'],
        ['companion strengths', (slice, member) => {
            member.companion = { level: 3, strengths: ['a', 'b', 'c', 'd'] };
        }, 'members.astra.companion.strengths'],
        ['fallen how', (slice, member) => { member.fallen = { how: 'x'.repeat(161) }; }, 'members.astra.fallen.how'],
        ['dice floor', slice => { slice.dice.reply = { list: [1, 2, 3], floor: 5 }; }, 'dice.reply.floor'],
        ['dice list', slice => { slice.dice.reply = { list: [1, 2], floor: 1 }; }, 'dice.reply.list'],
        ['dice die', slice => { slice.dice.reply = { list: [1, 2, 21], floor: 1 }; }, 'dice.reply.list.2'],
        ['dice unknown', slice => { slice.dice.reply = { list: [1, 2, 3], floor: 1, extra: true }; }, 'dice.reply.extra'],
    ];
    for (const [label, change, path] of cases) {
        test(label, () => expectPath(change, path));
    }
});

test('unknown keys are rejected in every fixed record shape', () => {
    assert.ok(hasPath(damaged((slice, member) => { member.stats.extra = 1; }), 'members.astra.stats.extra'));
    assert.ok(hasPath(damaged((slice, member) => { member.pools.mp.extra = 1; }), 'members.astra.pools.mp.extra'));
    assert.ok(hasPath(damaged((slice, member) => { member.skills[0].extra = 1; }), 'members.astra.skills.0.extra'));
    assert.ok(hasPath(damaged((slice, member) => { member.skills[0].cost.extra = 1; }), 'members.astra.skills.0.cost.extra'));
    assert.ok(hasPath(damaged((slice, member) => {
        member.injuries.push({ name: 'cracked rib', hampers: ['str'], heals: 3, grave: 'minor', extra: 1 });
    }), 'members.astra.injuries.0.extra'));
    assert.ok(hasPath(damaged((slice, member) => {
        member.conditions.push({ name: 'poisoned', until: 'treated', extra: 1 });
    }), 'members.astra.conditions.0.extra'));
    assert.ok(hasPath(damaged((slice, member) => { member.companion = { level: 3, strengths: [], extra: 1 }; }), 'members.astra.companion.extra'));
    assert.ok(hasPath(damaged((slice, member) => { member.fallen = { how: 'fell', extra: 1 }; }), 'members.astra.fallen.extra'));
});

test('validation accepts the exact lower and upper bounds', () => {
    const member = newMember({
        id: 'bounds',
        name: 'x'.repeat(LIMITS.name),
        stats: { str: 1, vit: 1, agi: 30, dex: 30, int: 1, wis: 1, cha: 30 },
        skills: [
            skill({ name: 'x'.repeat(60), about: 'x'.repeat(160), }),
            skill({ name: 'free', cost: null }),
        ],
    });
    member.xp = 100000;
    member.wounds = 9;
    member.injuries = Array.from({ length: 3 }, () => ({
        name: 'x'.repeat(60), hampers: ['str', 'agi'], heals: 0, grave: 'grave',
    }));
    member.conditions = Array.from({ length: 4 }, () => ({ name: 'x'.repeat(40), until: 0 }));
    member.conditions[0].until = 'treated';
    member.companion = { level: 99, strengths: ['x'.repeat(40), 'b', 'c'] };
    member.fallen = null;
    const slice = one(member, { reply: { list: [1, 20, 10], floor: 4 } });
    assert.deepEqual(validate(slice), []);
});

test('validation enforces collection limits and one player character', () => {
    const manyMembers = initialState();
    for (let i = 0; i < 7; i += 1) {
        const member = newMember({ id: `m${i}`, name: `M${i}` });
        manyMembers.members[member.id] = member;
    }
    assert.ok(hasPath(validate(manyMembers), 'members'));

    const manySkills = astra();
    manySkills.skills = Array.from({ length: 13 }, (_, i) => skill({ name: `Skill ${i}` }));
    assert.ok(hasPath(validate(one(manySkills)), 'members.astra.skills'));

    const manyDice = astra();
    const dice = {};
    for (let i = 0; i <= LIMITS.diceReplies; i += 1) dice[`reply-${i}`] = { list: [1, 2, 3], floor: 0 };
    assert.ok(hasPath(validate(one(manyDice, dice)), 'dice'));

    const twoPlayers = astra();
    const other = newMember({ id: 'edda', name: 'Edda', pc: true });
    const slice = one(twoPlayers);
    slice.members[other.id] = other;
    assert.ok(hasPath(validate(slice), 'members'));
});

test('validation accepts the full dice limit and rejects bad reply keys and records', () => {
    const dice = {};
    for (let i = 0; i < LIMITS.diceReplies; i += 1) dice[`reply-${i}`] = { list: [20, 1, 10], floor: 0 };
    assert.deepEqual(validate(one(astra(), dice)), []);
    assert.ok(hasPath(validate(one(astra(), { ['x'.repeat(81)]: { list: [1, 1, 1], floor: 0 } })), 'dice.'));
    assert.ok(hasPath(validate(one(astra(), { reply: null })), 'dice.reply'));
});

test('validation is safe on bad input and reports non-object shapes', () => {
    for (const bad of [null, undefined, 1, 'x', true, []]) {
        assert.doesNotThrow(() => validate(bad));
        assert.ok(validate(bad).length > 0);
    }
    assert.ok(hasPath(validate({ v: 1, members: [], dice: {} }), 'members'));
    const missing = validate({ v: 1, members: {}, dice: {} });
    assert.deepEqual(missing, []);
    assert.ok(validate({}).length > 0);
});

test('member ids are readable, bounded and collision-safe', () => {
    assert.equal(memberId('Edda Rorke', new Set(['edda-rorke'])), 'edda-rorke-2');
    assert.equal(memberId('Edda Rorke', new Set(['edda-rorke', 'edda-rorke-2'])), 'edda-rorke-3');
    assert.equal(memberId('  The -- Ash  Witch!  '), 'the-ash-witch');
    assert.equal(memberId('Astra', { astra: true }), 'astra-2');
    assert.equal(memberId('Astra', Object.assign(Object.create(null), { astra: true })), 'astra-2');
    assert.equal(memberId('', new Set()), 'member');
    assert.equal(memberId('!!!'), 'member');
    assert.equal(memberId(null), 'member');
    assert.equal(memberId(42, 'not a collection'), 'member');
    const long = memberId('x'.repeat(80), new Set(['x'.repeat(40)]));
    assert.equal(long.length, 40);
    assert.match(long, /^[a-z0-9][a-z0-9-]{0,39}$/);
    assert.equal(long, `${'x'.repeat(38)}-2`);
});
