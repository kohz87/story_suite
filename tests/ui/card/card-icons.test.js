import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../packages/story-block/tests/ui-fake-dom.js';
import { paceIcon, soakIcon, statusIcon } from '../../../ui/card/card-icons.js';

test('soak and pace glyphs are svg elements with at least one shape', () => {
  installFakeDom();
  for (const el of [soakIcon(), paceIcon()]) {
    assert.equal(el.tagName.toLowerCase(), 'svg');
    assert.equal(el.querySelectorAll('path').length >= 1, true);
  }
});

test('known status ids get their own glyph and unknown ids fall back by tone', () => {
  installFakeDom();
  const drop = statusIcon('bleeding', 'debuff');
  assert.match(drop.querySelector('path').getAttribute('d'), /^M12 2c3 4\.5/);
  assert.notEqual(statusIcon('mystery', 'buff').querySelector('path').getAttribute('d'), drop.querySelector('path').getAttribute('d'));
  assert.equal(statusIcon('mystery', 'debuff').tagName.toLowerCase(), 'svg');
});
