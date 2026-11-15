import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../packages/story-block/tests/ui-fake-dom.js';
import { createPages } from '../../../ui/settings/page.js';
import { buildSettings } from '../../../ui/fixtures/settings.js';

const settings = buildSettings();
const build = (log = []) => {
  installFakeDom();
  let repaints = 0;
  const pages = createPages(settings, { onChange: (k, v) => log.push(['set', k, v]), onAction: (k, l) => log.push(['act', k, l]), go: () => {}, repaint: () => { repaints += 1; } });
  return { pages, repaints: () => repaints, section: id => settings.sections.find(s => s.id === id) };
};
const nodes = (list) => list.filter(Boolean);

test('Start: scope switch, three presets, the five module cards, reset and the Gone list', () => {
  const { pages, section } = build();
  const root = globalThis.document.createElement('div');
  for (const n of nodes(pages.page(section('start'), null))) root.appendChild(n);
  assert.equal(root.querySelectorAll('.pre').length, 3);
  assert.equal(root.querySelectorAll('.mod').length, 5);
  assert.equal(root.querySelector('.pre[aria-pressed="true"] b').textContent, 'Full');
  assert.ok(root.querySelector('.removed li'));
});

test('a module feature switch is reported with its path and shows Custom on the next build', () => {
  const log = [];
  const { pages, section, repaints } = build(log);
  const first = () => { const r = globalThis.document.createElement('div'); for (const n of nodes(pages.page(section('start'), null))) r.appendChild(n); return r; };
  const root = first();
  root.querySelector('.mod .lnk').click();
  assert.equal(repaints(), 1);
  const again = first();
  again.querySelector('.msubs .sw').click();
  assert.deepEqual(log[0].slice(0, 2), ['set', 'modules.chat.rpg.fightBoard']);
  assert.ok(first().querySelector('.custom'));
});

test('Models: three connection cards; Test marks one as answered', () => {
  const { pages, section } = build();
  const draw = () => { const r = globalThis.document.createElement('div'); for (const n of nodes(pages.page(section('models'), null))) r.appendChild(n); return r; };
  assert.equal(draw().querySelectorAll('.cn').length, 3);
  draw().querySelector('.cn .tst2 button').click();
  assert.ok(draw().querySelector('.cn .tst2 small').textContent.startsWith('answered'));
});

test('Packs: no remove confirmation until asked; Tools: the sent card lists the budget bars and the text', () => {
  const { pages, section } = build();
  const packs = globalThis.document.createElement('div');
  for (const n of nodes(pages.page(section('packs'), null))) packs.appendChild(n);
  assert.equal(packs.querySelectorAll('.cfm').length, 0);
  const tools = globalThis.document.createElement('div');
  for (const n of nodes(pages.page(section('tools'), null))) tools.appendChild(n);
  assert.equal(tools.querySelectorAll('.brow2').length, 5);
  assert.ok(tools.querySelector('pre.sent').textContent.includes('Quest in focus'));
});
