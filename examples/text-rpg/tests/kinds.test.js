import test from 'node:test';
import assert from 'node:assert/strict';
import { applyXp } from '../src/module-parts/kinds/xp.js';
import { applyCondition, applyInjury, applyFall } from '../src/module-parts/kinds/status.js';
import { applyHealth, applySpend } from '../src/module-parts/kinds/pools.js';
import { applySkill, applyCompanion } from '../src/module-parts/kinds/roster.js';
import { applyLine, kindsOf } from '../src/module-parts/kinds.js';
import { astra, fakeCtx, line, run, sliceOf } from './helpers/fake-ctx.js';

const asRolled = (hardest = 2, used = 1) => ({ list: [10, 10, 10], floor: 0, used, hardest });

test('+ xp pays by size, cut to what the hardest roll supports, and none without a roll', () => {
    const paid = size => {
        const slice = sliceOf([astra()], asRolled(2));
        return [run(applyXp, fakeCtx(slice), line('xp', 'Party', 'a duel', { size })), slice.members.ac_astra001.xp];
    };
    assert.equal(paid('real')[1], 20);
    assert.equal(paid('major')[1], 60);
    assert.equal(paid('great')[1], 60, 'great is cut to major on a hard roll');
    const easy = sliceOf([astra()], asRolled(1));
    run(applyXp, fakeCtx(easy), line('xp', 'Party', 'a scuffle', { size: 'major' }));
    assert.equal(easy.members.ac_astra001.xp, 20, 'major is cut to real on a normal roll');
    const none = sliceOf([astra()], { list: [10, 10, 10], floor: 0 });
    run(applyXp, fakeCtx(none), line('xp', 'Party', 'talk', { size: 'real' }));
    assert.equal(none.members.ac_astra001.xp, 0);
});

test('+ xp scales by the threat the roll named, and a bad size is refused', () => {
    const slice = sliceOf([astra()], { ...asRolled(2), threat: 0 });
    run(applyXp, fakeCtx(slice), line('xp', 'Party', 'rats', { size: 'real' }));
    assert.equal(slice.members.ac_astra001.xp, 0, 'far beneath pays nothing');
    const above = sliceOf([astra()], { ...asRolled(2), threat: 3 });
    run(applyXp, fakeCtx(above), line('xp', 'Party', 'ogre', { size: 'real' }));
    assert.equal(above.members.ac_astra001.xp, 30);
    assert.equal(run(applyXp, fakeCtx(sliceOf()), line('xp', 'Party', 'x', { size: 'huge' })).code, 'INVALID');
});

test('+ xp: levels add points, only one line counts a reply, companions and the fallen get none', () => {
    const rorke = astra({ id: 'ac_rorke001', name: 'Rorke', pc: false, companion: { level: 5, strengths: [] } });
    const slice = sliceOf([astra({ xp: 40 }), rorke], asRolled());
    const ctx = fakeCtx(slice);
    const first = run(applyXp, ctx, line('xp', 'Party', 'the pass', { size: 'real' }));
    assert.equal(first.result.narrate, true);
    assert.match(first.result.summary, /Astra reaches level 2/);
    const me = slice.members.ac_astra001;
    assert.deepEqual([me.level, me.points, rorke.xp], [2, 1, 0]);
    assert.equal(run(applyXp, ctx, line('xp', 'Party', 'again', { size: 'real' })).code, 'LIMITED');
});

test('~ condition: timed, treated, replaced by name, cleared, at most four', () => {
    const slice = sliceOf();
    const ctx = fakeCtx(slice, { time: 600 });
    run(applyCondition, ctx, line('condition', 'Astra', 'poisoned', { until: '2 hours' }));
    run(applyCondition, ctx, line('condition', 'Astra', 'bleeding', { until: 'treated' }));
    const me = slice.members.ac_astra001;
    assert.deepEqual(me.conditions, [{ name: 'poisoned', until: 720 }, { name: 'bleeding', until: 'treated' }]);
    run(applyCondition, ctx, line('condition', 'Astra', 'poisoned', { until: 'cleared' }));
    assert.deepEqual(me.conditions.map(item => item.name), ['bleeding']);
    for (const name of ['stunned', 'frightened', 'burning', 'prone']) run(applyCondition, ctx, line('condition', 'Astra', name, { until: 'treated' }));
    assert.deepEqual(me.conditions.map(item => item.name), ['stunned', 'frightened', 'burning', 'prone']);
    assert.equal(run(applyCondition, ctx, line('condition', 'Nobody', 'prone')).code, 'NOT_FOUND');
});

test('+ injury: stats it hampers, days by grave, at most three kept', () => {
    const slice = sliceOf();
    const ctx = fakeCtx(slice, { time: 100 });
    run(applyInjury, ctx, line('injury', 'Astra', 'cracked rib', { hampers: 'STR, agi, luck', grave: 'serious' }));
    const me = slice.members.ac_astra001;
    assert.deepEqual(me.injuries[0], { name: 'cracked rib', hampers: ['str', 'agi'], heals: 100 + 10 * 1440, grave: 'serious' });
    for (const name of ['a', 'b', 'c']) run(applyInjury, ctx, line('injury', 'Astra', name));
    assert.deepEqual(me.injuries.map(item => item.name), ['a', 'b', 'c']);
    assert.equal(me.injuries[0].grave, 'minor');
});

