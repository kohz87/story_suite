// The dossier library: its order, chips, counts, search, previous / next and the folded strip.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../../helpers/ui-fake-dom.js';
import { dossierPage } from '../../../../../ui/tabs/people/dossier/dossier.js';
import { libraryPeople, chipSets, searchPeople, stepPerson } from '../../../../../ui/tabs/people/dossier/library-sets.js';
import { createFakePort } from '../../../../../ui/port/fake-port.js';
import { fixture } from '../../../../../ui/fixtures/index.js';
import { dossier } from './helpers.js';

const person = (id, extra = {}) => ({
  ...dossier('temiwa'), id, name: id[0].toUpperCase() + id.slice(1), life: 'alive', inParty: false, here: false, following: false, dormant: false, seenTurn: 1,
  profile: { ...dossier('temiwa').profile, aliases: null }, ...extra,
});

// (given out of order on purpose)
const CAST = [
  person('gone', { dormant: true, seenTurn: 3 }),
  person('ghost', { life: 'deceased', seenTurn: 99 }),
  person('old', { seenTurn: 10 }),
  person('fan', { following: true, seenTurn: 2 }),
  person('near', { here: true, seenTurn: 50 }),
  person('never', { seenTurn: undefined }),
  person('mate', { inParty: true, seenTurn: 5, profile: { aliases: 'Shorty, The Axe' } }),
  person('fresh', { seenTurn: 30 }),
  person('lost', { life: 'presumed', inParty: true, following: true, seenTurn: 4 }),
  person('buddy', { inParty: true, here: true, seenTurn: 50 }),
];
// The port's view holds everyone under the id and the lower-case name.
const viewOf = list => ({ ...Object.fromEntries(list.map(p => [`name:${p.id}`, p])), ...Object.fromEntries(list.map(p => [p.id, p])) });
const ids = list => list.map(p => p.id);
const ORDER = ['buddy', 'mate', 'near', 'fan', 'fresh', 'old', 'gone', 'never', 'ghost', 'lost'];
const AROUND = ['buddy', 'mate', 'near', 'fan', 'fresh', 'old', 'never'];

test('order: party, here, followed, then the last seen first (never seen after them), the dead last whatever else they are', () => {
  assert.deepEqual(ids(libraryPeople(viewOf(CAST))), ORDER);
});

test('chip sets: Around is the living party, here, followed and recently seen; Party, Following and All keep the dead, last', () => {
  const sets = chipSets(libraryPeople(viewOf(CAST)));
  assert.deepEqual(ids(sets.around), AROUND);
  assert.deepEqual(ids(sets.party), ['buddy', 'mate', 'lost']);
  assert.deepEqual(ids(sets.followed), ['fan', 'lost']);
  assert.deepEqual(ids(sets.all), ORDER);
});

test('search matches names and other names in any case, within the list given', () => {
  const people = libraryPeople(viewOf(CAST));
  assert.deepEqual(ids(searchPeople(people, '  FRE ')), ['fresh']);
  assert.deepEqual(ids(searchPeople(people, 'axe')), ['mate']);
  assert.deepEqual(ids(searchPeople(chipSets(people).followed, 'axe')), []);
  assert.deepEqual(ids(searchPeople(people, '')), ORDER);
});

test('previous and next wrap at the ends; someone outside the chip steps from their place; nobody else gives null', () => {
  const people = libraryPeople(viewOf(CAST));
  const { around, party } = chipSets(people);
  assert.equal(stepPerson(people, around, 'buddy', -1), 'never');
  assert.equal(stepPerson(people, around, 'never', 1), 'buddy');
  assert.equal(stepPerson(people, around, 'near', 1), 'fan');
  assert.equal(stepPerson(people, around, 'gone', 1), 'never');
  assert.equal(stepPerson(people, around, 'gone', -1), 'old');
  assert.equal(stepPerson(people, around, 'ghost', 1), 'buddy', 'past the last of the chip: back to its start');
  assert.equal(stepPerson(people, party, 'near', -1), 'mate');
  assert.equal(stepPerson(people, [], 'near', 1), null);
  assert.equal(stepPerson(people, [people[0]], people[0].id, 1), null);
});

function mount(currentId = 'buddy', cast = CAST) {
  const doc = installFakeDom();
  const base = createFakePort({ views: fixture('default') });
  const view = viewOf(cast);
  const port = { ...base, view: (name, args) => (name === 'dossier' ? view : base.view(name, args)), command: base.command.bind(base) };
  const root = dossierPage(view[currentId], { port });
  doc.body.append(root);
  const strip = () => root.querySelector('.dlib');
  const click = sel => strip().querySelector(sel).click();
  const listed = sel => strip().querySelectorAll(sel).map(b => b.dataset.personId);
  return { doc, root, strip, click, listed };
}
const press = (el, key, extra = {}) => el.dispatch('keydown', { key, ...extra });

