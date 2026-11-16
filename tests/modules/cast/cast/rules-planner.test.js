import test from 'node:test';
import assert from 'node:assert/strict';

import { applySync, planSync, syncEmpty, syncPayload, whyNarrator, whyText } from '../../../../modules/cast/cast/apply.js';
import { cutWords, initialCast, validateCast } from '../../../../modules/cast/cast/domain.js';
import { castOf, fightOn, leanFight, shortName } from '../../../../modules/cast/cast/entries.js';
import { CAPS, castRequest, createPlans, readCast, touches } from '../../../../modules/cast/cast/plan.js';
import { entry } from './helpers.js';
import { SYNC_NOW, allow, castFor, refs, synced } from './rules.helpers.js';
test('the answer is read strictly: three labels, only for people it named, each part cut and cleaned, each person once, in caps; anything else is ignored', () => {
    const text = [
        '<think>~ cast fenna | hidden | in the reasoning</think>',
        'Here is the plan:',
        '```',
        '- ~ cast fenna | Ashford | **took** the ferry <b>upriver</b> | and then some',
        '~ cast fenna | Elsewhere | a second line for the same person',
        '1. ~ Cast Sera | Bluewatch',
        '> cast sera | her hunt led her to the weir',
        '> cast fenna | she is not drawn to anyone',
        '! cast brom | fell from the quarry',
        '! cast sera | she may not die',
        '~ cast ghost | Nowhere | not in the cast',
        '~ cast | | ',
        'cast fenna | no label',
        '```',
    ].join('\n');
    assert.deepEqual(readCast(text, { refs, allow }), {
        moves: [{ key: 'ersveil:fenna', where: 'Ashford', doing: 'took the ferry upriver / and then some' }, { key: 'ersveil:sera', where: '', doing: 'Bluewatch' }],
        comes: [{ key: 'ersveil:sera', reason: 'her hunt led her to the weir.' }],
        died: [{ key: 'ersveil:brom', text: 'fell from the quarry' }],
    });
    assert.deepEqual(readCast('', { refs, allow }), { moves: [], comes: [], died: [] });
    assert.deepEqual(readCast(null, { refs, allow }), { moves: [], comes: [], died: [] });
    // The think block's close with no open (a model that reasons first): what follows it is read.
    assert.deepEqual(readCast('thinking out loud</think>\n~ cast fenna | Ashford | resting', { refs, allow }).moves, [{ key: 'ersveil:fenna', where: 'Ashford', doing: 'resting' }]);
    // Caps.
    const many = new Map(Array.from({ length: 30 }, (_, n) => [`p${n}`, `k:p${n}`]));
    const lines = Array.from({ length: 30 }, (_, n) => `~ cast p${n} | Somewhere | something`).join('\n');
    assert.equal(readCast(lines, { refs: many }).moves.length, CAPS.move);
    // No markup, no separators, no controls reach a part.
    const odd = readCast('~ cast fenna | A\u0000place <script>x</script> | line one​ — two', { refs });
    assert.doesNotMatch(JSON.stringify(odd), /<|>|\\u0000|​/);
});

test('the request: the cast with goals and routines, the time passed, the places, the recent story; a goal that may be judged only for the unmet; the judge asks for > lines only', () => {
    const people = [
        { ref: 'fenna', name: 'Fenna', goal: 'keep the ferry running', routine: 'works the night ferry', where: 'Bluewatch docks', doing: 'ferrying', drawnTo: [], met: true, mayDie: false },
        { ref: 'sera', name: 'Sera', goal: 'find the killer', routine: '', where: 'Gwenmar', doing: '', drawnTo: ['the man at the weir'], met: false, mayDie: true },
    ];
    const batch = castRequest({ people, now: 'June 4, 1200', elapsed: '1 day', place: 'Harrow', places: ['Harrow', 'Kesh'], recent: 'Narrator: Morning.' });
    assert.match(batch.system, /^You run the off-screen cast of an ongoing story between \{\{user\}\} and \{\{char\}\}\./);
    assert.match(batch.prompt, /^Now: June 4, 1200 \(1 day since the cast last moved\)\n\{\{user\}\} is at: Harrow\nPlaces of this world: Harrow, Kesh\n/);
    assert.match(batch.prompt, /- fenna \| Fenna \| goal: keep the ferry running \| routine: works the night ferry \| now at: Bluewatch docks \| doing: ferrying \| has met them\n/);
    assert.match(batch.prompt, /- sera \| Sera \| goal: find the killer \| now at: Gwenmar \| drawn to: the man at the weir \| has not met them \| may die\n/);
    assert.match(batch.prompt, /~ cast ref \| place \| what they are doing now/);
    const judge = castRequest({ mode: 'judge', people: [people[1]] });
    assert.doesNotMatch(judge.prompt, /~ cast ref/);
    assert.match(judge.prompt, /> cast ref \| what in the story pulls them/);
    assert.match(castRequest({}).prompt, /The cast:\n\(none\)\n/);
});

