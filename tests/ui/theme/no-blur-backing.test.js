// F19: with SillyTavern's "No Blur" (body.no-blur) the glass panels keep a solid colour under their translucent fill, in dark and light.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../../../ui/css/base.css', import.meta.url), 'utf8');

test('base.css backs the glass with a solid colour under body.no-blur, dark and light', () => {
  assert.match(css, /body\.no-blur :is\(\.su-root, \.su-layer\) :is\(\.glass[^{]*\{[^}]*background-color: #[0-9a-f]{6}/);
  assert.match(css, /\[data-scheme='light'\] :is\(\.glass[^{]*\{[^}]*background-color: #[0-9a-f]{6}/);
});
