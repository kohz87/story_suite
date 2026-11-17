import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { renderDeveloper, DEVELOPER_KEY, TEMPLATE_NOTE } from '../../../ui/settings/developer.js';
import { createPages } from '../../../ui/settings/page.js';

const cards = nodes => nodes.map(n => n.dataset.card);

test('with developer tools off there is a switch and no Template page', () => {
  installFakeDom();
  const out = renderDeveloper({ on: false }, {});
  assert.deepEqual(cards(out), ['developer']);
  assert.equal(out[0].querySelector('[data-key="dev.tools"]').dataset.type, 'sw');
});

test('with it on the Template page shows the generic renderer on a sample, with the disclaimer', () => {
  installFakeDom();
  const out = renderDeveloper({ on: true }, {});
  assert.deepEqual(cards(out), ['developer', 'template']);
  assert.equal(out[1].querySelector('.template-note').textContent, TEMPLATE_NOTE);
  assert.equal(TEMPLATE_NOTE, 'Template renderer: for module authors. Ship your own view for your activity.');
  assert.ok(out[1].querySelector('[data-renderer="generic"]'));
  assert.equal(out[1].querySelectorAll('.scene-choice-list button').length, 3);
});

test('on the Tools page the switch tells the host and repaints with the Template; Scene is not a word on it', () => {
  installFakeDom();
  const changes = [];
  let paints = 0;
  const section = { id: 'tools', group: 'Tools', name: 'Tools', desc: 'd', special: 'tools', rows: [] };
  const settings = { sections: [section], modules: { scope: 'chat', chat: {}, newChats: {}, preset: null, presets: [], defs: [] }, connections: [] };
  const pages = createPages(settings, { onChange: (k, v) => changes.push([k, v]), repaint: () => { paints += 1; } });
  const top = () => { const box = globalThis.document.createElement('div'); pages.page(section, null).forEach(n => box.appendChild(n)); return box; };
  assert.equal(top().querySelector('[data-card="template"]'), null);
  top().querySelector('[data-key="dev.tools"] .sw').click();
  assert.deepEqual(changes, [[DEVELOPER_KEY, true]]);
  assert.equal(paints, 1);
  const again = top();
  assert.ok(again.querySelector('[data-card="template"]'));
  assert.equal(/\bScene\b/.test(again.textContent), false);
});