test('a goal touched by the story: all the telling words of a short phrase, two thirds of a long one, whole words (a plural counts); nothing for a phrase of small words', () => {
    assert.ok(touches(['the man you fought at the weir'], 'You beat the man at the weir, the one you fought.'));
    assert.ok(touches(['whoever opened the weir'], 'Someone opened the weirs by night.'));
    assert.ok(!touches(['the man you fought at the weir'], 'You walk by the river.'));
    assert.ok(!touches(['the man you fought at the weir'], 'A weir, a river.'));
    assert.ok(!touches(['it is a to be'], 'it is a to be'), 'no telling word');
    assert.ok(!touches([], 'anything'));
    assert.ok(touches(['a', 'the stolen ledger'], 'The ledger was stolen.'));
});

test('plans in flight: a plan is asked for once per key, waited for a little, kept for a swipe; a failure is a status, not a throw', async () => {
    const plans = createPlans({ size: 2 });
    let calls = 0;
    const first = plans.start('a', async () => { calls += 1; return { ok: true }; });
    assert.equal(plans.start('a', async () => { calls += 1; return 'other'; }), first);
    assert.equal((await plans.settled('a', 50)).status, 'done');
    assert.equal(calls, 1);
    plans.start('bad', async () => { throw new Error('x'); });
    assert.equal((await plans.settled('bad', 50)).status, 'failed');
    plans.start('slow', () => new Promise(() => {}));
    assert.equal((await plans.settled('slow', 5)).status, 'pending', 'waited for the limit only');
    assert.equal(plans.peek('a'), null, 'the oldest is let go past the size');
    assert.equal(await plans.settled('never', 5), null);
});

test('the state\'s validator: a person, a note, the slots and nothing else', () => {
    const good = synced([entry('fenna')]).slice;
    assert.deepEqual(validateCast(good), []);
    assert.deepEqual(validateCast(initialCast()), []);
    const broken = structuredClone(good);
    broken.people['ersveil:fenna'].eid = 'sera';
    broken.people['ersveil:fenna'].met = { on: 1 };
    broken.notes.cn_00000001 = { at: -1, kind: 'x' };
    broken.day = [{ at: 'soon' }];
    broken.extra = 1;
    const errors = validateCast(broken);
    assert.ok(errors.length >= 4 && errors.length <= 10);
    assert.ok(validateCast(null).length === 1 && validateCast({ people: [], notes: {} }).length === 1);
});

test('a long routine is not quoted in the card\'s or the narrator\'s words for why', () => {
    const doing = 'Dawn to noon at the inspection quay; afternoons in the Watchhouse infirmary corner; after dusk at the Stray Oar.';
    assert.equal(whyText({ name: 'Tansy', why: 'place', reason: '', doing, where: 'Bluewatch Village' }), 'Tansy is at Bluewatch Village, and you are there: your first time here while they are. No roll.');
    assert.equal(whyNarrator({ doing, met: { why: 'place', where: 'Bluewatch Village', reason: '' } }), 'They are at Bluewatch Village, the place of this scene.');
});

