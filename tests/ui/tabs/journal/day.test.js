import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/dom.js';
import { buildJournal } from '../../../../ui/fixtures/journal.js';
import { dayPanel, dayDistance, dayRecord, dueOn } from '../../../../ui/tabs/journal/day.js';

const J = () => buildJournal();

test('dayDistance counts across month lengths both ways', () => {
  const cal = J().calendar;
  assert.equal(dayDistance(cal, 6, 13), 0);
  assert.equal(dayDistance(cal, 6, 16), 3);
  assert.equal(dayDistance(cal, 7, 2), 19);
  assert.equal(dayDistance(cal, 5, 28), -15);
  assert.equal(dayDistance(cal, 6, 9), -4);
  assert.equal(dayDistance(undefined, 3, 4), 0);
});

test('dayRecord and dueOn find by month and day', () => {
  const j = J();
  assert.equal(dayRecord(j, 6, 13).day, 13);
  assert.equal(dayRecord(j, 6, 20), null);
  assert.equal(dayRecord(null, 6, 1), null);
  assert.deepEqual(dueOn(j, 6, 14).map(u => u.name), ['Word to the harbour']);
  assert.deepEqual(dueOn(j, 1, 1), []);
});

test('a past day shows the record in order with no times and no plan', () => {
  installFakeDom();
  const el = dayPanel(J(), 6, 9);
  assert.match(el.querySelector('.dph').textContent, /Goldwane 9/);
  assert.match(el.querySelector('.dph small').textContent, /4 days ago/);
  const secs = el.querySelectorAll('.dsec').map(s => s.dataset.sec);
  assert.deepEqual(secs, ['What happened', 'Places', 'Stage moves', 'Who you met']);
  assert.match(el.textContent, /Sister Temiwa · Trust: Stranger → Acquaintance/);
  assert.equal(el.querySelector('.sum2').textContent, J().days[4].line);
  assert.equal(/\d:\d\d/.test(el.textContent), false);
});

test('today lists the record then the plan then what is due', () => {
  installFakeDom();
  const el = dayPanel(J(), 6, 13);
  const secs = el.querySelectorAll('.dsec').map(s => s.dataset.sec);
  assert.equal(secs.at(-1), 'Planned');
  assert.equal(secs[0], 'What happened');
  assert.ok(secs.includes('Money') && secs.includes('Quests') && secs.includes('News'));
  assert.match(el.querySelector('.dph small').textContent, /today/);
  assert.match(el.textContent, /Trip to Auvoth · planned/);
});

test('a future day shows due first, a late day says Was due, and an empty day says so', () => {
  installFakeDom();
  const j = J();
  const soon = dayPanel(j, 6, 14);
  assert.equal(soon.querySelector('.dsec').dataset.sec, 'Due and expected');
  assert.match(soon.querySelector('.dph small').textContent, /tomorrow/);
  assert.equal(dayPanel(j, 6, 12).querySelectorAll('.dsec').map(s => s.dataset.sec).includes('Was due'), true);
  assert.match(dayPanel(j, 6, 20).textContent, /Nothing known for this day yet/);
  assert.match(dayPanel(j, 6, 11).querySelector('.sum2').textContent, /Goldwane 11/);
  assert.match(dayPanel(j, 6, 5).textContent, /Before the story began/);
  assert.match(dayPanel(j, 6, 7).textContent, /Before the story began/);
});

test('another year shows the era and year, and an empty past day says nothing recorded', () => {
  installFakeDom();
  const j = J();
  j.calendar.start = null;
  assert.match(dayPanel(j, 16, 2).querySelector('.dph small').textContent, /CY 612/);
  assert.match(dayPanel(j, 6, 1).textContent, /Nothing recorded on this day/);
  j.days = [];
  assert.match(dayPanel(j, 6, 13).textContent, /Planned/);
  assert.equal(dayPanel(j, 6, 13).querySelector('.sum2'), null);
});
