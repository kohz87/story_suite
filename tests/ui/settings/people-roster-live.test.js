// Settings › People › People in this chat: the roster is the store's people list (the real selector), Open shows the dossier on People, Re-read runs NPC State's Refresh through the real port.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { mountSettings } from './sections/mount.js';
import { mountSuite } from '../../../ui/mount.js';
import { createFakePort } from '../../../ui/port/fake-port.js';
import { fixture } from '../../../ui/fixtures/index.js';
import { selectRoster } from '../../../ui/select/roster.js';
import { refreshCommand } from '../../../ui/port/people-refresh.js';
import { peopleQueries } from '../../../modules/people/domain/queries.js';

const flush = () => new Promise(resolve => setImmediate(resolve));

// A real people slice, read by the real `people.list` query.
const slice = { npcs: { n1: { id: 'n1', name: 'Brann', status: 'present', present: true }, n2: { id: 'n2', name: ' ', present: false }, n3: { id: 'n3', name: 'Old Hob', present: false, lifeState: 'dead' } }, order: ['n1', 'n2', 'n3'] };

test('the roster view lists each named person of the store with their state, and nobody without a name', () => {
  const list = peopleQueries('people')['people.list']({ domains: { people: slice } });
  const { people } = selectRoster(list);
  assert.deepEqual(people.map(p => p.name), ['Brann', 'Old Hob']);
  assert.equal(people[0].present, true);
  assert.equal(people[1].deceased, true);
  assert.deepEqual(selectRoster(null), { people: [] });
});

function openPeople(roster) {
  const doc = installFakeDom();
  const port = createFakePort({ views: { ...fixture('default'), roster } });
  const suite = mountSuite({ port, doc });
  suite.open('now');
  suite.settings();
  doc.body.querySelector('.si3[data-sec="people"]').click();
  return { doc, suite, port };
}
const rows = doc => doc.body.querySelectorAll('[data-card="roster"] [data-person]');

test('Settings › People ends with a People in this chat list; Re-read sends NPC State\'s refresh for that person and shows what happened', async () => {
  const { doc, suite, port } = openPeople({ people: [{ id: 'temiwa', name: 'Sister Temiwa', present: true, dormant: false, followed: true, deceased: false }, { id: 'hob', name: 'Old Hob', present: false, dormant: true, followed: false, deceased: false }] });
  assert.equal(doc.body.querySelector('[data-card="roster"] .gt').textContent, 'People in this chat');
  assert.deepEqual(rows(doc).map(r => r.querySelector('b').textContent), ['Sister Temiwa', 'Old Hob']);
  assert.match(rows(doc)[0].textContent, /in the scene · followed/);
  rows(doc)[1].querySelector('[data-act="reread"]').click();
  await flush();
  assert.deepEqual(port.recorded.filter(e => e.type === 'npc.refresh').map(e => e.payload), [{ name: 'Old Hob' }]);
  // (B23: the answer is drawn under the list, not only kept)
  assert.ok(doc.body.querySelector('[data-card="roster"] [data-note="roster"]'), 'the Re-read answer is under the list');
  suite.destroy();
});

test('Open closes Settings and shows that person\'s dossier on People', async () => {
  const { doc, suite } = openPeople({ people: [{ id: 'temiwa', name: 'Sister Temiwa', present: true, dormant: false, followed: false, deceased: false }] });
  rows(doc)[0].querySelector('[data-act="open"]').click();
  await flush();
  assert.ok(doc.body.querySelector('.si3[data-sec="people"]').closest('[hidden]'), 'Settings is closed');
  assert.ok(doc.body.querySelector('[data-act="menu"]'), 'the dossier page is up');
  suite.destroy();
});

test('Re-read says why it did not run, and an empty chat says nobody yet', async () => {
  assert.match((await refreshCommand({ name: 'Brann' }, null)).message, /not running/);
  const { doc, suite } = openPeople({ people: [] });
  assert.match(doc.body.querySelector('[data-card="roster"]').textContent, /Nobody yet/);
  suite.destroy();
});

test('the list is read again on every draw: a person the story drops (a swipe, a delete, a rewind) is gone on the next draw, one it adds shows', () => {
  let people = [{ id: 'a', name: 'Brann' }, { id: 'b', name: 'Mira' }];
  const { page } = mountSettings({}, { onView: name => (name === 'roster' ? { people } : null) });
  const names = () => page('people').querySelectorAll('[data-card="roster"] [data-person] b').map(b => b.textContent);
  assert.deepEqual(names(), ['Brann', 'Mira']);
  people = [{ id: 'b', name: 'Mira' }, { id: 'c', name: 'Tove' }];
  assert.deepEqual(names(), ['Mira', 'Tove']);
});