test('places: the pack\'s places match by name, slug or alias in any case; with no places listed a start place stays as written', async () => {
    const { placeMatcher } = await import('../../../../modules/cast/cast/entries.js');
    const list = [{ id: 'pack.ersveil/bluewatch-village', name: 'Bluewatch Village', aliases: ['The Watch Town'] }, { id: 'pack.ersveil/guild-office', name: 'Bluewatch Village / Guild Office' }, { nope: true }, 'x'];
    const matcher = placeMatcher(name => (name === 'packs.content' ? list : null));
    assert.equal(matcher.any, true);
    assert.deepEqual(['bluewatch village', 'BLUEWATCH-VILLAGE', 'the watch town', 'Bluewatch Village/Guild Office', 'guild-office', 'Nowhere', ''].map(matcher.match), ['Bluewatch Village', 'Bluewatch Village', 'Bluewatch Village', 'Bluewatch Village / Guild Office', 'Bluewatch Village / Guild Office', null, null]);
    assert.equal(placeMatcher(() => { throw new Error('no packs'); }).any, false);
    const cast = castOf((name, args) => (name === 'packs.content' ? (args?.kind === 'cast' ? [entry('a', { start: { place: 'Anywhere', goal: 'g', routine: '' } })] : []) : null));
    assert.equal(cast.entries[0].place, 'Anywhere', 'nothing to check against: as written');
});

test('the pack label drops a trailing parenthetical, as NPC State Delta writes it', () => {
    assert.deepEqual(['Ersveil (open world)', 'Ersveil', 'Ersveil (a) (open world)', '(Only)', ' Pack  (x) '].map(shortName), ['Ersveil', 'Ersveil', 'Ersveil (a)', '(Only)', 'Pack']);
    const cast = castOf((name, args) => (name === 'packs.content' ? (args?.kind === 'cast' ? [entry('a')] : []) : name === 'packs.list' ? [{ id: 'ersveil', name: 'Ersveil (open world)', version: '2.2.1', enabled: true }] : null));
    assert.equal(cast.packs.ersveil.name, 'Ersveil');
});

test('a Lean RPG fight: a Foes block with a named foe whose count is above 0 and whose health is above 0; nothing else is one', () => {
    const state = (fields, role = 'foes') => ({ domains: { dataModules: { active: { 'pack.chat/foes': { hash: 'h' } }, pins: { h: { definition: { role } } }, instances: { 'pack.chat/foes': { chat: { fields } } } } } });
    assert.equal(leanFight(state({ foe1: 'Drake', count1: 1, hurt1: 5 })), true);
    assert.equal(leanFight(state({ foe1: '', count1: 2, hurt1: 5, foe3: 'Rat', count3: 0, hurt3: 5 })), false);
    assert.equal(leanFight(state({ foe4: 'Rat', count4: 2, hurt4: 1 })), true);
    assert.equal(leanFight(state({ foe1: 'Drake', count1: 1, hurt1: 5 }, 'character')), false, 'only a Foes block');
    assert.equal(leanFight({ domains: {} }), false);
    assert.equal(leanFight(null), false);
    assert.equal(fightOn(() => null, state({ foe1: 'Drake', count1: 1, hurt1: 5 })), true);
    assert.equal(fightOn(() => null, state({ foe1: 'Drake', count1: 1, hurt1: 5 }), { leanOn: false }), false);
});

