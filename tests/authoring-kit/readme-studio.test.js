import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = rel => fileURLToPath(new URL(rel, import.meta.url));
const readme = readFileSync(here('../../authoring-kit/README.md'), 'utf8');

test('the kit README points at the Pack Studio and the page it names exists', () => {
  assert.match(readme, /Open Studio/);
  assert.match(readme, /\/studio\//);
  assert.ok(existsSync(here('../../studio/index.html')));
  assert.ok(existsSync(here('../../docs/dev/studio.md')));
});

test('the kit README no longer sends writers to the old Story Studio page', () => {
  assert.doesNotMatch(readme, /story-studio\.html/);
  assert.match(readme, /replaces the old Story Studio/);
});
