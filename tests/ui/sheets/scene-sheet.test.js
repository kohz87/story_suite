import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../helpers/dom.js';
import { createBackStack } from '../../../ui/runtime/back-stack.js';
import { createFakePort } from '../../../ui/port/fake-port.js';
import { MOMENT } from '../../../ui/fixtures/moment.js';
import { dateLine, scenePatch, sceneSheet, openSceneSheet } from '../../../ui/sheets/scene-sheet.js';

const scene = MOMENT.scene;
const here = ['Sister Temiwa', 'Torka'];
const same = () => ({ date: 'Goldwane 13, Fourthday', time: '9:30 am', place: 'Guild Office, Bluewatch', weather: 'cold drizzle, chilly', who: [...here] });
const flush = () => new Promise(resolve => setImmediate(resolve));

test('dateLine joins date and weekday, and copes with missing parts', () => {
  assert.equal(dateLine(scene), 'Goldwane 13, Fourthday');
  assert.equal(dateLine({ date: 'Goldwane 13' }), 'Goldwane 13');
  assert.equal(dateLine(), '');
});

test('scenePatch returns only what changed', () => {
  assert.deepEqual(scenePatch(scene, same(), here), {});
  assert.deepEqual(scenePatch(scene, { ...same(), time: ' 10:00 am ', weather: '' }, here), { time: '10:00 am', weather: '' });
  assert.deepEqual(scenePatch(scene, { ...same(), date: 'Goldwane 14, Fifthday' }, here), { date: 'Goldwane 14, Fifthday' });
});

test('scenePatch reports people added and removed, and ignores missing keys and a bad list', () => {
  const values = { ...same(), who: ['Torka', 'Oyla'] };
  assert.deepEqual(scenePatch(scene, values, here), { who: { add: ['Oyla'], remove: ['Sister Temiwa'] } });
  assert.deepEqual(scenePatch(scene, { time: '9:30 am' }, here), {});
  assert.deepEqual(scenePatch(scene, { who: 'x' }, here), {});
  assert.deepEqual(scenePatch(undefined, {}, undefined), {});
});

test('the form shows the scene values, who is here, and the note', () => {
  installFakeDom();
  const el = sceneSheet(scene, here, {});
  assert.equal(el.getAttribute('aria-label'), 'Scene');
  const inputs = el.querySelectorAll('input');
  assert.equal(inputs.length, 5);
  assert.equal(inputs[0].value, 'Goldwane 13, Fourthday');
  assert.equal(inputs[2].value, 'Guild Office, Bluewatch');
  assert.equal(el.querySelectorAll('.who > span').length, 2);
  assert.match(el.querySelector('.fine').textContent, /shows in This reply as yours/);
  assert.equal(el.querySelector('.who-in').hasAttribute('hidden'), true);
});

test('× removes a person, + Add reveals a name box, Enter or + Add again adds it, and a duplicate or blank is ignored', () => {
  installFakeDom();
  const saved = [];
  const el = sceneSheet(scene, here, { onSave: p => saved.push(p) });
  el.querySelector('[aria-label="Remove Torka"]').click();
  assert.equal(el.querySelectorAll('.who > span').length, 1);
  el.querySelector('.add').click();
  assert.equal(el.querySelector('.who-in').hasAttribute('hidden'), false);
  el.querySelector('.who-in').value = 'Oyla';
  el.querySelector('.who-in').dispatch('keydown', { key: 'x' });
  el.querySelector('.who-in').dispatch('keydown', { key: 'Enter' });
  assert.equal(el.querySelectorAll('.who > span').length, 2);
  el.querySelector('.add').click();
  el.querySelector('.who-in').value = 'Oyla';
  el.querySelector('.add').click();
  el.querySelector('.add').click();
  el.querySelector('.who-in').value = '  ';
  el.querySelector('.add').click();
  assert.equal(el.querySelectorAll('.who > span').length, 2);
  el.querySelector('.save').click();
  assert.deepEqual(saved, [{ who: { add: ['Oyla'], remove: ['Torka'] } }]);
});

test('Save sends the edited text; Cancel and × call onClose', () => {
  installFakeDom();
  const saved = [];
  let closed = 0;
  const el = sceneSheet(scene, here, { onSave: p => saved.push(p), onClose: () => { closed += 1; } });
  el.querySelectorAll('input')[1].value = '11:00 am';
  el.querySelector('.save').click();
  assert.deepEqual(saved, [{ time: '11:00 am' }]);
  el.querySelector('.cancel').click();
  el.querySelector('.x').click();
  assert.equal(closed, 2);
  sceneSheet().querySelector('.save').click();
});

test('openSceneSheet sends scene.correct once on Save, closes, and sends nothing when unchanged or cancelled', async () => {
  installFakeDom();
  const port = createFakePort();
  const backStack = createBackStack();
  let refreshed = 0;
  const ctx = { port, backStack, refresh: () => { refreshed += 1; } };
  openSceneSheet(ctx, scene, here);
  assert.equal(backStack.hasLayer('sheet'), true);
  globalThis.document.body.querySelectorAll('input')[2].value = 'Docks';
  globalThis.document.body.querySelector('.save').click();
  await flush();
  assert.deepEqual(port.recorded.map(r => [r.type, r.payload]), [['scene.correct', { place: 'Docks' }]]);
  assert.equal(globalThis.document.body.querySelector('.sh-ov'), null);
  assert.equal(refreshed, 1);
  openSceneSheet(ctx, scene, here);
  globalThis.document.body.querySelector('.save').click();
  await flush();
  assert.equal(port.recorded.length, 1);
  openSceneSheet({ command: () => {} }, scene, here);
  globalThis.document.body.querySelector('.cancel').click();
  assert.equal(globalThis.document.body.querySelector('.sh-ov'), null);
  openSceneSheet({}, scene).close();
});