test('a won Lean RPG fight is no fight: a filled slot at health 0 (Down) is beaten, as Story Block reads it; any health above 0 is live', () => {
    const state = fields => ({ domains: { dataModules: { active: { 'pack.chat/foes': { hash: 'h' } }, pins: { h: { definition: { role: 'foes' } } }, instances: { 'pack.chat/foes': { chat: { fields } } } } } });
    // Classic: hurt is a stage index (0 = Down … 5 = Unhurt); Standard: the blocks left (0 = Down).
    assert.equal(leanFight(state({ foe1: 'Gnashers', count1: 12, hurt1: 0 })), false, 'Down: a won fight');
    assert.equal(leanFight(state({ foe1: 'Gnashers', count1: 12 })), false, 'no health field reads 0, as Story Block does');
    assert.equal(leanFight(state({ foe1: 'Gnashers', count1: 12, hurt1: '0' })), false, 'not a whole number: 0');
    for (const hurt of [1, 3, 5, 6, 8]) assert.equal(leanFight(state({ foe1: 'Boar', count1: 1, hurt1: hurt })), true, `health ${hurt}`);
    assert.equal(leanFight(state({ foe1: 'Gnashers', count1: 12, hurt1: 0, foe2: 'Rat', count2: 3, hurt2: 0, foe3: 'Mantid', count3: 1, hurt3: 0 })), false, 'every filled slot Down');
    assert.equal(leanFight(state({ foe1: 'Gnashers', count1: 12, hurt1: 0, foe2: 'Rat', count2: 3, hurt2: 2 })), true, 'one live slot among Down ones');
    assert.equal(leanFight(state({ foe1: 'Rat', count1: 0, hurt1: 4 })), false, 'no count: an empty slot');
    assert.equal(leanFight(state({ foe1: '  ', count1: 2, hurt1: 4 })), false, 'no name: an empty slot');
});

test('a pack update: a version bump alone is no change; an edited entry is, and counts once; a person kept before fingerprints existed has it noted silently', () => {
    const { slice } = synced([entry('fenna'), entry('sera'), entry('brom')]);
    const same = castFor({ ...entry('fenna'), packVersion: '1.2.0' }, { ...entry('sera'), packVersion: '1.2.0' }, { ...entry('brom'), packVersion: '1.2.0' }, { ...entry('tam'), packVersion: '1.2.0' });
    const bumped = planSync(slice, same, { now: SYNC_NOW });
    assert.deepEqual(bumped.update.map(item => item.key).sort(), ['ersveil:brom', 'ersveil:fenna', 'ersveil:sera'], 'the version moves on');
    assert.deepEqual([...bumped.changed], [], 'but nothing was edited');
    assert.deepEqual(bumped.updated.map(item => [item.n, item.changed]), [[1, 0]]);
    const edited = castFor({ ...entry('fenna'), look: 'new look', packVersion: '1.2.0' }, { ...entry('sera'), packVersion: '1.2.0' }, { ...entry('brom'), packVersion: '1.2.0' }, { ...entry('tam'), packVersion: '1.2.0' });
    const plan = planSync(slice, edited, { now: SYNC_NOW });
    assert.deepEqual([...plan.changed], ['ersveil:fenna']);
    assert.deepEqual(plan.updated.map(item => [item.n, item.changed]), [[1, 1]]);
    // Applied, it settles: a second look finds nothing to do.
    applySync(slice, syncPayload(plan), { now: SYNC_NOW, rev: 3 });
    assert.ok(syncEmpty(planSync(slice, edited, { now: SYNC_NOW })), 'nothing left to do');
    // Kept before fingerprints existed: noted, never counted as an edit.
    delete slice.people['ersveil:sera'].sig;
    const old = planSync(slice, edited, { now: SYNC_NOW });
    assert.ok(old.update.some(item => item.key === 'ersveil:sera' && item.sig));
    assert.ok(!old.changed.has('ersveil:sera'));
});

test('"doing" is cut at a word, not in the middle of one', () => {
    const routine = 'Dawn to noon at the inspection quay; afternoons in the Watchhouse infirmary corner; after dusk at the Stray Oar, then the night ferry on the Branch.';
    const cut = cutWords(routine, 120);
    assert.ok(Array.from(cut).length <= 120 && cut.endsWith('…'));
    assert.match(cut, /^Dawn to noon at the inspection quay; afternoons in the Watchhouse infirmary corner; after dusk at the Stray Oar, then…$/);
    assert.equal(cutWords('short', 120), 'short');
    assert.equal(cutWords('x'.repeat(30), 10), `${'x'.repeat(9)}…`, 'a long word with no space is cut where it is');
    const { slice } = synced([entry('tansy', { start: { place: 'Bluewatch Village', goal: 'g', routine } })]);
    assert.doesNotMatch(slice.people['ersveil:tansy'].doing, /\bthen t…$/);
    assert.ok(slice.people['ersveil:tansy'].doing.endsWith('Stray Oar, then…'));
});
