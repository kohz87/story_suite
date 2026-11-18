// Words said once (soak W31, W32): the Journal's News rows without the "World:" prefix, the Director's pulse line without its own kind,
// an agenda row without its owner's name twice, a faction without "Seen in:" beside the event chip that says the same.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../helpers/dom.js';
import { buildJournal } from '../../../ui/fixtures/journal.js';
import { dayPanel } from '../../../ui/tabs/journal/day.js';
import { selectStory } from '../../../ui/select/story.js';
import { agendasCard } from '../../../ui/tabs/story/agendas.js';
import { factionsCard } from '../../../ui/tabs/world/factions.js';

test('a day\'s News row reads the story\'s own words, not "Heard of World: …"', () => {
  installFakeDom();
  const journal = buildJournal();
  const rec = journal.days.find(d => d.month === 6 && d.day === 9);
  rec.world = ['World: Farms nailed shut (Bluewatch Reach) is now ongoing.', 'a toll on the east bridge'];
  const text = dayPanel(journal, 6, 9).textContent;
  assert.match(text, /Farms nailed shut \(Bluewatch Reach\) is now ongoing\./);
  assert.doesNotMatch(text, /Heard of Farms|World:/);
  assert.match(text, /Heard of a toll on the east bridge/, 'other news keeps its words');
});

test('a pulse row says its kind once: the line after the kind, its strength after a dot', () => {
  const read = name => (name === 'pulse.view' ? {
    mode: 'lively', quiet: false, card: true,
    now: { at: 9, die: '14', skipped: false, label: 'Mundane interruption', text: 'mundane interruption (noticed): the narrator invents it', effect: '' },
    recent: [{ at: 8, die: '9', skipped: false, label: 'Rumour', text: 'A carter talks.', effect: '' }],
  } : null);
  const { pulse } = selectStory(read, { planShown: true });
  assert.equal(pulse.latest.kind, 'Mundane interruption');
  assert.equal(pulse.latest.cause, 'the narrator invents it · noticed');
  assert.equal(pulse.recent[0].text, 'A carter talks.', 'a line that does not repeat the kind is as it was');
});

test('an agenda named for its owner shows the name once', () => {
  installFakeDom();
  const agenda = { title: 'Hedda Strand', who: 'Hedda Strand', whoId: null, text: 'is selling the farm', step: 1, of: 2, since: 'Oct 1', place: 'Bluewatch', next: 'sign', why: '', toldThisReply: false };
  const card = agendasCard({ count: 1, items: [agenda] }, true, {});
  const row = card.querySelector('.it2');
  assert.equal(row.textContent.split('Hedda Strand').length - 1, 1);
});

test('a faction\'s "Seen in: X" is dropped while the event chip names X', () => {
  installFakeDom();
  const act = { placeName: () => null, gotoPlace() {}, setView() {}, openPerson() {}, edit() {} };
  const faction = summary => ({ id: 'conf', name: 'Confederacy', stance: 'neutral', summary, members: [], areaPlaceIds: [] });
  const news = [{ factionId: 'conf', title: 'Bridge tolls doubled' }];
  const same = factionsCard([faction('Seen in: Bridge tolls doubled')], news, act).textContent;
  assert.equal(same.split('Bridge tolls doubled').length - 1, 1);
  assert.match(factionsCard([faction('Seen in: Something else')], news, act).textContent, /Seen in: Something else/);
});
