import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { createHelpPage } from '../../../ui/settings/help.js';
import { parseFaq, inlinePieces } from '../../../ui/settings/help-parse.js';
import { FAQ_MARKDOWN } from '../../../ui/settings/help-faq-data.js';
import { selectSettings } from '../../../ui/select/settings.js';

const MD = '# Title\n\nintro\n\n## First one?\n\nSee [Settings → Packs and trackers](settings:packs) and `code`.\nSecond line with **bold** and [a doc](v2/X.md).\n\nNext paragraph.\n\n## Second one?\n\nAbout fights only.\n';

test('the markdown is read into questions and paragraphs', () => {
  const entries = parseFaq(MD);
  assert.deepEqual(entries.map(e => e.title), ['First one?', 'Second one?']);
  assert.equal(entries[0].paragraphs.length, 2);
  assert.match(entries[0].paragraphs[0], /^See .* and `code`\. Second line/);
});

test('a paragraph splits into text, bold, code and Settings links; other links keep their label', () => {
  const pieces = inlinePieces(parseFaq(MD)[0].paragraphs[0]);
  assert.deepEqual(pieces.find(p => p.page), { label: 'Settings → Packs and trackers', page: 'packs' });
  assert.ok(pieces.some(p => p.code === 'code') && pieces.some(p => p.bold === 'bold'));
  assert.ok(pieces.some(p => p.text === 'a doc') && !pieces.some(p => p.to));
});

test('a question opens on a tap, a search filters and opens what it finds, and a link goes to its page', () => {
  installFakeDom();
  const gone = [];
  const nodes = createHelpPage({ go: id => gone.push(id), has: () => true }, MD)();
  const [bar, list] = nodes;
  assert.equal(list.querySelectorAll('.hq').length, 2);
  assert.equal(list.querySelectorAll('.hq-a').length, 0);
  list.querySelector('.hq-t').click();
  assert.equal(list.querySelectorAll('.hq-a').length, 1);
  list.querySelector('.hlink').click();
  assert.deepEqual(gone, ['packs']);
  const box = bar.querySelector('input');
  box.value = 'fights';
  box.dispatchEvent(new globalThis.Event('input'));
  assert.deepEqual(list.querySelectorAll('.hq-t').map(n => n.textContent), ['Second one?']);
  assert.equal(list.querySelectorAll('.hq-a').length, 1);
  box.value = 'zzz';
  box.dispatchEvent(new globalThis.Event('input'));
  assert.match(list.textContent, /No question matches/);
});

test('a link to a page this host lacks is plain text', () => {
  installFakeDom();
  const [, list] = createHelpPage({ go() {}, has: () => false }, MD)();
  list.querySelector('.hq-t').click();
  assert.equal(list.querySelectorAll('.hlink').length, 0);
  assert.match(list.textContent, /Settings → Packs and trackers/);
});

test('the bundled FAQ is docs/FAQ.md and every Settings link names a real page', () => {
  assert.equal(FAQ_MARKDOWN, fs.readFileSync(new URL('../../../docs/FAQ.md', import.meta.url), 'utf8'));
  const vm = selectSettings({ host: {}, schema: {}, features: [] });
  const ids = vm.sections.map(s => s.id);
  assert.ok(ids.includes('help'));
  const pages = [...FAQ_MARKDOWN.matchAll(/\(settings:([a-z]+)\)/g)].map(m => m[1]);
  assert.ok(pages.length >= 5);
  for (const id of pages) assert.ok(ids.includes(id), `${id} is a Settings page`);
  for (const topic of ['fight board', 'XP', 'mood', 'portrait', 'lorebook', 'cache']) assert.ok(new RegExp(topic, 'i').test(FAQ_MARKDOWN), `the FAQ covers ${topic}`);
});
