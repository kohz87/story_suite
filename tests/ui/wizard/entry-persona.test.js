// Soak bug #1: the story has a character (Wessel) but the persona was changed (Lucien): the held first Send names that, and offers no second character.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hostAvailable } from '../../../testkit/index.js';
import { wizardPage, settleLong, click } from './page.js';

const available = await hostAvailable();
const skip = available.ok ? false : available.reason;

test('a character exists but the persona is another name: the hold says so and offers only Send without the RPG', { skip }, async t => {
  const p = await wizardPage(t);
  p.field.value = 'I step onto the barge.';
  p.press();
  await settleLong();
  click(p.hold(), '[data-hold="create"]');
  await settleLong();
  click(p.sheet(), '.wz-steps button[data-value="review"]');
  click(p.sheet(), '[data-wiz="create"]');
  await settleLong();
  p.host.ctx.name1 = 'Lucien Noctis';
  p.field.value = 'I check my pack.';
  p.press();
  await settleLong();
  const hold = p.hold();
  assert.ok(hold, 'held: no character is named like the persona');
  assert.match(hold.querySelector('[data-hold="mismatch"]').textContent, /Wessel.*Lucien Noctis/);
  assert.deepEqual(hold.querySelectorAll('.wz-hold-acts button').map(b => b.textContent), ['Send without the RPG for now']);
  assert.equal(hold.textContent.includes('no character for you yet'), false);
});