test('the folded strip shows the Around people and "+N more", which opens the library on All', () => {
  const { strip, click, listed } = mount();
  assert.deepEqual(listed('.row2 [data-person-id]'), AROUND);
  assert.equal(strip().querySelector('.ln').textContent, '10');
  assert.equal(strip().querySelector('.lmore').textContent, '+3 more');
  click('.lmore');
  assert.ok(strip().classList.contains('open'));
  assert.equal(strip().querySelector('[data-filter="all"]').getAttribute('aria-pressed'), 'true');
  assert.deepEqual(listed('.lp'), ORDER);
});

test('with everyone around there is no "+N more"', () => {
  const { strip } = mount('near', CAST.filter(p => AROUND.includes(p.id)));
  assert.equal(strip().querySelector('.lmore'), null);
});

test('open: Around is on, each chip shows its count, and a chip shows its set', () => {
  const { strip, click, listed } = mount();
  click('[data-act="library"]');
  assert.deepEqual(strip().querySelectorAll('.fchip').map(c => c.textContent), ['Around7', 'Party3', '★ Following2', 'All10']);
  assert.equal(strip().querySelector('[data-filter="around"]').getAttribute('aria-pressed'), 'true');
  assert.deepEqual(listed('.lp'), AROUND);
  click('[data-filter="party"]');
  assert.deepEqual(listed('.lp'), ['buddy', 'mate', 'lost']);
});

test('the search filters the chosen chip, keeps its box and its words through a chip change, and says when nobody fits', () => {
  const { strip, click, listed } = mount();
  click('[data-act="library"]');
  const box = strip().querySelector('.lsearch');
  const type = (el, value) => { el.value = value; el.dispatch('input'); };
  type(box, 'axe');
  assert.equal(strip().querySelector('.lsearch'), box, 'typing redraws only the portraits');
  assert.deepEqual(listed('.lp'), ['mate']);
  click('[data-filter="followed"]');
  assert.equal(strip().querySelector('.lsearch').value, 'axe');
  assert.deepEqual(listed('.lp'), []);
  assert.equal(strip().querySelector('.lrow .fine').textContent, 'Nobody found.');
});

test('‹ › step through the chosen chip in place, wrapping at both ends, with the library folded', () => {
  const { root, strip, click } = mount();
  click('[data-act="libprev"]');
  assert.equal(root.dataset.personId, 'never');
  assert.equal(strip().classList.contains('open'), false);
  click('[data-act="libnext"]');
  assert.equal(root.dataset.personId, 'buddy');
  click('[data-act="libnext"]');
  assert.equal(root.dataset.personId, 'mate');
  click('[data-act="library"]');
  click('[data-filter="party"]');
  click('[data-act="libnext"]');
  assert.equal(root.dataset.personId, 'lost');
  click('[data-act="libnext"]');
  assert.equal(root.dataset.personId, 'buddy');
});

test('‹ › are off when the chip holds nobody else', () => {
  const { strip } = mount('solo', [person('solo')]);
  assert.equal(strip().querySelector('[data-act="libnext"]').hasAttribute('disabled'), true);
});

test('the arrow keys step while the focus is in the library, and stop there; the search box and modified keys are left alone', () => {
  const { root, strip, click } = mount();
  const right = press(strip().querySelector('[data-act="library"]'), 'ArrowRight');
  assert.equal(root.dataset.personId, 'mate');
  assert.deepEqual([right.defaultPrevented, right.stopped], [true, true]);
  press(strip(), 'ArrowLeft');
  assert.equal(root.dataset.personId, 'buddy');
  press(strip(), 'ArrowRight', { altKey: true });
  assert.equal(root.dataset.personId, 'buddy');
  click('[data-act="library"]');
  const typing = press(strip().querySelector('.lsearch'), 'ArrowRight');
  assert.equal(root.dataset.personId, 'buddy');
  assert.equal(typing.defaultPrevented, false);
});

test('the focus stays in the library through a chip change and stepping, so the arrow keys keep working', () => {
  const { doc, root, strip, click } = mount();
  const act = () => doc.activeElement;
  strip().querySelector('[data-act="library"]').focus();
  click('[data-act="library"]');
  assert.equal(act(), strip().querySelector('[data-act="library"]'));
  strip().querySelector('[data-filter="party"]').focus();
  click('[data-filter="party"]');
  assert.equal(act(), strip().querySelector('[data-filter="party"]'));
  strip().querySelector('.lp[data-person-id="buddy"]').focus();
  press(act(), 'ArrowRight');
  assert.equal(root.dataset.personId, 'mate');
  assert.equal(act(), strip().querySelector('.lp[data-person-id="mate"]'), 'a focused portrait follows the open person');
});

test('"+N more" hands the focus to the strip’s head, as it is gone once the library is open', () => {
  const { doc, strip, click } = mount();
  strip().querySelector('.lmore').focus();
  click('.lmore');
  assert.equal(doc.activeElement, strip().querySelector('[data-act="library"]'));
});
