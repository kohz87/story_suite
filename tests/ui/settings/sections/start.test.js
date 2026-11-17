import test from 'node:test';
import assert from 'node:assert/strict';
import { mountSettings } from './mount.js';
import { buildSettings } from '../../../../ui/fixtures/settings.js';
import { renderStartSection, sectionFrame } from '../../../../ui/settings/sections/start.js';

test('Start shows scope, three presets (Full pressed, as in the mock), five collapsed module blocks, the removed list and one Reset', () => {
  const { page } = mountSettings();
  const el = page('start');
  assert.equal(el.querySelectorAll('.pre').length, 3);
  assert.equal(el.querySelector('.pre[aria-pressed="true"] b').textContent, 'Full');
  assert.equal(el.querySelector('.custom'), null);
  assert.equal(el.querySelectorAll('.mod').length, 5);
  assert.equal(el.querySelectorAll('.msubs').length, 0);
  assert.equal(el.querySelectorAll('.removed li').length, 10);
  assert.equal(el.querySelectorAll('.btn2').filter(b => b.textContent === 'Reset to Standard').length, 1);
  assert.equal(el.querySelectorAll('.applies').length, 0);
  assert.match(el.querySelector('.mod[data-mod="rpg"] .mc').textContent, /^3 of 3 on · ≈ 520 tokens$/);
});

test('Features opens the switches, a switch change marks Custom and emits the path', () => {
  const { page, calls } = mountSettings();
  page('start').querySelector('.mod[data-mod="people"] .lnk').click();
  const el = page('start');
  assert.equal(el.querySelectorAll('.mod[data-mod="people"] .msubs .srow').length, 9);
  el.querySelector('[data-sub="people:feelingsDriftEachStoryDay"]').click();
  assert.deepEqual(calls.at(-1), ['c', 'modules.chat.people.feelingsDriftEachStoryDay', true]);
  const after = page('start');
  assert.ok(after.querySelector('.custom'));
  assert.equal(after.querySelector('.pre[aria-pressed="true"]'), null);
});

test('a preset emits modules.preset; the scope switch swaps to the New chats set', () => {
  const { page, calls } = mountSettings({ modules: buildSettings({ rpg: false }).modules });
  assert.equal(page('start').querySelector('.mod[data-mod="rpg"]').className, 'mod off');
  page('start').querySelector('.pre[data-pre="lean"]').click();
  assert.deepEqual(calls.at(-1), ['a', 'modules.preset', 'lean']);
  assert.equal(page('start').querySelector('.pre[aria-pressed="true"] b').textContent, 'Lean');
  page('start').querySelector('.scope .seg button[data-value="newChats"]').click();
  assert.equal(page('start').querySelector('.mod[data-mod="rpg"]').className, 'mod');
  page('start').querySelectorAll('.btn2').find(b => b.textContent === 'Reset to Standard').click();
  assert.deepEqual(calls.at(-1), ['a', 'modules.reset', 'Reset to Standard']);
});

test('the scope label names the chat from the subtitle', () => {
  const { page } = mountSettings({ subtitle: 'this chat: Marsh · Ana' });
  assert.match(page('start').querySelector('.scope .seg button').textContent, /^This chat · Marsh$/);
});

test('a module switch on Start shows on its own page (one shared module state); needs lines show ok or (off)', () => {
  const { page } = mountSettings();
  page('start').querySelector('.mod[data-mod="director"] .lnk').click();
  page('start').querySelector('[data-sub="director:checks"]').click();
  page('start').querySelector('.mod[data-mod="people"] .lnk').click();
  assert.equal(page('start').querySelector('.mod[data-mod="people"] .needbad').textContent, 'needs Checks (Director) (off)');
  assert.ok(page('start').querySelector('.needok'));
  page('start').querySelector('.mod[data-mod="people"] .mh .sw').click();
  const el = page('start');
  assert.equal(el.querySelector('.mod[data-mod="people"]').className, 'mod off');
  assert.ok(el.querySelector('.mod[data-mod="people"] .srow').className.includes('dis'));
  assert.equal(el.querySelector('.mod[data-mod="people"] .mc').textContent, 'off');
  assert.equal(page('people').querySelector('.mod').className, 'mod off');
});

test('Settings › goes to the module page', () => {
  const { page, ov } = mountSettings();
  page('start').querySelector('.mod[data-mod="world"] [data-sec="world"]').click();
  assert.equal(ov.el.querySelector('.spage h2').textContent, 'World and time');
});

test('sectionFrame puts the hook notes around the overlay body; no body gives only the notes', () => {
  const sec = { id: 'x' };
  assert.deepEqual(sectionFrame(sec, { body: () => ['b'] }, { before: ['a'], after: ['c'] }), ['a', 'b', 'c']);
  assert.deepEqual(sectionFrame(sec, {}, { after: ['c'] }), ['c']);
  assert.deepEqual(renderStartSection(sec, { body: () => ['b'] }), ['b']);
});

test('with no New chats set stored, Start has no scope switch and says the switches apply to every chat; a section page says the same', () => {
  const modules = { ...buildSettings().modules, newChats: {} };
  const { page } = mountSettings({ modules });
  const el = page('start');
  assert.equal(el.querySelector('.scope .seg'), null);
  assert.match(el.querySelector('.scope').textContent, /apply to every chat/);
  assert.match(page('people').querySelector('.applies').textContent, /apply to every chat/);
  assert.doesNotMatch(page('people').querySelector('.applies').textContent, /new-chat defaults/);
});
