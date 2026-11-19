import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/dom.js';
import { nowPage, moodPage } from '../../../../../ui/tabs/people/dossier/now-page.js';
import { dossier, makeCtx } from './helpers.js';

// (each fact is its own titled section: its title, then its text)
const rows = el => Object.fromEntries(el.querySelectorAll('.dpsec').map(sec => [sec.querySelector('.secl').textContent, sec.querySelector('p').textContent]));

test('Right now for someone in the scene lists where, doing, wearing and thinking', () => {
  installFakeDom();
  const page = nowPage(dossier('temiwa'), makeCtx());
  const r = rows(page);
  assert.ok(r.Where && r.Doing && r.Wearing);
  assert.deepEqual(Object.keys(r).slice(0, 3), ['Where', 'Doing', 'Wearing']);
});

test('Right now for someone away shows last place, last seen and what they said', () => {
  installFakeDom();
  const page = nowPage(dossier('rika'), makeCtx());
  const r = rows(page);
  assert.deepEqual(Object.keys(r).slice(0, 2), ['Last known place', 'Last seen']);
  assert.equal(page.querySelector('.spo'), null);
});

test('Wants and Hiding stay hidden until the shared scene switch is on, and the switch writes the pref', () => {
  installFakeDom();
  const ctx = makeCtx();
  const d = dossier('temiwa');
  assert.ok(d.scene, 'fixture has a scene');
  const page = nowPage(d, ctx);
  assert.equal(page.querySelectorAll('.scene-rows .hid').length, 2);
  assert.doesNotMatch(page.textContent, new RegExp(d.scene.wants.slice(0, 12)));
  page.querySelector('.sw').click();
  assert.equal(ctx.prefs.getSpoiler('scene'), true);
  assert.equal(page.querySelectorAll('.scene-rows .hid').length, 0);
  assert.match(page.textContent, new RegExp(d.scene.hiding.slice(0, 12)));
});

test('the switch starts on when the pref is already on, and works without prefs', () => {
  installFakeDom();
  const ctx = makeCtx();
  ctx.prefs.setSpoiler('scene', true);
  const d = dossier('temiwa');
  assert.equal(nowPage(d, ctx).querySelectorAll('.scene-rows .hid').length, 0);
  const bare = nowPage(d, {});
  bare.querySelector('.sw').click();
  assert.equal(bare.querySelectorAll('.scene-rows .hid').length, 0);
  assert.ok(nowPage({}, {}));
});

const wrap = parts => { const el = document.createElement('div'); el.append(...parts); return el; };

test('Mood part shows the word, or a dash and a note when there is none', () => {
  installFakeDom();
  assert.equal(wrap(moodPage({ mood: 'wary' })).querySelector('.bigw').textContent, 'Wary');
  const none = wrap(moodPage({ mood: null }));
  assert.equal(none.querySelector('.bigw').textContent, '—');
  assert.match(none.textContent, /No mood/);
  assert.doesNotMatch(none.textContent, /Recent changes/);
});

test('Mood part lists the recent changes: date, reply, the axes moved and the recorded reason; no reason is invented', () => {
  installFakeDom();
  const el = wrap(moodPage({ mood: 'tired', moodChanges: [
    { reply: 5, date: 'Oct 1, 10:00', moves: [{ axis: 'energy', delta: -1 }], why: 'a long morning at the counter' },
    { reply: null, date: 'Oct 1, 08:45', moves: [{ axis: 'feeling', delta: 1 }, { axis: 'control', delta: -1 }], why: '' },
  ] }));
  const rows = el.querySelectorAll('.ev');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].querySelector('.w').textContent, 'Oct 1, 10:00reply #5');
  assert.equal(rows[0].querySelector('p').textContent, 'Energy −1 · a long morning at the counter');
  assert.equal(rows[1].querySelector('.w').textContent, 'Oct 1, 08:45', 'no reply known: the date only');
  assert.equal(rows[1].querySelector('p').textContent, 'Feeling +1 · Control −1', 'no reason recorded: none shown');
  assert.match(wrap(moodPage({ mood: 'tired' })).textContent, /No change recorded yet/);
});