test('! fall closes the sheet: it is kept, and later lines for the character are refused', () => {
    const slice = sliceOf();
    const ctx = fakeCtx(slice);
    run(applyFall, ctx, line('fall', 'Astra', 'cut down on the bridge'));
    assert.deepEqual(slice.members.ac_astra001.fallen, { how: 'cut down on the bridge' });
    assert.equal(run(applyHealth, ctx, line('health', 'Astra', 'Hurt')).code, 'REFUSED');
});

test('~ health moves to the stage word, down or up, and Down is zero', () => {
    const slice = sliceOf();
    const ctx = fakeCtx(slice);
    const me = slice.members.ac_astra001;
    run(applyHealth, ctx, line('health', 'Astra', 'Wounded', { why: 'a spear' }));
    assert.equal(me.pools.hp.now, 18);
    run(applyHealth, ctx, line('health', 'Astra', 'Hurt'));
    assert.equal(me.pools.hp.now, 27);
    run(applyHealth, ctx, line('health', 'Astra', 'Down'));
    assert.equal(me.pools.hp.now, 0);
    assert.equal(run(applyHealth, ctx, line('health', 'Astra', 'Dizzy')).code, 'INVALID');
});

test('~ spend takes the skill\'s cost, refuses without it, and a Down character cannot spend', () => {
    const slice = sliceOf();
    const ctx = fakeCtx(slice);
    const me = slice.members.ac_astra001;
    run(applySpend, ctx, line('spend', 'Astra', 'Obscure'));
    assert.equal(me.pools.sp.now, 32);
    me.pools.sp.now = 1;
    assert.equal(run(applySpend, ctx, line('spend', 'Astra', 'Obscure')).code, 'NOT_ENOUGH');
    assert.equal(run(applySpend, ctx, line('spend', 'Astra', 'Dancing')).code, 'NOT_FOUND');
    me.pools.hp.now = 0;
    assert.equal(run(applySpend, ctx, line('spend', 'Astra', 'Lore')).code, 'REFUSED');
});

test('+ skill takes the next free slot (5 at level 1, one more every third level) and reads both grammars', () => {
    const slice = sliceOf();
    const ctx = fakeCtx(slice);
    const me = slice.members.ac_astra001;
    run(applySkill, ctx, line('skill', 'Astra', 'Tracking; wis; utility', { from: 'Rorke taught her' }));
    run(applySkill, ctx, line('skill', 'Astra', 'Knots', { stat: 'dex', type: 'craft', cost: '1 sp' }));
    assert.deepEqual(me.skills[2], { name: 'Tracking', about: 'Rorke taught her', stat: 'wis', type: 'utility', cost: null });
    assert.deepEqual(me.skills[3].cost, { pool: 'sp', n: 1 });
    run(applySkill, ctx, line('skill', 'Astra', 'Haggling; cha; social'));
    assert.equal(run(applySkill, ctx, line('skill', 'Astra', 'Cooking; wis; craft')).code, 'LIMITED');
    me.level = 3;
    assert.equal(run(applySkill, ctx, line('skill', 'Astra', 'Cooking; wis; craft')).ok, true);
    assert.equal(run(applySkill, ctx, line('skill', 'Astra', 'Cooking; wis; craft')).code, 'INVALID', 'twice');
    assert.equal(run(applySkill, ctx, line('skill', 'Astra', 'Luck; luck')).code, 'INVALID');
});

test('+ companion makes a sheetless member with a level and up to three strengths, and updates a known one', () => {
    const slice = sliceOf();
    const ctx = fakeCtx(slice);
    const done = run(applyCompanion, ctx, line('companion', 'Rorke', '', { level: '9', strengths: 'very strong, a veteran swordswoman, tracker, extra' }));
    const rorke = slice.members[done.result.data.member];
    assert.deepEqual([rorke.name, rorke.pc, rorke.companion], ['Rorke', false, { level: 9, strengths: ['very strong', 'a veteran swordswoman', 'tracker'] }]);
    run(applyCompanion, ctx, line('companion', 'rorke', '', { level: '10' }));
    assert.deepEqual([Object.keys(slice.members).length, rorke.level], [2, 10]);
    assert.equal(run(applyCompanion, ctx, line('companion', 'Astra', '', { level: '3' })).code, 'REFUSED');
});

test('every kind refuses quietly while off, and the dispatcher knows only its own kinds', () => {
    const off = fakeCtx(sliceOf(), { on: false });
    for (const kind of Object.keys(kindsOf(null))) assert.equal(run(applyLine, off, line(kind, 'Astra', 'x', { size: 'real' })).code, 'FEATURE_OFF', kind);
    assert.equal(run(applyLine, fakeCtx(sliceOf()), line('roll', 'Astra')).code, 'INVALID');
});

test('the kinds table: heads, the feature, and grammar only while active', () => {
    const on = kindsOf({ feature: id => id === 'text-rpg.on' });
    const off = kindsOf({ feature: () => false });
    assert.deepEqual(Object.keys(on).sort(), ['companion', 'condition', 'fall', 'health', 'injury', 'skill', 'spend', 'try', 'xp']);
    assert.deepEqual(on.try.heads, ['? try']);
    assert.equal(on.xp.feature, 'text-rpg.on');
    assert.match(on.try.grammar(), /^\? try Who \|/);
    assert.equal(off.try.grammar(), '');
    assert.ok(Object.values(on).every(kind => kind.grammar().length < 200), 'grammar lines are short');
});
