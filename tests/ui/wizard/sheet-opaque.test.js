// The New character wizard's sheet sits on an opaque base (dark and light), so the page behind never shows through its summary card on a phone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../../ui/css/wizard.css', import.meta.url), 'utf8');

test('wizard.css gives .wz .sh-panel an opaque base in both schemes', () => {
  assert.match(css, /\.su-root \.wz \.sh-panel\{background:linear-gradient\(var\(--su-panel2\),var\(--su-panel2\)\),var\(--su-flat,#191a2b\)\}/);
  assert.match(css, /\.su-root\[data-scheme="light"\] \.wz \.sh-panel\{background:linear-gradient\(var\(--su-panel2\),var\(--su-panel2\)\),var\(--su-flat,#e8e9f1\)\}/);
});
