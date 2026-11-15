import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../../packages/story-block/tests/ui-fake-dom.js';
import { buildSettings } from '../../../../ui/fixtures/settings.js';
import { renderToolsSection } from '../../../../ui/settings/sections/tools.js';

const setup = (extra = {}) => {
  const doc = installFakeDom();
  const settings = { ...buildSettings(), ...extra };
  const calls = [];
  const ctx = { doc, settings, onChange: (k, v) => calls.push(['c', k, v]), onAction: (k, l) => calls.push(['a', k, l]) };
  const sec = id => settings.sections.find(s => s.id === id);
  const host = nodes => { const d = doc.createElement('div'); for (const n of nodes) d.appendChild(n); return d; };
  return { doc, settings, calls, ctx, sec, host };
};
const SENT = {
  rows: [{ label: 'Rules (fixed)', used: 3550, cap: 4000, color: '#5aa0ff' }, { label: 'Chat history', used: 3016, cap: null }],
  text: '[Story Suite · Goldwane 13]',
};

test('Tools shows the sent card (bars and text), the Inspector card, then the section rows', () => {
  const { ctx, sec, host } = setup({ sent: SENT, problems: '1 this reply: a feeling over the cap' });
  const el = host(renderToolsSection(sec('tools'), ctx));
  assert.deepEqual(el.querySelectorAll('.sgrp .gt').slice(0, 3).map(g => g.textContent), ['What is sent each reply', 'Inspector and problems', 'Prompts']);
  const bars = el.querySelectorAll('.brow2');
  assert.equal(bars.length, 2);
  assert.equal(bars[0].querySelector('i b').style.getPropertyValue('width'), '89%');
  assert.equal(bars[0].querySelectorAll('span')[1].textContent, '3,550 / 4,000');
  assert.equal(bars[1].querySelector('i b').style.getPropertyValue('width'), '60%');
  assert.equal(el.querySelector('pre.sent').textContent, SENT.text);
  assert.equal(el.querySelectorAll('[data-card="inspector"] small').map(s => s.textContent).pop(), '1 this reply: a feeling over the cap');
});

test('Inspector and Problems buttons and the prompt row emit actions', () => {
  const { ctx, sec, host, calls } = setup({ sent: SENT });
  const el = host(renderToolsSection(sec('tools'), ctx));
  const press = label => el.querySelectorAll('.btn2').find(b => b.textContent === label).click();
  press('Open'); assert.deepEqual(calls.at(-1), ['a', 'tools.inspector', 'Open']);
  press('Show'); assert.deepEqual(calls.at(-1), ['a', 'tools.problems', 'Show']);
  press('Reset to default'); assert.deepEqual(calls.at(-1), ['a', 'tools.arcPrompt', 'Reset to default']);
  press('Reset Tools to defaults'); assert.deepEqual(calls.at(-1), ['a', 'reset.tools', 'Reset']);
});

test('without sent data the sent card is hidden; the Inspector card stays without a problems line', () => {
  const { ctx, sec, host } = setup();
  const el = host(renderToolsSection(sec('tools'), ctx));
  assert.equal(el.querySelector('[data-card="sent"]'), null);
  assert.equal(el.querySelectorAll('[data-card="inspector"] .srow').length, 2);
  const textOnly = setup({ sent: { rows: [], text: 'x' } });
  const t = textOnly.host(renderToolsSection(textOnly.sec('tools'), textOnly.ctx));
  assert.equal(t.querySelector('.budget'), null);
  assert.equal(t.querySelector('pre.sent').textContent, 'x');
});
