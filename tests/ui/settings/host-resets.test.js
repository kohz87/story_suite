// Every Settings row's set and every page's Reset, through one live port on a real host: none may go unanswered, and each writes the right place.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { BUILTIN_MODULES } from '../../../core/modules-list.js';
import { buildSelectors } from '../../../ui/select/build.js';
import { selectDirector } from '../../../ui/select/settings-director.js';
import { createSbPort } from '../../../ui/port/sb-port.js';
import { createPages } from '../../../ui/settings/page.js';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';

async function live(t) {
  t.mock.method(console, 'warn', () => {});
  const host = await createHost({ core: true, modules: BUILTIN_MODULES });
  t.after(() => host.close());
  const writes = { settings: host.settings, features: host.features };
  const port = createSbPort({ sdk: host.sdk, writes, selectors: buildSelectors(() => null, host.sdk), rpgValues: () => host.sdk.settings('story-block') });
  return { host, port, sections: () => port.view('settings').sections };
}
const settable = s => s.rows.filter(r => !['info', 'btn'].includes(r.type));
const rowOf = (port, id, key) => port.view('settings').sections.find(s => s.id === id).rows.find(r => r.key === key);
const unanswered = a => /no command called/i.test(String(a?.message ?? ''));

test('every row of every page answers its set, and none falls through to the engine', async t => {
  const { port, sections } = await live(t);
  const bad = [];
  for (const s of sections()) for (const r of settable(s)) {
    const answer = await port.command('settings.set', { key: r.key, value: r.value });
    if (!answer?.ok) bad.push(`${r.key}: ${answer?.message ?? JSON.stringify(answer)}`);
  }
  assert.deepEqual(bad, []);
});

test('a page that has settable rows answers its Reset; the Add-ons page (nothing to set) draws none', async t => {
  const { port, sections } = await live(t);
  const bad = [];
  for (const s of sections()) {
    if (s.id === 'start' || !settable(s).length) continue;
    const answer = await port.command('settings.action', { key: 'settings.reset', value: `Reset ${s.name} to defaults` });
    if (!answer?.ok) bad.push(`${s.id}: ${answer?.message ?? JSON.stringify(answer)}`);
  }
  assert.deepEqual(bad, []);
  const addons = sections().find(s => s.id === 'addons');
  assert.equal(settable(addons).length, 0);
  installFakeDom();
  const pages = createPages(port.view('settings'), { onChange() {}, onAction() {}, go() {}, repaint() {} });
  const root = globalThis.document.createElement('div');
  for (const n of pages.page(addons, null).filter(Boolean)) root.appendChild(n);
  assert.ok(![...root.querySelectorAll('button')].some(b => /^Reset /.test(b.textContent)), 'no Reset on a page with nothing to reset');
});

test('Look and Tools write the host setting (a choice by its label) and read it back', async t => {
  const { host, port } = await live(t);
  assert.deepEqual(await port.command('settings.set', { key: 'host.font', value: "Your theme's font" }), { ok: true, value: 'theme' });
  assert.equal(host.sdk.settings().font, 'theme');
  assert.equal(rowOf(port, 'look', 'host.font').value, "Your theme's font");
  assert.equal((await port.command('settings.set', { key: 'host.textSize', value: '120%' })).ok, true);
  assert.equal(host.sdk.settings().textSize, '120');
  assert.equal((await port.command('settings.set', { key: 'host.sendPending', value: false })).ok, true);
  assert.equal(host.sdk.settings().sendPending, false);
  assert.equal((await port.command('settings.set', { key: 'host.glassStrength', value: 70 })).ok, true);
  assert.equal((await port.command('settings.set', { key: 'host.tailBudget', value: 2500 })).ok, true);
  assert.equal(host.sdk.settings().tailBudget, 2500);
  const refused = await port.command('settings.set', { key: 'host.font', value: 'Comic' });
  assert.equal(refused.ok, false);
  assert.ok(!unanswered(refused), 'the host handler answers a bad value itself');
  assert.equal((await port.command('settings.set', { key: 'host.callQueue', value: false })).ok, false, 'a host key the pages do not show is not written here');
});

test('each Reset puts back exactly that page, and leaves the others as they were', async t => {
  const { host, port } = await live(t);
  const dir = () => host.sdk.settings('story-director');
  const blk = () => host.sdk.settings('story-block');
  const feature = id => host.sdk.features().find(f => f.id === id);
  const set = (key, value) => port.command('settings.set', { key, value });
  const reset = name => port.command('settings.action', { key: 'settings.reset', value: `Reset ${name} to defaults` });

  await set('host.glassStrength', 80); await set('host.tailBudget', 3000); await set('world.era', 'Age of Tests'); await set('director.defaultDc', 17);
  await set('extras.chatterLines', 7); await set('calls.queue', false);
  const wasOn = feature('story-block.chatter').on;
  await port.command('settings.set', { key: 'modules.chat.extras.chatter', value: !wasOn });

  assert.equal((await reset('Look')).ok, true);
  assert.equal(host.sdk.settings().glassStrength, 50);
  assert.equal(host.sdk.settings().tailBudget, 3000, 'Look leaves the budgets');
  assert.equal((await reset('Tools')).ok, true);
  assert.equal(host.sdk.settings().tailBudget, 1500);
  assert.equal(dir()['tracker.calendar.era'], 'Age of Tests', 'Tools leaves the calendar');

  assert.equal((await reset('World and time')).ok, true);
  assert.equal(dir()['tracker.calendar.era'], BUILTIN_MODULES[0].settings.defaults['tracker.calendar.era']);
  assert.equal(dir()['checks.defaultDc'], 17, 'World leaves the Director page');
  assert.equal((await reset('Director')).ok, true);
  assert.equal(dir()['checks.defaultDc'], BUILTIN_MODULES[0].settings.defaults['checks.defaultDc']);

  assert.equal(blk().chatterMax, 7, 'Director leaves Chat extras');
  assert.equal((await reset('Chat extras')).ok, true);
  assert.equal(blk().chatterMax, 3);
  assert.equal(feature('story-block.chatter').on, feature('story-block.chatter').default !== false);
  assert.equal(host.sdk.settings().callQueue, false, 'Chat extras leaves Models');
  assert.equal((await reset('Models')).ok, true);
  assert.equal(host.sdk.settings().callQueue, true);
});

test('the Director page is drawn with its defaults when the host holds no Director settings', () => {
  for (const answers of [{}, { values: {}, features: [] }, { values: { 'story-director': null, 'npc-state-delta': null }, features: [] }, { values: { 'story-director': {}, 'npc-state-delta': {} } }]) {
    const section = selectDirector(answers);
    assert.equal(section?.id, 'director');
    assert.ok(section.rows.length > 10);
    const dc = section.rows.find(r => r.key === 'director.defaultDc');
    assert.equal(dc.value, dc.default);
    assert.ok(Number.isFinite(dc.value));
  }
});

test('the RPG page reads the same sdk bucket the Money and Chat extras pages do', async t => {
  const { host, port } = await live(t);
  host.settings.set('story-block', 'rpgLevelCap', 12);
  assert.equal(rowOf(port, 'rpg', 'rpg.levelCap').value, 12);
});
