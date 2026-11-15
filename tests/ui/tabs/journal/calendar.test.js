import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/dom.js';
import { buildJournal } from '../../../../ui/fixtures/journal.js';
import { calendarCard } from '../../../../ui/tabs/journal/calendar.js';

const type = (card, text) => {
  const input = card.querySelector('.psrch');
  input.value = text;
  input.dispatch('input');
};

test('opens on today: month title, grid with weekday offset, today marked, today selected', () => {
  installFakeDom();
  const card = calendarCard(buildJournal());
  assert.match(card.querySelector('.mtitle').textContent, /Goldwane\s+CY 611/);
  assert.equal(card.querySelectorAll('.cd').length, 30);
  assert.equal(card.querySelectorAll('.cgrid .wd').length, 7);
  assert.equal(card.querySelector('.cd.today b').textContent, '13');
  assert.equal(card.querySelector('.cd.sel b').textContent, '13');
  assert.equal(card.querySelector('.tdy'), null);
  assert.match(card.querySelector('.dph').textContent, /Goldwane 13/);
  assert.equal(card.querySelectorAll('.clegend span').length, 4);
});

test('record and due dots show on their days; days before the start are dimmed; past days are plain', () => {
  installFakeDom();
  const card = calendarCard(buildJournal());
  const cell = d => card.querySelector(`.cd[data-sel="6,${d}"]`);
  assert.equal(cell(9).querySelectorAll('.dot-rec').length, 1);
  assert.equal(cell(14).querySelectorAll('.dot-warn').length, 1);
  assert.equal(cell(12).querySelectorAll('.dot-bad').length, 1);
  assert.equal(cell(16).querySelectorAll('.dot-info').length, 1);
  assert.equal(cell(5).classList.contains('pre'), true);
  assert.equal(cell(9).classList.contains('pre'), false);
  assert.equal(cell(9).classList.contains('past'), true);
  assert.match(cell(14).getAttribute('aria-label'), /Goldwane 14, something due/);
});

test('picking a day fills the panel and offers Today; Today returns', () => {
  installFakeDom();
  const card = calendarCard(buildJournal());
  card.querySelector('.cd[data-sel="6,10"]').click();
  assert.match(card.querySelector('.dph').textContent, /Goldwane 10/);
  assert.equal(card.querySelector('.cd.sel b').textContent, '10');
  card.querySelector('.tdy').click();
  assert.match(card.querySelector('.dph').textContent, /Goldwane 13/);
  assert.equal(card.querySelector('.tdy'), null);
});

test('month arrows move, stop at the ends, and selectDay jumps months', () => {
  installFakeDom();
  const card = calendarCard(buildJournal());
  card.querySelectorAll('.pb')[1].click();
  assert.match(card.querySelector('.mtitle').textContent, /Thawmonth/);
  assert.equal(card.querySelector('.tdy') !== null, true);
  card.querySelectorAll('.pb')[0].click();
  card.querySelectorAll('.pb')[0].click();
  assert.match(card.querySelector('.mtitle').textContent, /Harvestide/);
  card.selectDay(6, 16);
  assert.match(card.querySelector('.mtitle').textContent, /Goldwane/);
  assert.equal(card.querySelector('.cd.sel b').textContent, '16');
  card.selectDay(0, 1);
  assert.equal(card.querySelectorAll('.pb')[0].hasAttribute('disabled'), true);
});

test('the month picker steps years, jumps to a month, and marks dimmed and current months', () => {
  installFakeDom();
  const card = calendarCard(buildJournal());
  card.querySelector('.mtitle').click();
  assert.equal(card.querySelector('.mtitle').getAttribute('aria-expanded'), 'true');
  assert.equal(card.querySelectorAll('.mo').length, 10);
  assert.match(card.querySelector('.ystep b').textContent, /CY 611/);
  assert.equal(card.querySelector('.mo.now b').textContent, 'Goldwane');
  assert.equal(card.querySelector('.mo[data-goto-month="5"]').classList.contains('pre'), true);
  assert.equal(card.querySelectorAll('.mo i').length >= 1, true);
  card.querySelectorAll('.ystep .pb')[1].click();
  assert.match(card.querySelector('.ystep b').textContent, /CY 612/);
  card.querySelectorAll('.ystep .pb')[0].click();
  card.querySelector('.mo[data-goto-month="7"]').click();
  assert.match(card.querySelector('.mtitle').textContent, /Thawmonth/);
  assert.equal(card.querySelector('.mpick'), null);
});

test('year steps are disabled at the first and last year', () => {
  installFakeDom();
  const card = calendarCard(buildJournal());
  card.querySelector('.mtitle').click();
  assert.equal(card.querySelectorAll('.ystep .pb')[0].hasAttribute('disabled'), true);
  card.selectDay(46, 1);
  card.querySelector('.mtitle').click();
  assert.equal(card.querySelectorAll('.ystep .pb')[1].hasAttribute('disabled'), true);
});

test('search finds days by record text, picking a hit closes the search, and no match says so', () => {
  installFakeDom();
  const card = calendarCard(buildJournal());
  type(card, '  MARRO ');
  assert.equal(card.querySelector('.secl2').textContent, 'Found on 1 day');
  assert.equal(card.querySelector('.cd'), null);
  type(card, 'temiwa');
  assert.equal(card.querySelector('.secl2').textContent, 'Found on 2 days');
  card.querySelectorAll('.hit')[1].click();
  assert.equal(card.querySelector('.psrch').value, '');
  assert.match(card.querySelector('.dph').textContent, /Goldwane (11|9)/);
  type(card, 'zzzz');
  assert.match(card.textContent, /Nothing found/);
  type(card, '');
  assert.equal(card.querySelectorAll('.cd').length, 30);
});
