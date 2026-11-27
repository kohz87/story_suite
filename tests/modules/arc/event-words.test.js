// World events as the planner, the judge and the open-slot call read them: words, never ids, and an EVENT line's cause is still found
// when the event is named by a long summary with commas of its own.
import test from 'node:test';
import assert from 'node:assert/strict';

import { planText, readPlan, refuseResolving, worldBriefText } from '../../../modules/arc/plan.js';
import { eventWorld } from '../../../modules/arc/plan/event-world.js';
import { applyJudge } from '../../../modules/arc/judge/apply.js';
import { rollPrompt } from '../../../modules/arc/judge/roll-prompt.js';
import { arcBrief } from '../../../modules/world/chronicle/world-daily/arc-brief.js';
import { slotBlock } from '../../../modules/world/chronicle/world-daily/open-prompt.js';

const LONG = 'Factors call in the drowned debts and tighten the collars at {place}, {region}, while the Broken Chain counts its losses.';
const SAID = 'Factors call in the drowned debts and tighten the collars, while the Broken Chain counts its losses';
const ev = (id, extra = {}) => ({ id, kind: 'chain-stage', certainty: 'likely', where: ['Highmark'], ends_when: { for: '3 days' }, ...extra });
const WORLD = {
    places: [{ name: 'Highmark', region: 'march-region', kind: 'town' }], regions: [{ id: 'march-region', name: 'The March' }], realms: [{ name: 'March Realm', regions: ['march-region'] }],
    conditions: [{ name: 'grain-dear', scope: 'region', means: 'Bread costs more.' }],
    events: [ev('collar-market', { summary: LONG, outcomes: [{ name: 'chain-breaks' }] }), ev('later-one', { summary: 'The fleet sails: {outcome}.' }), ev('mute-one')],
};
const brief = arcBrief({ daily: { events: { 'collar-market': { state: 'active' } } }, table: { 'grain-dear@march-region': { name: 'grain-dear', ref: 'march-region', fadesAt: null } }, world: WORLD, place: 'Highmark' });

test('the brief names events and conditions in words; the id stays only as the guard\'s key', () => {
    assert.deepEqual(brief.guard, [{ id: 'collar-market', title: brief.threads[0].key, outcomes: ['chain-breaks'] }]);
    assert.deepEqual(brief.toCome, ['The fleet sails'], 'one with no words is left out');
    assert.deepEqual(brief.conditions, ['grain dear at The March: Bread costs more.']);
    const text = worldBriefText(brief);
    assert.doesNotMatch(text, /collar-market|later-one|mute-one|grain-dear|march-region/);
    assert.equal(text.split('collars').length, 3, 'the name to cite, then what happens');
});

test('an EVENT line cites a long name with commas whole, cut to a name\'s length, or beside other causes, and shows words', () => {
    const world = eventWorld({ brief, query: name => (name === 'atlas.place' ? { name: 'Highmark' } : []) });
    const key = brief.threads[0].key;
    const cut = key.slice(0, key.lastIndexOf(' ', 80));
    for (const because of [key, `${key}.`, cut, `grain dear; ${key}; The fleet sails`]) {
        const read = readPlan(`<plan>\nARC: A — b\nEVENT: Riot — the market burns | where: Highmark | because: ${because}\n</plan>`, { world });
        assert.equal(read.items.length, 1, because);
        assert.match(read.items[0].desc, /^the market burns \(because: [^)]*\)$/);
        // Accept reads the plan's text again without the world.
        assert.deepEqual(readPlan(planText(read)).items, read.items, because);
        assert.match(read.items[0].desc, because.startsWith('grain') ? /grain dear; Factors/ : /\(because: Factors call/);
    }
    assert.ok(key.startsWith(SAID.slice(0, 40)));
});

