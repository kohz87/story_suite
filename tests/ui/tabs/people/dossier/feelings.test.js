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

test('With part: every change with its date and reply first (held-back ones marked, with their Why), then four meter rows and the stage', () => {
  installFakeDom();
  const [changes, rows, stage] = withPage(dossier('temiwa'));
  assert.equal(changes.querySelector('.secl').textContent, 'Last changes');
  const evs = changes.querySelectorAll('.ev');
  assert.equal(evs.length, 5);
  assert.equal(evs[0].textContent, 'Goldwane 13reply #14Trust +2 · you handed back the offering coin she dropped');
  assert.equal(evs[2].querySelector('.held').textContent, 'Desire +1 held back');
  assert.equal(evs[2].querySelector('.why').textContent, 'Why: too soon after meeting; the story has not given her a reason yet');
  assert.equal(rows.querySelectorAll('.mrow').length, 4);
  assert.match(stage.querySelector('.secl').textContent, /Stage · Acquaintance → Friend/);
  assert.match(stage.querySelector('.fine').textContent, /needs Trust 30/);
  const torka = withPage(dossier('torka'));
  assert.match(torka[0].textContent, /held back/);
  assert.match(torka[0].textContent, /Affection \+1/);
});

test('With page without a stage or changes says nothing has changed, and a negative meter draws left of centre', () => {
  installFakeDom();
  const d = dossier('rika');
  d.meters.tension = -20;
  const parts = withPage(d);
  assert.equal(parts.length, 3);
  assert.match(parts[0].textContent, /Nothing has changed yet/);
  const bar = parts[1].querySelector('[data-meter="tension"] .fill');
  assert.equal(bar.style.getPropertyValue('left'), '40%');
  assert.equal(bar.style.getPropertyValue('width'), '10%');
  assert.equal(parts[1].querySelector('[data-meter="tension"] > b').textContent, '-20');
});
