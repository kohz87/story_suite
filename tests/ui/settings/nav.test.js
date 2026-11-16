import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { createNav } from '../../../ui/settings/nav.js';
import { buildSettings } from '../../../ui/fixtures/settings.js';

const { sections } = buildSettings();

test('the side nav lists sections under Play, Rules, Setup and Tools in order', () => {
  installFakeDom();
  const nav = createNav(sections);
  assert.deepEqual(nav.side.querySelectorAll('.grpl').map(n => n.textContent), ['Play', 'Rules', 'Setup', 'Tools']);
  assert.equal(nav.side.querySelectorAll('button.si3').length, sections.length);
  assert.equal(nav.side.querySelector('button.si3').textContent, '◎Start');
  assert.equal(nav.side.querySelector('input').getAttribute('placeholder'), 'Search settings…');
});

test('the phone list shows name, description and a chevron per section, with its own search box', () => {
  installFakeDom();
  const nav = createNav(sections);
  const first = nav.list.querySelector('.slist button');
  assert.equal(first.querySelector('b').textContent, 'Start');
  assert.equal(first.querySelector('small').textContent, sections[0].desc);
  assert.equal(nav.list.querySelectorAll('.slist button').length, sections.length);
  assert.equal(nav.list.querySelectorAll('.secl2').length, 4);
  assert.ok(nav.list.querySelector('input.psrch'));
});

test('picking reports the id and where it came from', () => {
  installFakeDom();
  const picks = [];
  const nav = createNav(sections, { onPick: (id, via) => picks.push([id, via]) });
  nav.side.querySelector('button[data-sec="rpg"]').click();
  nav.list.querySelector('button[data-sec="world"]').click();
  assert.deepEqual(picks, [['rpg', 'side'], ['world', 'list']]);
});

test('setCurrent marks one section and clears all when null', () => {
  installFakeDom();
  const nav = createNav(sections);
  nav.setCurrent('look');
  const cur = () => nav.side.querySelectorAll('button.si3').filter(b => b.getAttribute('aria-current') === 'true').map(b => b.dataset.sec);
  assert.deepEqual(cur(), ['look']);
  nav.setCurrent('tools');
  assert.deepEqual(cur(), ['tools']);
  nav.setCurrent(null);
  assert.deepEqual(cur(), []);
});

test('typing in either box reports the text, and setQuery syncs both boxes', () => {
  installFakeDom();
  const typed = [];
  const nav = createNav(sections, { onQuery: t => typed.push(t) });
  const boxes = [nav.side.querySelector('input'), nav.list.querySelector('input')];
  boxes[0].value = 'sk'; boxes[0].dispatch('input');
  boxes[1].value = 'skin'; boxes[1].dispatch('input');
  assert.deepEqual(typed, ['sk', 'skin']);
  nav.setQuery('pace');
  assert.deepEqual(boxes.map(b => b.value), ['pace', 'pace']);
  nav.setQuery(null);
  assert.deepEqual(boxes.map(b => b.value), ['', '']);
});

test('sections with an unknown group are left out and an empty list still builds', () => {
  installFakeDom();
  const nav = createNav([{ id: 'x', group: 'Other', name: 'X', desc: '' }]);
  assert.equal(nav.side.querySelectorAll('button.si3').length, 0);
  assert.equal(createNav().side.querySelectorAll('.grpl').length, 0);
});
