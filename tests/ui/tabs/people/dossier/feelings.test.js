import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/dom.js';
import { feelingsHero, withPage } from '../../../../../ui/tabs/people/dossier/feelings.js';
import { dossier } from './helpers.js';

test('the hero has the ring, four corner numbers with signs, and a Profile › button', () => {
  installFakeDom();
  const opened = [];
  const hero = feelingsHero(dossier('temiwa'), { onProfile: () => opened.push('profile') });
  assert.ok(hero.querySelector('svg.ring'));
  const corners = hero.querySelectorAll('.ml');
  assert.deepEqual(corners.map(c => c.dataset.meter), ['trust', 'affection', 'desire', 'tension']);
  assert.match(corners[0].textContent, /^\+\d+TRUST$/);
  hero.querySelector('.bigph').click();
  assert.deepEqual(opened, ['profile']);
  assert.match(hero.querySelector('.prof').textContent, /Profile/);
});

test('the dead get the portrait only: no ring and no corner numbers', () => {
  installFakeDom();
  const hero = feelingsHero(dossier('marro'));
  assert.equal(hero.querySelector('svg.ring'), null);
  assert.equal(hero.querySelectorAll('.ml').length, 0);
  assert.ok(hero.classList.contains('dead'));
  assert.ok(feelingsHero({ life: 'alive' }));
});

test('With page: four meter rows, the stage and what it needs, and every change with held-back marked', () => {
  installFakeDom();
  const [rows, stage, changes] = withPage(dossier('temiwa'));
  assert.equal(rows.querySelectorAll('.mrow').length, 4);
  assert.match(stage.querySelector('.secl').textContent, /Stage · Acquaintance → Friend/);
  assert.match(stage.querySelector('.fine').textContent, /needs Trust 30/);
  assert.equal(changes.querySelectorAll('.e').length, 4);
  assert.match(changes.querySelector('.e').textContent, /Goldwane 13Trust \+2 · you handed back/);
  const torka = withPage(dossier('torka'));
  assert.match(torka[2].textContent, /held back/);
  assert.match(torka[2].textContent, /Affection \+1/);
});

test('With page without a stage or changes says nothing has changed, and a negative meter draws left of centre', () => {
  installFakeDom();
  const d = dossier('rika');
  d.meters.tension = -20;
  const parts = withPage(d);
  assert.equal(parts.length, 3);
  assert.match(parts[2].textContent, /Nothing has changed yet/);
  const bar = parts[0].querySelector('[data-meter="tension"] .fill');
  assert.equal(bar.style.getPropertyValue('left'), '40%');
  assert.equal(bar.style.getPropertyValue('width'), '10%');
  assert.equal(parts[0].querySelector('[data-meter="tension"] > b').textContent, '-20');
});
