import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../../packages/story-block/tests/ui-fake-dom.js';
import { fixture } from '../../../../ui/fixtures/index.js';
import { TIES } from '../../../../ui/fixtures/dossier.js';
import { createFakePort } from '../../../../ui/port/fake-port.js';
import { peopleTab, selectPeople } from '../../../../ui/tabs/people/people.js';

const vm = (variant = 'default') => ({ ...fixture(variant).people, ties: TIES.map(t => ({ ...t })) });
const names = el => el.querySelectorAll('.pc .nm2').map(n => n.textContent);
const press = (tab, id) => tab.querySelector(`[data-filter="${id}"]`).click();

test('All lists Here then Elsewhere, with counts, legend and known total', () => {
  installFakeDom();
  const data = vm();
  const tab = peopleTab(data, {});
  assert.equal(tab.dataset.tab, 'people');
  assert.equal(tab.querySelector('.phd h3').textContent, 'People');
  assert.equal(tab.querySelector('.cnt').textContent, `${data.counts.all} known`);
  const sections = tab.querySelectorAll('.psec');
  assert.deepEqual(sections.map(s => s.dataset.section), ['here', 'elsewhere']);
  assert.match(sections[0].querySelector('.secl2').textContent, /^Here · 4$/);
  assert.match(sections[1].querySelector('.secl2').textContent, /^Elsewhere · 3$/);
  assert.deepEqual(names(sections[0]), data.here.map(p => p.name));
  assert.equal(tab.querySelectorAll('.legend span').length, 4);
  assert.equal(tab.querySelector('[data-filter="all"]').getAttribute('aria-pressed'), 'true');
});

test('Party, Following and Deceased filters narrow the list and show their counts', () => {
  installFakeDom();
  const tab = peopleTab(vm(), {});
  press(tab, 'party');
  assert.deepEqual(names(tab), ['Torka', 'Brann', 'Rika']);
  press(tab, 'followed');
  assert.deepEqual(names(tab), ['Sister Temiwa', 'Torka', 'Captain Ilse Varr']);
  press(tab, 'deceased');
  assert.deepEqual(names(tab), ['Old Marro', 'Dren']);
  assert.equal(tab.querySelector('.secl2'), null);
  assert.equal(tab.querySelector('[data-filter="deceased"] small').textContent, '2');
});

test('Not seen lately shows only when someone is dormant, explains itself and links back', () => {
  installFakeDom();
  const tab = peopleTab(vm(), {});
  assert.equal(tab.querySelector('[data-filter="dormant"] small').textContent, '1');
  press(tab, 'dormant');
  assert.match(tab.querySelector('.secl2').textContent, /hidden from All until seen again/);
  assert.match(tab.querySelector('.fine').textContent, /1 not seen lately/);
  tab.querySelector('.lnk2').click();
  assert.equal(tab.querySelectorAll('.psec').length, 2);
  const withList = peopleTab({ ...vm(), dormant: [{ ...vm().elsewhere[0], personId: 'della', name: 'Della' }] }, {});
  press(withList, 'dormant');
  assert.deepEqual(names(withList), ['Della']);
  assert.equal(peopleTab(vm('empty'), {}).querySelector('[data-filter="dormant"]'), null);
});

test('search finds by name or role across every group, keeps focus on the box, and says when nobody matches', () => {
  installFakeDom();
  const data = { ...vm(), dormant: [{ ...vm().elsewhere[0], personId: 'della', name: 'Della', role: 'Fishwife' }] };
  const tab = peopleTab(data, {});
  const box = tab.querySelector('.psrch');
  box.focus();
  box.value = 'fish';
  box.dispatch('input');
  assert.deepEqual(names(tab), ['Della']);
  assert.match(tab.querySelector('.secl2').textContent, /^Found · 1$/);
  assert.equal(globalThis.document.activeElement, box);
  box.value = 'marro';
  box.dispatch('input');
  assert.deepEqual(names(tab), ['Old Marro']);
  box.value = 'zzz';
  box.dispatch('input');
  assert.match(tab.querySelector('.fine').textContent, /Nobody found/);
});

