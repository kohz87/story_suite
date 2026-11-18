// SOAK2UI cosmetic fixes that are CSS only (10, 11, 12, 16, 17): each rule must stay in the sheet it was fixed in.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = name => readFileSync(new URL(`../../../ui/css/${name}.css`, import.meta.url), 'utf8');

test('10: the wizard footer is solid (opaque base) and sticks at the panel edge, so it never covers Create', () => {
  const rules = css('wizard').split('\n').filter(line => line.includes('.wz-foot{position:sticky'));
  assert.equal(rules.length, 1);
  assert.match(rules[0], /bottom:0/u);
  assert.match(rules[0], /var\(--su-flat/u);
});

test('11: Here now keeps its own bottom padding and ellipsizes the where-line', () => {
  const desk = css('desk');
  assert.match(desk, /padding: 14px 16px 12px;/u);
  assert.match(desk, /\.su-herenow \.hp2 \.wh2 \{[^}]*text-overflow: ellipsis;/u);
  assert.match(desk, /\.su-herenow \.hp2-body \{\s*min-width: 0;/u);
});

test('12: the sticky tab strip sticks at the scroller edge, past its padding', () => {
  assert.match(css('desk'), /\.su-strip \{\s*top: -16px;/u);
  assert.match(css('shell'), /\.su-strip \{\s*display: flex;\s*top: -12px;/u);
});

test('16: dark labels on bright fills take no text shadow', () => {
  assert.match(css('kit'), /\.su-root \.ps-b,\s*\.su-root \.pts,\s*\.su-root \.chip2 \{\s*text-shadow: none;/u);
});

test('17: a pinned tracker label stays on one line', () => {
  assert.match(css('now'), /\.fld>span:first-child\{white-space:nowrap;/u);
});
