// Members saved before the limit of 8 skills, the xp held to 9999, and the bounds on a saved character's create and export.
import test from 'node:test';
import assert from 'node:assert/strict';
import { LIMITS } from '../src/domain/shape.js';
import { validate } from '../src/domain/validate.js';
import { create } from '../src/module-parts/commands/create.js';
import { exportFile } from '../src/module-parts/export.js';
import { skillSlots } from '../src/module-parts/members.js';
import { levelOf } from '../src/module-parts/standing.js';
import { parseCharacterFile } from '../src/wizard/charfile.js';
import { astra, fakeCtx, run, sliceOf } from './helpers/fake-ctx.js';

const BUY = { str: 7, vit: 6, agi: 7, dex: 7, int: 6, wis: 6, cha: 6 };
const skill = at => ({ name: `Old ${at}`, about: '', stat: 'str', type: 'attack', cost: null });

test('a member saved with 12 skills (and 40 practice keys) still validates, keeps them and has no free slot to learn more', () => {
    const old = astra({ xp: 5000 });
    old.skills = Array.from({ length: 12 }, (_, at) => skill(at));
    for (let at = 0; at < 40; at += 1) old.practice[`old ${at}`] = 10;
    assert.deepEqual(validate(sliceOf([old])), []);
    assert.ok(old.skills.length >= skillSlots(levelOf(old)), 'no slot is free: learn and skillEdit refuse');
    old.skills = Array.from({ length: LIMITS.skillsStored + 1 }, (_, at) => skill(at));
    assert.ok(validate(sliceOf([old])).some(problem => problem.includes('skills')), 'the old limit still holds');
});

test('create refuses a new character with 9 skills even though an old record may hold more', () => {
    const slice = sliceOf([], null);
    assert.equal(run(create, fakeCtx(slice), { name: 'A', level: 30, stats: { ...BUY, str: 7 }, skills: Array.from({ length: 9 }, (_, at) => skill(at)) }).ok, false);
});

test('textRpg.create with imported: true bounds the stats total: a 15-everything call is refused, a file\'s own total passes', () => {
    const all15 = Object.fromEntries(Object.keys(BUY).map(key => [key, 15]));
    const refuse = payload => run(create, fakeCtx(sliceOf([], null)), { name: 'A', imported: true, ...payload });
    assert.equal(refuse({ stats: all15 }).code, 'INVALID', 'no budget: what a level earns');
    assert.equal(refuse({ stats: all15, level: 3, budget: 50 }).code, 'INVALID');
    assert.equal(refuse({ stats: BUY, level: 3, budget: 50 }).ok, true, 'a total within the budget');
});

test('an import keeps the file\'s xp when it matches the level, and starts the level otherwise', () => {
    const make = payload => { const slice = sliceOf([], null); const done = run(create, fakeCtx(slice), { name: 'A', imported: true, level: 5, budget: 70, stats: BUY, ...payload }); return slice.members[done.result.data.member].xp; };
    assert.equal(make({ xp: 450 }), 450);
    assert.equal(make({ xp: 900 }), 400, 'level 9 xp for a level 5 file');
    assert.equal(make({}), 400);
});

test('export holds the points to the parsers\' 60 and says so; xp past 9999 is written as 9999', () => {
    const rich = astra({ xp: 8000 });
    const answer = exportFile({ domains: { textRpg: sliceOf([rich]) } }, { id: rich.id });
    assert.equal(answer.ok, true);
    assert.deepEqual([answer.points, answer.clamped], [60, true]);
    assert.equal(parseCharacterFile(answer.text).ok, true, 'the parser accepts the file');
    const small = exportFile({ domains: { textRpg: sliceOf([astra()]) } }, { id: astra().id });
    assert.equal(small.clamped, undefined);
    const huge = astra({ xp: 20000 });
    assert.equal(JSON.parse(exportFile({ domains: { textRpg: sliceOf([huge]) } }, { id: huge.id }).text).textRpg.xp, 9999);
});
