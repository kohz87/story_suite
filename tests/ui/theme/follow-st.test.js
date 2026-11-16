import test from 'node:test';
import assert from 'node:assert/strict';
import { decideScheme, followSt } from '../../../ui/theme/follow-st.js';
import { TOKENS, GLASS_DARK, GLASS_LIGHT } from '../../../ui/theme/tokens.js';
import { checkSkin } from '../../../ui/theme/apply.js';

test('decideScheme detects dark and light from body and tint colours', () => {
  assert.equal(decideScheme({ body: '#eeeef6', tint: 'rgba(20, 20, 30, 0.8)' }), 'dark');
  assert.equal(decideScheme({ body: '#1d2030', tint: 'rgba(255, 255, 255, 0.85)' }), 'light');
  assert.equal(decideScheme({ body: 'rgb(240, 240, 240)', tint: 'rgba(255, 255, 255, 0.1)' }), 'dark');
  assert.equal(decideScheme({ body: 'rgb(20 20 20)', tint: 'transparent' }), 'light');
  assert.equal(decideScheme({ tint: '#f5f5f5' }), 'light');
  assert.equal(decideScheme({ tint: '#121318' }), 'dark');
  assert.equal(decideScheme({}), 'dark');
  assert.equal(decideScheme({ body: 'not-a-color', tint: 'invalid' }), 'dark');
});

test('followSt maps SillyTavern variables onto --su-* tokens for dark themes', () => {
  const vars = {
    '--SmartThemeBodyColor': '#e6e4dd',
    '--SmartThemeBlurTintColor': 'rgba(24, 24, 30, 0.8)',
    '--SmartThemeBorderColor': 'rgba(255, 255, 255, 0.15)',
    '--SmartThemeQuoteColor': '#e18a24',
    '--mainFontFamily': '"Inter", sans-serif',
  };
  const tokens = followSt(name => vars[name] ?? '');
  assert.equal(Object.isFrozen(tokens), true);
  assert.deepEqual(Object.keys(tokens), [...TOKENS]);
  assert.equal(tokens['--su-text'], '#e6e4dd');
  assert.equal(tokens['--su-panel'], 'rgba(24, 24, 30, 0.8)');
  assert.equal(tokens['--su-line'], 'rgba(255, 255, 255, 0.15)');
  assert.equal(tokens['--su-accent'], '#e18a24');
  assert.equal(tokens['--su-font'], '"Inter", sans-serif');
  assert.equal(tokens['--su-ok'], GLASS_DARK['--su-ok']);
  const check = checkSkin(tokens);
  assert.equal(check.ok, true, check.errors.join('; '));
});

test('followSt switches to light base tokens when ST theme is light', () => {
  const vars = {
    '--SmartThemeBodyColor': '#1f2330',
    '--SmartThemeBlurTintColor': 'rgba(250, 250, 252, 0.85)',
    '--SmartThemeBorderColor': 'rgba(0, 0, 0, 0.12)',
    '--SmartThemeQuoteColor': '#5b42d6',
    '--mainFontFamily': 'Georgia, serif',
  };
  const tokens = followSt(name => vars[name] ?? '');
  assert.equal(tokens['--su-ok-t'], GLASS_LIGHT['--su-ok-t']);
  assert.equal(tokens['--su-pilltext'], 'rgba(250, 250, 252, 0.85)');
  assert.equal(checkSkin(tokens).ok, true);
});

test('followSt falls back to GLASS_DARK when no ST variables are set', () => {
  const tokens = followSt(() => '');
  assert.deepEqual(tokens, GLASS_DARK);
});
