import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../packages/story-block/tests/ui-fake-dom.js';
import { searchRows, renderSearchResults } from '../../../ui/settings/search.js';
import { buildSettings } from '../../../ui/fixtures/settings.js';

const { sections } = buildSettings();

test('blank or missing queries find nothing', () => {
  assert.deepEqual(searchRows(sections, ''), []);
  assert.deepEqual(searchRows(sections, '   '), []);
  assert.deepEqual(searchRows(sections, undefined), []);
  assert.deepEqual(searchRows(undefined, 'skin'), []);
});

test('matches label, hint, group and section name, all words, any case', () => {
  const skin = searchRows(sections, 'SKIN');
  assert.ok(skin.some(h => h.row.key === 'look.skin'));
  assert.ok(skin.every(h => h.section.id === 'look'));
  const hint = searchRows(sections, 'see-through');
  assert.deepEqual(hint.map(h => h.row.key), ['look.glass']);
  const both = searchRows(sections, 'dormant seen');
  assert.deepEqual(both.map(h => h.row.key), ['people.dormant']);
  assert.deepEqual(searchRows(sections, 'dormant zzzz'), []);
  assert.ok(searchRows(sections, 'director').some(h => h.row.key === 'director.pulse'));
});

test('hits come in section order and keep the section reference', () => {
  const hits = searchRows(sections, 'tokens');
  assert.ok(hits.length === 0 || hits.every(h => h.section && h.row));
  const days = searchRows(sections, 'story days');
  assert.deepEqual(days.map(h => h.row.key), ['world.dueSoon', 'world.lookAhead']);
  const order = searchRows(sections, 'a').map(h => sections.indexOf(h.section));
  assert.deepEqual(order, [...order].sort((x, y) => x - y));
});

test('results page shows the count, a Section › Group title and the rows', () => {
  installFakeDom();
  const hits = searchRows(sections, 'pulse');
  const page = renderSearchResults(hits, ' pulse ', { onChange: () => {} });
  assert.equal(page.querySelector('.sdesc').textContent, `${hits.length} settings for “pulse”`);
  const first = page.querySelector('.sgrp');
  assert.equal(first.querySelector('.gt').textContent, 'Director › World pulse');
  assert.equal(first.querySelectorAll('.srow').length, 1);
});

test('one hit says "1 setting", none says "Nothing found."', () => {
  installFakeDom();
  const one = renderSearchResults(searchRows(sections, 'see-through'), 'see-through');
  assert.equal(one.querySelector('.sdesc').textContent, '1 setting for “see-through”');
  const none = renderSearchResults([], 'qqq');
  assert.equal(none.querySelector('.sdesc').textContent, '0 settings for “qqq”');
  assert.equal(none.querySelector('.fine').textContent, 'Nothing found.');
  assert.equal(none.querySelectorAll('.srow').length, 0);
});
