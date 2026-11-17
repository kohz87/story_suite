import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/ui-fake-dom.js';
import { createPages } from '../../../../ui/settings/page.js';
import { selectSettings } from '../../../../ui/select/settings.js';
import { extrasCommand } from '../../../../ui/port/extras.js';

const F = (n, on) => ({ id: `story-block.${n}`, moduleId: 'story-block', moduleName: 'Story Block', label: n, describe: `${n} text`, default: false, available: true, on });

test('the live Chat extras page draws without errors, and every change it sends is a key the port stores', () => {
  installFakeDom();
  const vm = selectSettings({ features: [F('choices', true), F('chatter', true), F('you', false)], extras: { chatterInPrompt: false, chatterMax: 3 } });
  const log = [];
  const pages = createPages(vm, { onChange: (k, v) => log.push([k, v]), onAction: () => {}, go: () => {}, repaint: () => {} });
  const root = globalThis.document.createElement('div');
  for (const n of pages.page(vm.sections.find(s => s.id === 'extras'), null).filter(Boolean)) root.appendChild(n);
  assert.equal(root.querySelectorAll('.mod[data-mod="extras"] .msubs .sub').length, 3);
  assert.equal(root.querySelectorAll('.sgrp .srow').length, 2);
  root.querySelector('.srow[data-key="extras.sendBack"] .sw').click();
  root.querySelector('.msubs .sub .sw').click();
  root.querySelector('.mh .sw').click();
  assert.deepEqual(log.map(([k]) => k), ['extras.sendBack', 'modules.chat.extras.choices', 'modules.chat.extras']);
  const writes = { settings: { set: (_i, _k, v) => v }, features: { set: (_i, on) => on } };
  for (const [key, value] of log) assert.equal(extrasCommand('settings.set', { key, value }, writes).ok, true, key);
});
