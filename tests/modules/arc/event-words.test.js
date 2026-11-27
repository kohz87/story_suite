// World events as the planner, the judge and the open-slot call read them: words, never ids, and an EVENT line's cause is still found
// when the event is named by a long summary with commas of its own.
import test from 'node:test';
import assert from 'node:assert/strict';

import { readPlan, refuseResolving, worldBriefText } from '../../../modules/arc/plan.js';
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
    assert.equal(text.split('collars').length, 2, 'a name taken from the summary is not said twice');
});

test('an EVENT line cites a long name with commas whole, cut to a name\'s length, or beside other causes, and shows words', () => {
    const world = eventWorld({ brief, query: name => (name === 'atlas.place' ? { name: 'Highmark' } : []) });
    const key = brief.threads[0].key;
    const cut = key.slice(0, key.lastIndexOf(' ', 80));
    for (const because of [key, `${key}.`, cut, `grain dear; ${key}; The fleet sails`]) {
        const read = readPlan(`<plan>\nARC: A — b\nEVENT: Riot — the market burns | where: Highmark | because: ${because}\n</plan>`, { world });
        assert.equal(read.items.length, 1, because);
        assert.match(read.items[0].desc, /^the market burns \(because: [^)]*\)$/);
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
