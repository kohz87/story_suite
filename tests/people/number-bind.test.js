// The People page's number boxes go through cutSettingNumber: a typed 0 is kept where 0 is allowed, a blank or junk box is the fallback, a big one is cut.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { standInTree } from './helpers/temp-tree.js';
import { tempDir } from '../../scripts/temp-dir.mjs';

const tempRoot = tempDir('npc-number-bind-');
const extRoot = path.join(tempRoot, 'public', 'scripts', 'extensions', 'third-party', 'npc_state_delta');
fs.mkdirSync(extRoot, { recursive: true });
fs.writeFileSync(path.join(tempRoot, 'package.json'), JSON.stringify({ type: 'module' }));
standInTree(extRoot);
globalThis.__npcMock = { extensionSettings: {}, context: { saveSettingsDebounced() {} }, saveSettingsCalls: 0 };
test.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

const load = file => import(pathToFileURL(path.join(extRoot, file)).href);
const { createSettingsBindPart } = await load('runtime-settings-bind.js');
const { getSettings } = await load('runtime-settings.js');

test('a number box types its value through cutSettingNumber (the bound change handler, not the helper alone)', () => {
  const previous = { document: globalThis.document, $: globalThis.$ };
  const handlers = [];
  globalThis.document = { addEventListener() {} };
  globalThis.$ = () => ({ off() {}, on(event, selector, fn) { handlers.push({ selector, fn }); } });
  try {
    createSettingsBindPart({}, { syncSettingsControls() {}, updateInjection() {} }).bindUi();
    const type = (selector, key, raw) => {
      const box = { value: raw };
      handlers.find(h => h.selector === selector).fn.call(box);
      return [getSettings()[key], box.value];
    };
    const catchUp = ['#people_narration_capture_catch_up', 'narrationCaptureCatchUp'];
    assert.deepEqual(type(...catchUp, '0'), [0, 0], 'a typed 0 is kept where 0 is allowed');
    assert.deepEqual(type(...catchUp, ''), [4, 4], 'a blank box is the fallback');
    assert.deepEqual(type(...catchUp, 'abc'), [4, 4]);
    assert.deepEqual(type(...catchUp, '99'), [50, 50], 'a big one is cut');
    assert.deepEqual(type('#people_inject_limit', 'injectLimit', '0'), [3, 3], 'where 0 is not allowed it is the fallback, as before');
  } finally {
    globalThis.document = previous.document;
    globalThis.$ = previous.$;
  }
});
