// The harness Settings fixture and the real Settings selectors cannot drift: every fixture row is a real row (or listed as mock-only with its job), and the other way round.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSettings } from '../../../ui/fixtures/settings.js';
import { MOCK_ONLY } from '../../../ui/fixtures/settings-rows.js';
import { MODULE_DEFS } from '../../../ui/fixtures/settings-extra.js';
import { realSettings, renderRealFixture } from './real-settings.js';

const FILE = new URL('../../../ui/fixtures/settings-real.js', import.meta.url);
const PAGES = ['look', 'people', 'rpg', 'world', 'director', 'money', 'extras', 'models', 'addons'];
const SAMPLE = ['world.tempo', 'world.directorCalls'];
const MOCK = new Map([['tools', 'SA-TOOLS'], ['addons', 'a pack-supplied sample view']]);
const rowsOf = (vm, id) => vm.sections.find(s => s.id === id).rows;
const mockKeys = id => (MOCK_ONLY[id] ? MOCK_ONLY[id]((_group, key) => ({ key })) : []).map(r => r.key);

test('the generated real rows are the real selectors\' rows today', async () => {
  const text = renderRealFixture(await realSettings());
  assert.equal(readFileSync(FILE, 'utf8'), text, 'ui/fixtures/settings-real.js is stale: run `node scripts/ui/gen-fixture-rows.mjs` and commit it');
});

for (const worldEvents of [false, true]) {
  test(`every fixture row is a real row, in the real order (World events ${worldEvents ? 'on' : 'off'})`, async () => {
    const real = await realSettings({ worldEvents });
    const fixture = buildSettings({ worldEvents });
    const dropMock = (id, rows) => rows.filter(r => !mockKeys(id).includes(r.key));
    // The harness shows World events with sample values (tempo 2, 3 Director calls): everything else about those rows is the real row.
    const sample = r => (worldEvents && SAMPLE.includes(r.key) ? { ...r, value: null, default: r.default } : r);
    for (const id of PAGES) assert.deepEqual(dropMock(id, rowsOf(fixture, id)).map(sample), rowsOf(real, id).map(sample), `${id}: the fixture page differs from the real one (run the generator)`);
    if (worldEvents) assert.equal(rowsOf(fixture, 'world').find(r => r.key === 'world.worldEvents').value, true);
    assert.deepEqual(fixture.sent.limits, rowsOf(real, 'tools'), 'tools: the budget rows');
  });
}

test('a mock-only row has no real row, so the list empties itself as the jobs land', async () => {
  const real = await realSettings({ worldEvents: true });
  const realKeys = new Set(real.sections.flatMap(s => s.rows.map(r => r.key)));
  for (const id of Object.keys(MOCK_ONLY)) {
    assert.ok(MOCK.has(id), `${id}: say why its rows are mock-only`);
    for (const key of mockKeys(id)) assert.equal(realKeys.has(key), false, `${key} now has a real row (${MOCK.get(id)}): remove it from settings-rows.js`);
  }
  assert.deepEqual(rowsOf(buildSettings(), 'tools').map(r => r.key), mockKeys('tools'), 'the Tools page rows are all mock-only today');
});

test('known gap (SA-CARDS): the fixture module cards are the mock\'s, not the real ones; when they match, drop this test', async () => {
  const real = (await realSettings()).modules.defs;
  assert.notDeepEqual(MODULE_DEFS.map(m => m.id), real.map(m => m.id));
});