test('a refusal names the event in words, and "an Active world event" when it has none', () => {
    const items = [{ kind: 'beat', key: 'End', desc: 'chain-breaks at last', parts: {} }];
    assert.match(refuseResolving({ items, findings: [] }, brief.guard).refused[0], /the world event "Factors call/);
    assert.match(refuseResolving({ items, findings: [] }, [{ id: 'x', title: '', outcomes: ['chain-breaks'] }]).refused[0], /decides how an Active world event ends/);
    const judged = applyJudge({ items, findings: [] }, { items: { 1: { verdict: 'refuse', rest: `event "${brief.threads[0].key.slice(0, 60)}"` } } }, brief.guard);
    assert.equal(judged.refused.length, 1);
});

test('the roll judge and the open slot get words only', () => {
    const prompt = rollPrompt({ items: [{ id: 'a-b', title: 'The sea rises', summary: 'The sea rises, and boats stay in.' }, { id: 'c-d', title: '', summary: '' }] });
    assert.match(prompt, /1: The sea rises, and boats stay in\.\n2: An event with no description$/);
    assert.match(slotBlock({ key: 'k', place: 'Highmark', realm: 'r' }, { summary: '', menu: {}, facts: [], conditions: [], figures: [] }), /Happening: a minor happening/);
});

const planOf = because => `<plan>\nARC: A — b\nEVENT: Riot — the market burns | where: Highmark | because: ${because}\n</plan>`;
const mapped = causes => ({ place: () => 'Highmark', causes });

test('an untitled event is accepted cited as its printed line, its name alone, or its name with the outcome tag', () => {
    // A short name, one over 80 characters, and one with commas; each is the start of what is printed after it.
    for (const name of ["Ardelia's Electors vote in Osterhal", 'The long fleets of the southern continent set sail again toward the northern coast once more this year', SAID]) {
        const now = `${name}: The Reopening candidate is elected. (outcome: The Reopening candidate is elected)`;
        const text = worldBriefText({ threads: [{ key: name, now, then: 'outcome decided by the world' }] });
        const printed = text.split('\n').find(line => line.startsWith('- ')).slice(2).split(' → ')[0];
        assert.ok(printed.includes(' — '), 'the name is printed on its own, then what happens');
        for (const because of [printed, now, name, `${name} (outcome: The Reopening candidate is elected)`]) {
            const read = readPlan(planOf(because), { world: mapped(['Ardelia', 'grain dear', name]) });
            assert.equal(read.items.length, 1, because);
            assert.deepEqual(readPlan(planText(read)).items, read.items, because);
            assert.ok(read.items[0].desc.includes(`(because: ${name.slice(0, 20)}`), `${because} → ${read.items[0].desc}`);
        }
        const guard = [{ id: 'x', title: name, outcomes: ['chain-breaks'] }];
        const items = [{ kind: 'beat', key: 'End', desc: 'the vote is bought', parts: {} }];
        for (const quoted of [`event "${printed}"`, `event "${name}"`, `event "${name} (outcome: X)"`, `event "${name}" (outcome: X)`]) {
            const out = applyJudge({ items, findings: [] }, { items: { 1: { verdict: 'refuse', rest: quoted } } }, guard);
            assert.ok(out.refused[0].includes(`the world event "${name}"`), `${quoted} → ${out.refused[0]}`);
        }
    }
    assert.equal(readPlan(planOf('grain dearth'), { world: mapped(['grain dear']) }).items.length, 0, 'only on a word boundary');
});

test('a name with a comma: either apostrophe, or cited up to the comma when no other name starts so', () => {
    const name = "Auvoth's wardens close the gate, and the south road shuts";
    for (const because of [name.replace("'", '’'), 'Auvoth’s wardens close the gate', "Auvoth's wardens close the gate"]) {
        const read = readPlan(planOf(because), { world: mapped([name]) });
        assert.equal(read.items.length, 1, because);
        assert.ok(read.items[0].desc.includes("(because: Auvoth's wardens"), read.items[0].desc);
    }
    assert.equal(readPlan(planOf(name), { world: mapped([name.replace("'", '‘')]) }).items.length, 1);
    const two = [name, "Auvoth's wardens close the gate; the toll rises"];
    assert.equal(readPlan(planOf("Auvoth's wardens close the gate"), { world: mapped(two) }).items.length, 0, 'two names start so');
});
