import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkShape } from '../../../ui/contract/shapes.js';
import { STORY_SHAPE } from '../../../ui/contract/story.js';
import { selectStory } from '../../../ui/select/story.js';

// Recorded answers: people.list rows ({ id, name, aliases }, modules/people/domain/queries.js), director.plan agendas (planView: key, summary, fields, steps),
// chronicle.events rows (eventOut: name, summary, place, sinceText, rumour, heard).
const PEOPLE = [{ id: 'p_1', name: 'Warden Ash', aliases: ['Ash'] }, { id: 'p_2', name: 'Brann', aliases: [] }];
const PLAN = { agendas: [{ key: 'Ash', summary: 'Closes the lodge', fields: {}, steps: { at: 2, of: 3, line: 'step 2 of 3 · since Goldwane 12' }, told: true }, { key: 'The Guild', summary: 'Raises tolls', fields: {} }], beats: [], clocks: [], hooks: [], secrets: [] };
const EVENTS = [
  { name: 'Toll hike', summary: 'Word of a new toll', place: 'Harrow', sinceText: 'Goldwane 14', rumour: 'Toll hike', open: true },
  { name: 'Heard already', summary: '', place: '', sinceText: '', rumour: 'Heard already', heard: true, open: true },
  { name: 'A siege', summary: 'Not a rumour', place: 'Gate', open: true },
];
const answers = { 'director.plan': PLAN, 'people.list': PEOPLE, 'chronicle.events': EVENTS };
const read = (name, args) => (name in answers ? answers[name] : name === 'x' ? args : null);

describe('Story: agenda owner and news on the road', () => {
  it('an agenda is owned by the stored person its key names (by name or alias); an unknown key has no owner', () => {
    const { agendas } = selectStory(read, { planShown: true });
    assert.deepEqual(agendas.items.map(a => [a.title, a.who, a.whoId]), [['Ash', 'Warden Ash', 'p_1'], ['The Guild', '', null]]);
    assert.equal(agendas.items[0].toldThisReply, true);
  });

  it('news on the road is the open rumours not yet told; heard ones and plain events are left out; the plan gate hides the items', () => {
    const shown = selectStory(read, { planShown: true }).newsOnWay;
    assert.deepEqual(shown.items, [{ title: 'Toll hike', text: 'Word of a new toll', reaches: 'Harrow', how: 'rumour since Goldwane 14' }]);
    const hidden = selectStory(read, { planShown: false }).newsOnWay;
    assert.deepEqual([hidden.count, hidden.items], [1, []]);
  });

  it('with neither query answering the rows are empty, and the shape holds', () => {
    const none = selectStory(name => (name === 'director.plan' ? PLAN : null), { planShown: true });
    assert.deepEqual([none.newsOnWay.items, none.agendas.items[0].who], [[], '']);
    assert.deepEqual(checkShape(selectStory(read, { planShown: true }), STORY_SHAPE), []);
  });
});
