import test from 'node:test';
import assert from 'node:assert/strict';
import { TOKENS, GLASS_DARK, GLASS_LIGHT } from '../../../ui/theme/tokens.js';
import { checkSkin } from '../../../ui/theme/apply.js';

test('TOKENS lists unique --su-* names and is frozen', () => {
  assert.equal(Object.isFrozen(TOKENS), true);
  assert.ok(TOKENS.length > 0);
  const seen = new Set(TOKENS);
  assert.equal(seen.size, TOKENS.length);
  for (const name of TOKENS) {
    assert.match(name, /^--su-[a-z0-9-]+$/);
  }
});

test('GLASS_DARK and GLASS_LIGHT define every token in TOKENS and are frozen', () => {
  assert.equal(Object.isFrozen(GLASS_DARK), true);
  assert.equal(Object.isFrozen(GLASS_LIGHT), true);
  assert.deepEqual(Object.keys(GLASS_DARK), [...TOKENS]);
  assert.deepEqual(Object.keys(GLASS_LIGHT), [...TOKENS]);
  assert.notEqual(GLASS_DARK['--su-text'], GLASS_LIGHT['--su-text']);
  assert.notEqual(GLASS_DARK['--su-panel'], GLASS_LIGHT['--su-panel']);
  assert.match(GLASS_DARK['--su-font'], /Nunito/);
  assert.match(GLASS_LIGHT['--su-font'], /Nunito/);
});

test('GLASS_DARK and GLASS_LIGHT pass checkSkin', () => {
  const darkCheck = checkSkin(GLASS_DARK);
  assert.equal(darkCheck.ok, true, darkCheck.errors.join('; '));
  const lightCheck = checkSkin(GLASS_LIGHT);
  assert.equal(lightCheck.ok, true, lightCheck.errors.join('; '));
});
