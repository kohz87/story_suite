// The planner's EVENT lines (switch story-director.world-events): read only while the reader is given the world; kept as a beat at a place the map
// knows, its words citing the causes the world records; one with no such cause or place is left out; two at most; with the switch off EVENT is no label.
import test from 'node:test';
import assert from 'node:assert/strict';

import { planText, readPlan } from '../../../modules/arc/plan.js';
import { eventWorld } from '../../../modules/arc/plan/event-world.js';
import { OPENING, setUp } from './world-judge.helpers.js';

const WORLD = { place: name => (/^highmark$/i.test(name.trim()) ? 'Highmark' : null), causes: ['The succession', 'unrest@Highmark', 'unrest', 'Bread Riots'] };
const plan = lines => `<plan>\nARC: Succession — a crown in doubt\n${lines.join('\n')}\n</plan>`;
const LINE = 'EVENT: Grain Riot — the poor storm the granary | where: highmark | because: the succession; Unrest; the moon';

test('an EVENT line is a beat at the map\'s place, its words citing only the causes the world records', () => {
    const read = readPlan(plan([LINE]), { world: WORLD });
    assert.deepEqual(read.items, [{ kind: 'beat', key: 'Grain Riot', desc: 'the poor storm the granary (because: The succession; unrest)', parts: { place: 'Highmark' } }]);
    assert.equal(planText(read).split('\n')[1], 'BEAT: Grain Riot — the poor storm the granary (because: The succession; unrest) | place: Highmark');
    assert.deepEqual(readPlan(planText(read)).items, read.items, 'the text reads back the same without the world (the accept command\'s reading)');
});

test('left out: no known cause, no place, a place the map does not know, a third event; the switch off: EVENT is no plan label', () => {
    const read = readPlan(plan([
        'EVENT: Omen — a comet | where: Highmark | because: the moon',
        'EVENT: Flood — the river rises | because: unrest',
        'EVENT: Fire — the docks burn | where: Atlantis | because: unrest',
        LINE,
        'EVENT: Second — more | where: Highmark | because: Bread Riots',
        'EVENT: Third — too many | where: Highmark | because: Bread Riots',
        'BEAT: Refugees — families leave',
    ]), { world: WORLD });
    assert.deepEqual(read.items.map(item => item.key), ['Grain Riot', 'Second', 'Refugees']);
    const warns = read.findings.filter(item => item.severity === 'warn').map(item => item.text);
    assert.deepEqual(warns, [
        '"Omen" was left out: it cites no cause the world records (because:); not found: the moon.',
        '"Flood" was left out: it names no place (where:).',
        '"Fire" was left out: "Atlantis" is not a place the map knows.',
        '"Third" was left out: a plan keeps at most 2 events.',
    ]);
    const off = readPlan(plan([LINE, 'BEAT: Refugees — families leave']));
    assert.deepEqual(off.items.map(item => item.key), ['Refugees']);
    assert.ok(off.findings.some(item => item.text === 'Not read: "EVENT:" is not a plan label.'));
});

test('the world check: causes from the brief, the Journal and the threads; places through the atlas; none without a brief', () => {
    const query = (name, args) => (name === 'chronicle.events' ? [{ name: 'Bread Riots' }, { name: 'Lie', judge: 'refused' }, { name: 'Maybe', judge: 'pending' }] : name === 'atlas.place' && args.name === 'highmark' ? { name: 'Highmark' } : null);
    const world = eventWorld({ brief: { threads: [{ key: 'The succession' }], toCome: ['The vote'], conditions: ['unrest at Highmark: Crowds.'] }, query, threads: [{ key: 'Letter' }] });
    assert.deepEqual(world.causes, ['The succession', 'The vote', 'unrest at Highmark', 'unrest', 'Bread Riots', 'Letter'], 'a refused or still-waiting Journal entry is no cause');
    assert.equal(world.place('highmark'), 'Highmark');
    assert.equal(world.place('nowhere'), null);
    assert.equal(eventWorld({ brief: null, query }), null);
});

test('on the host: the planner is taught EVENT with the switch on; its EVENT line becomes a judged beat; off: neither', async () => {
    const answer = '<plan>\nARC: Succession — a crown in doubt\nEVENT: Vigil — mourners gather at the keep | where: Highmark | because: The succession\nBEAT: Refugees — families leave Highmark\n</plan>';
    for (const on of [true, false]) {
        const t = await setUp(on, { plans: [answer] });
        try {
            await t.host.send('Begin.', OPENING);
            const out = await t.arc.plan();
            assert.equal(out.ok, true);
            const system = `${t.planned[0]?.system ?? ''}\n${t.planned[0]?.prompt ?? ''}`;
            assert.equal(/EVENT: Title — what happens/.test(system), on, `taught only with the switch on (${on})`);
            const lines = out.draft.text.split('\n');
            if (on) {
                assert.ok(lines.includes('BEAT: Vigil — mourners gather at the keep (because: The succession) | place: Highmark'), out.draft.text);
                assert.match(t.judged[0].prompt, /1: BEAT: Vigil — mourners gather at the keep \(because: The succession\) \| place: Highmark/, 'the judge judges it as a beat');
            } else assert.ok(!lines.some(line => /Vigil/.test(line)), 'off: the EVENT line is not read');
        } finally { t.done(); }
    }
});

test('a cause with a comma of its own is cited only on word boundaries, never from inside other words', () => {
    const world = { ...WORLD, causes: ['Storm, Rain'] };
    const read = because => readPlan(plan([`EVENT: Flood — the river rises | where: Highmark | because: ${because}`]), { world });
    assert.deepEqual(read('Brainstorm, Rainmaker').items, []);
    assert.deepEqual(read('Brainstorm, Rain').items, []);
    for (const said of ['Storm, Rain', 'storm, rain over the bay', 'Brainstorm, Rainmaker; Storm, Rain']) {
        assert.deepEqual(read(said).items.map(item => item.desc), ['the river rises (because: Storm, Rain)'], said);
    }
});

test('a letter outside the basic plane beside a cause is a letter: no citation from inside that word', () => {
    const world = { ...WORLD, causes: ['Storm, Rain'] };
    const read = because => readPlan(plan([`EVENT: Flood — the river rises | where: Highmark | because: ${because}`]), { world }).items;
    for (const said of ['𐐀Storm, Rain', '𐐀Storm']) assert.deepEqual(read(said), [], said);
    assert.equal(read('𐐀 Storm, Rain').length, 1);
    // the letter after it: with a second "Storm …" cause, "Storm" alone cites neither, so only the whole name can
    world.causes.push('Storm Front');
    assert.deepEqual(read('Storm, Rain𐐀'), []);
    assert.equal(read('Storm, Rain 𐐀').length, 1);
});