test('tiles open the dossier through ctx.go, and + Add sends npc.add on the port', async () => {
  installFakeDom();
  const port = createFakePort();
  const went = [];
  const tab = peopleTab(vm(), { port, go: (t, a) => went.push([t, a]) });
  tab.querySelector('[data-person-id="oyla"]').click();
  assert.deepEqual(went, [['people', { personId: 'oyla' }]]);
  tab.querySelector('.phd .btn2').click();
  await Promise.resolve();
  assert.deepEqual(port.recorded.map(e => [e.kind, e.type]), [['command', 'npc.add']]);
});

test('the List/Map switch swaps the lists for the map and back, keeping the filters and legend (as in the mock)', () => {
  installFakeDom();
  const tab = peopleTab(vm(), { you: { name: 'Astra' } });
  tab.querySelector('[data-value="map"]').click();
  assert.ok(tab.querySelector('.castmap'));
  assert.ok(!tab.querySelector('.fil').hidden);
  assert.ok(!tab.querySelector('.legend').hidden);
  assert.equal(tab.querySelectorAll('.cmw').length, 7);
  assert.match(tab.querySelector('.castmap .fine').textContent, /Closer to Astra = warmer/);
  tab.querySelector('[data-value="list"]').click();
  assert.equal(tab.querySelector('.castmap'), null);
  assert.ok(!tab.querySelector('.fil').hidden);
});

test('on the map, lens, pick and focus redraw in place, and Open dossier goes to the person', () => {
  installFakeDom();
  const went = [];
  const tab = peopleTab(vm(), { go: (t, a) => went.push([t, a]) });
  tab.querySelector('[data-value="map"]').click();
  tab.querySelector('[data-value="tension"]').click();
  assert.equal(tab.querySelector('.castmap').dataset.lens, 'tension');
  tab.querySelector('[data-person-id="brann"]').click();
  assert.equal(tab.querySelector('.mcard').dataset.picked, 'brann');
  tab.querySelector('[data-act="focus"]').click();
  assert.match(tab.querySelector('.fchip').textContent, /Focus: Brann/);
  tab.querySelector('.fchip').click();
  assert.equal(tab.querySelector('.fchip'), null);
  tab.querySelector('[data-person-id="brann"]').click();
  assert.equal(tab.querySelector('.mcard').dataset.picked, undefined);
  tab.querySelector('[data-person-id="brann"]').click();
  tab.querySelector('[data-act="open"]').click();
  assert.deepEqual(went, [['people', { personId: 'brann' }]]);
});

test('an empty chat says no one is here and still renders; an unknown filter falls back to All', () => {
  installFakeDom();
  const tab = peopleTab(vm('empty'), {});
  assert.match(tab.querySelector('.fine').textContent, /No one here/);
  assert.equal(tab.querySelector('.cnt').textContent, '0 known');
  assert.ok(peopleTab({ filter: 'bogus' }, {}).querySelector('[data-filter="all"]'));
  assert.ok(peopleTab(undefined, {}));
});

test('selectPeople splits by filter and search without touching the view-model', () => {
  const data = vm();
  const frozen = structuredClone(data);
  assert.deepEqual(selectPeople(data, 'all').sections.map(s => s.kind), ['here', 'elsewhere']);
  assert.deepEqual(selectPeople(data, 'party').sections[0].people.map(x => x.p.personId), ['torka', 'brann']);
  assert.deepEqual(selectPeople(data, 'deceased').sections[0].people.map(x => x.kind), ['deceased', 'deceased']);
  assert.equal(selectPeople(data, 'all', 'Captain').found, true);
  assert.equal(selectPeople(data, 'all', '  ').found, false);
  assert.deepEqual(selectPeople({}, 'all').sections, []);
  assert.deepEqual(data, frozen);
});
