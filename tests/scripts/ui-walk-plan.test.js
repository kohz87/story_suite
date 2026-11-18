import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs, skipReason, nextValue, diffPaths } from '../../scripts/ui-walk/walk-plan.mjs';

const CLI = fileURLToPath(new URL('../../scripts/ui-walk/settings-walk.mjs', import.meta.url));

test('parseArgs: url and out are needed; sizes and themes default to the three sizes, dark and light', () => {
  assert.match(parseArgs([]).error, /--url and --out are needed/);
  assert.match(parseArgs(['--url', 'http://x']).error, /--url and --out/);
  const o = parseArgs(['--url', 'http://127.0.0.1:8006', '--out', '/tmp/w']);
  assert.deepEqual(o.sizes.map(s => s.name), ['1920x1080', '1280x800', '390x844']);
  assert.deepEqual(o.sizes[2], { w: 390, h: 844, name: '390x844' });
  assert.deepEqual(o.themes, ['dark', 'light']);
  assert.deepEqual(o.only, []);
  assert.equal(o.character, null);
});

test('parseArgs: reads --only, --themes, --sizes, --character and refuses bad ones', () => {
  const o = parseArgs(['--url', 'u', '--out', 'o', '--only', 'look, rpg', '--themes', 'light', '--sizes', '1280x800', '--character', 'Ersveil']);
  assert.deepEqual(o.only, ['look', 'rpg']);
  assert.deepEqual(o.themes, ['light']);
  assert.deepEqual(o.sizes, [{ w: 1280, h: 800, name: '1280x800' }]);
  assert.equal(o.character, 'Ersveil');
  assert.match(parseArgs(['--url', 'u', '--out', 'o', '--themes', 'sepia']).error, /--themes/);
  assert.match(parseArgs(['--url', 'u', '--out', 'o', '--sizes', 'big']).error, /--sizes/);
  assert.match(parseArgs(['--url', 'u', '--out', 'o', '--bogus', '1']).error, /Unknown or empty option --bogus/);
  assert.match(parseArgs(['--url']).error, /Unknown or empty option --url/);
});

test('the CLI prints its usage and exits 2 without --url and --out (before it needs a browser)', () => {
  const run = spawnSync(process.execPath, [CLI], { encoding: 'utf8' });
  assert.equal(run.status, 2);
  assert.match(run.stderr, /Usage: node scripts\/ui-walk\/settings-walk\.mjs --url/);
});

test('skipReason: actions and Use the old view are never changed; settings are walked', () => {
  assert.match(skipReason({ id: 'act:Reset Look to defaults', kind: 'act' }), /action button/);
  assert.match(skipReason({ id: 'dev.oldView', kind: 'sw' }), /old view/);
  assert.match(skipReason({ id: 'ctl:Modules and features for', kind: 'seg' }), /not a setting/);
  assert.equal(skipReason({ id: 'host.panelStyle', kind: 'seg' }), null);
  assert.equal(skipReason({ id: 'sub:story-block:story-block.rpg', kind: 'sw' }), null);
  assert.equal(skipReason({ id: 'dev.tools', kind: 'sw' }), null);
});

test('nextValue: switches flip, choices take the next option, numbers step, text grows, chips toggle the first', () => {
  assert.equal(nextValue({ kind: 'sw' }, true), false);
  assert.equal(nextValue({ kind: 'sw' }, false), true);
  assert.equal(nextValue({ kind: 'sw' }, 'true'), false);
  const seg = { kind: 'seg', options: ['Glass', 'Follow SillyTavern'] };
  assert.equal(nextValue(seg, 'Glass'), 'Follow SillyTavern');
  assert.equal(nextValue(seg, 'Follow SillyTavern'), 'Glass');
  assert.equal(nextValue(seg, null), 'Glass');
  assert.equal(nextValue({ kind: 'sel', options: ['Only'] }, 'Only'), undefined);
  assert.equal(nextValue({ kind: 'num' }, '50'), '51');
  assert.equal(nextValue({ kind: 'num' }, '99', -1), '98');
  assert.equal(nextValue({ kind: 'num' }, ''), '1');
  assert.equal(nextValue({ kind: 'num' }, '', -1), undefined);
  assert.equal(nextValue({ kind: 'num', step: 25 }, '100'), '125', 'a row stepping by 25 gets a value it takes');
  assert.equal(nextValue({ kind: 'num', step: 25 }, '300', -1), '275');
  assert.equal(nextValue({ kind: 'txt' }, ''), 'Walk');
  assert.equal(nextValue({ kind: 'txt' }, 'Era'), 'Era walk');
  const chips = { kind: 'chips', options: ['feelings', 'notes', 'items'] };
  assert.equal(nextValue(chips, 'notes'), 'feelings, notes');
  assert.equal(nextValue(chips, 'feelings, items'), 'items');
  assert.equal(nextValue({ kind: 'chips', options: [] }, ''), undefined);
  assert.equal(nextValue({ kind: 'act' }, null), undefined);
});

test('diffPaths: the paths that differ, with short before and after values', () => {
  const a = { settings: { core: { font: 'nunito', size: 1 }, list: [1, 2] }, device: {} };
  const b = { settings: { core: { font: 'theme', size: 1 }, list: [1, 3] }, device: { 'storySuite.ui.fold': '{}' } };
  assert.deepEqual(diffPaths(a, b), [
    { path: 'settings.core.font', before: '"nunito"', after: '"theme"' },
    { path: 'settings.list.1', before: '2', after: '3' },
    { path: 'device.storySuite.ui.fold', before: '(none)', after: '"{}"' },
  ]);
  assert.deepEqual(diffPaths(a, structuredClone(a)), []);
  assert.equal(diffPaths({ x: 1, y: 2, z: 3 }, { x: 2, y: 3, z: 4 }, 2).length, 2);
});
