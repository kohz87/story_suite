// The Settings › Director page on a real host (story-block + story-director): every row reads the live value, a change writes the key the old view writes, and the page renders.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { storyDirectorModule } from '../../../ui/legacy/director/module.js';
import { createSbPort } from '../../../ui/port/sb-port.js';
import { buildSelectors } from '../../../ui/select/build.js';
import { selectDirector } from '../../../ui/select/settings-director.js';
import { DIRECTOR_ROWS } from '../../../ui/select/director-rows.js';
import { checkShape } from '../../../ui/contract/shapes.js';
import { SETTINGS_SHAPE } from '../../../ui/contract/settings.js';

const D = 'story-director';
async function live(t) {
  t.mock.method(console, 'warn', () => {});
  const host = await createHost({ modules: [storyDirectorModule] });
  t.after(() => host.close());
  const writes = { settings: { set: (id, key, value) => host.settings.set(id, key, value) } };
  const port = createSbPort({ sdk: host.sdk, writes, selectors: buildSelectors(() => null, host.sdk) });
  return { host, port };
}
const rowOf = (port, key) => port.view('settings').sections.find(s => s.id === 'director').rows.find(r => r.key === key);

test('the Director section has the rows of the mock that a real setting backs, with the live values and the shape the contract wants', async t => {
  const { host, port } = await live(t);
  const vm = port.view('settings');
  assert.deepEqual(checkShape(vm, SETTINGS_SHAPE), []);
  const rows = vm.sections.find(s => s.id === 'director').rows;
  assert.deepEqual(rows.map(r => r.key), DIRECTOR_ROWS.filter(r => r.module === D).map(r => r.key));
  const stored = host.sdk.settings(D);
  assert.equal(rowOf(port, 'director.defaultDc').value, stored['checks.defaultDc']);
  assert.equal(rowOf(port, 'director.pulse').value, 'Lively');
  assert.equal(rowOf(port, 'director.when').value, 'When I ask');
  assert.equal(rowOf(port, 'director.faces').value, '1 a day');
  assert.equal(rowOf(port, 'director.maxTokens').unit, 'tokens');
});

test('a change writes the same stored value as the old view (settings.set(moduleId, key, value)) and the row then reads it', async t => {
  const { host, port } = await live(t);
  const cases = [['director.defaultDc', 12, 'checks.defaultDc', 12], ['director.pulse', 'Quiet', 'pulse.mode', 'quiet'], ['director.when', 'Automatically', 'arc.trigger', 'auto'],
    ['director.faces', '1 a week', 'cast.faces', 'week1'], ['director.autoAccept', true, 'arc.autoAccept', true], ['director.genre', 'noir', 'arc.genre', 'noir'],
    ['director.stallDays', 9, 'arc.stallDays', 9], ['director.cooldown', 3, 'tracker.initiativeCooldown', 3], ['director.banned', 'Bob, Al', 'names.banned', 'Bob, Al']];
  for (const [key, value, field, stored] of cases) {
    const answer = await port.command('settings.set', { key, value });
    assert.equal(answer.ok, true, key);
    assert.deepEqual(host.settings.stored(D)[field], stored, key);
    assert.equal(host.sdk.settings(D)[field], stored);
    assert.equal(rowOf(port, key).value, typeof stored === 'string' && ['pulse.mode', 'arc.trigger', 'cast.faces'].includes(field) ? value : stored, key);
  }
  // the old view's own call stores the same thing
  host.settings.set(D, 'arc.stallDays', 4);
  assert.equal(rowOf(port, 'director.stallDays').value, 4);
});

test('a value the setting cannot take is refused, not shown as saved; an unknown choice label does nothing', async t => {
  const { host, port } = await live(t);
  assert.equal((await port.command('settings.set', { key: 'director.pulse', value: 'Furious' })).ok, false);
  assert.equal((await port.command('settings.set', { key: 'director.nothing', value: 1 })).ok, false);
  assert.equal((await port.command('settings.set', { key: 'director.stallDays', value: 'many' })).ok, false);
  assert.equal(host.sdk.settings(D)['pulse.mode'], 'lively');
});

test('a row whose feature is off is left out; with the host reporting nothing there is no section', async t => {
  const { host } = await live(t);
  const features = host.sdk.features().map(f => (f.id === 'story-director.pulse' ? { ...f, on: false } : f));
  const section = selectDirector({ values: { [D]: host.sdk.settings(D) }, features });
  assert.equal(section.rows.some(r => r.key === 'director.pulse'), false);
  assert.equal(section.rows.some(r => r.key === 'director.faces'), true);
  assert.equal(selectDirector(null), null);
});

test('NPC State rows read and write the npc-state-delta bucket when its social feature is on', async t => {
  const calls = [];
  const features = [{ id: 'npc-state-delta.social', on: true }];
  const section = selectDirector({ values: { 'npc-state-delta': { socialScale: 80, socialCap: 4 } }, features });
  assert.equal(section.rows.find(r => r.key === 'director.socialScale').value, 80);
  assert.equal(section.rows.find(r => r.key === 'director.socialScale').unit, '%');
  const { directorCommand } = await import('../../../ui/port/settings-director.js');
  const answer = directorCommand('settings.set', { key: 'director.socialCap', value: 6 }, { settings: { set: (...a) => { calls.push(a); return 6; } } });
  assert.deepEqual(calls, [['npc-state-delta', 'socialCap', 6]]);
  assert.equal(answer.ok, true);
  assert.equal(directorCommand('settings.set', { key: 'host.font', value: 1 }, null), null);
});

test('the page draws on the live host: heading, groups, rows and a changed switch goes through onChange', async t => {
  const { port } = await live(t);
  const { installFakeDom } = await import('../../helpers/ui-fake-dom.js');
  const { createPages } = await import('../../../ui/settings/page.js');
  const vm = port.view('settings');
  const section = vm.sections.find(s => s.id === 'director');
  installFakeDom();
  const box = globalThis.document.createElement('div');
  const changes = [];
  createPages(vm, { onChange: (k, v) => changes.push([k, v]), repaint() {} }).page(section, null).forEach(n => box.appendChild(n));
  assert.ok(box.querySelector('[data-key="director.pulse"]'));
  assert.ok(box.querySelectorAll('.sgrp').length >= 4);
  box.querySelector('[data-key="director.autoAccept"] .sw').click();
  assert.deepEqual(changes, [['director.autoAccept', true]]);
});
