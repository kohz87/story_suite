// Soak UI fixes that live in style rules: the suite layer over third-party floating buttons, an opaque mini bar, a readable light muted
// colour, the wizard's Back / Next kept off the sheet's rounded edge, and the Past card sharing the row with Ties only when Ties exists.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GLASS_LIGHT } from '../../../ui/theme/tokens.js';

const read = name => fs.readFileSync(new URL(`../../../ui/css/${name}.css`, import.meta.url), 'utf8');

test('the suite layer sits above the 9999 third-party floating buttons', () => {
  const z = Number(/\.su-layer \{[^}]*?z-index:\s*(\d+)/s.exec(read('shell'))?.[1]);
  assert.ok(z > 9999, `z-index ${z}`);
});

test('the mini bar keeps an opaque backing under its glass', () => {
  const rule = /\.su-mini \{[^}]*\}/s.exec(read('shell'))[0];
  assert.match(rule, /background:\s*linear-gradient\(var\(--su-panel2\), var\(--su-panel2\)\), var\(--su-sky\)/);
});

const channel = hex => { const v = parseInt(hex, 16) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const luminance = hex => 0.2126 * channel(hex.slice(1, 3)) + 0.7152 * channel(hex.slice(3, 5)) + 0.0722 * channel(hex.slice(5, 7));

test('the light muted text colour reaches 4.5:1 on the glass over the lightest-blue sky (panel at .72 white)', () => {
  const sky = [0x8f, 0xb2, 0xe0];
  const behind = '#' + sky.map(c => Math.round(0.72 * 255 + 0.28 * c).toString(16).padStart(2, '0')).join('');
  const ratio = (luminance(behind) + 0.05) / (luminance(GLASS_LIGHT['--su-muted']) + 0.05);
  assert.ok(ratio >= 4.5, `ratio ${ratio.toFixed(2)}`);
});

test('the wizard footer sticks inside the sheet, its buttons off the rounded bottom edge (14 px of its own padding; SOAK2UI 10)', () => {
  assert.match(read('wizard'), /\[data-sheet="new-character"\] \.wz-foot\{position:sticky;bottom:0;z-index:1;padding:8px 0 14px/);
});
