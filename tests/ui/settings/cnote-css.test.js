// The Models page's one-line connection note (.cnote) is styled: small soft text under the picker, with a sixth row only while a card has one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../../ui/css/settings.css', import.meta.url), 'utf8');

test('.cnote has a rule, and the grid makes room for it only when a card has a note', () => {
  assert.match(css, /\.cn \.cnote\{[^}]*font-size:12px[^}]*color:var\(--su-soft\)/);
  assert.match(css, /\.conn:has\(\.cnote\)\{grid-template-rows:repeat\(6,auto\)\}/);
  assert.match(css, /\.conn:has\(\.cnote\) \.tst2\{grid-row:5\}/);
  assert.match(css, /@container \(max-width:600px\)\{[^}]*\.conn:has\(\.cnote\)/, 'the narrow layout drops the rows again');
});
