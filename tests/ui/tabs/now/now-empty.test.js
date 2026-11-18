// F29: Now in a new chat says there is nothing yet instead of a blank panel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/ui-fake-dom.js';
import { fixture } from '../../../../ui/fixtures/index.js';
import { nowTab } from '../../../../ui/tabs/now/now.js';
import { makeCtx } from './helpers.js';

test('a Now with no cards shows the empty line; one with cards does not', () => {
  installFakeDom();
  const bare = nowTab({}, makeCtx());
  assert.equal(bare.querySelectorAll('[data-card]').length, 0);
  assert.match(bare.querySelector('[data-note="now-empty"]').textContent, /Nothing here yet/);
  assert.equal(nowTab(fixture().now, makeCtx()).querySelector('[data-note="now-empty"]'), null);
});
