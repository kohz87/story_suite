// The keyboard stays put when the wizard redraws a step (REVWIZ2 item 1): after Next / Back, an arrow on the step tabs, a stepper, a skill's
// type, "+ Add a skill" and a skill's × the focus is on the equivalent control inside the sheet, never dropped to the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hostAvailable } from '../../../testkit/index.js';
import { page, begin, settle } from '../../modules/rpg/view/page.js';
import { createWizardWorld } from '../../../ui/wizard/world.js';
import { createNewWizard } from '../../../ui/wizard/wizard.js';
import { createBackStack } from '../../../ui/runtime/back-stack.js';

const available = await hostAvailable();
const skip = available.ok ? false : available.reason;

async function sheetOn(t) {
  const got = await page(t, { formula: 'standard', persona: 'Wessel' });
  await begin(got.host);
  await settle();
  const sdk = got.host.sdk;
  const backStack = createBackStack();
  t.after(backStack.bindDocument(got.doc));
  const wizard = createNewWizard({ world: createWizardWorld({ sdk, ctx: () => got.host.ctx }), command: (type, payload) => sdk.command(type, payload, { cause: 'ui' }), sheetCtx: () => ({ doc: got.doc, backStack, sheetHost: got.doc.body }) });
  assert.equal(wizard.open(), true);
  const sheet = () => got.doc.querySelector('.sh-ov[data-sheet="new-character"]');
  const focused = () => got.doc.activeElement;
  const tab = step => sheet().querySelector(`.wz-steps button[data-value="${step}"]`);
  return { ...got, sheet, focused, tab, within: () => sheet().contains(focused()) };
}

test('Next and Back keep the focus on the Next / Back button; on the last step (no Next) it goes to Back', { skip }, async t => {
  const w = await sheetOn(t);
  const foot = name => w.sheet().querySelector(`.wz-foot [data-wiz="${name}"]`);
  foot('next').focus();
  foot('next').click();
  assert.equal(w.focused().dataset.wiz, 'next', 'Who → Stats: Next again');
  foot('next').click();
  foot('next').click();
  assert.equal(w.sheet().dataset.step, 'review');
  assert.equal(w.focused().dataset.wiz, 'back', 'no Next on Review: the Back button has it');
  assert.ok(w.within());
  foot('back').click();
  assert.equal(w.focused().dataset.wiz, 'back');
  foot('back').click();
  foot('back').click();
  assert.equal(w.sheet().dataset.step, 'who');
  assert.equal(w.focused().dataset.wiz, 'next', 'no Back on Who: Next has it');
});

test('ArrowRight and a click on a step tab leave the focus on the new step\'s tab', { skip }, async t => {
  const w = await sheetOn(t);
  w.tab('who').focus();
  w.tab('who').dispatch('keydown', { key: 'ArrowRight' });
  assert.equal(w.sheet().dataset.step, 'stats');
  assert.equal(w.focused(), w.tab('stats'), 'a new tab node, the same step as the arrow chose');
  assert.equal(w.focused().getAttribute('aria-selected'), 'true');
  w.tab('stats').dispatch('keydown', { key: 'ArrowRight' });
  assert.equal(w.focused(), w.tab('skills'));
  w.tab('review').focus();
  w.tab('review').click();
  assert.equal(w.focused(), w.tab('review'));
});

test('a stepper keeps the focus (the other stepper when this one is spent); a field redraw keeps the field', { skip }, async t => {
  const w = await sheetOn(t);
  w.tab('stats').click();
  const plus = stat => w.sheet().querySelector(`[data-plus="${stat}"]`);
  plus('vit').focus();
  plus('vit').click();
  assert.equal(w.focused(), plus('vit'));
  for (let n = 0; n < 4; n += 1) plus('vit').click();
  assert.equal(plus('vit').hasAttribute('disabled') || plus('vit').disabled === true, true, '10 is the most');
  assert.equal(w.focused(), w.sheet().querySelector('[data-minus="vit"]'), 'the spent + hands the focus to its −');
  w.tab('who').click();
  const level = w.sheet().querySelector('[data-wiz="level"]');
  level.focus();
  level.value = '3';
  level.dispatch('change');
  assert.equal(w.focused(), w.sheet().querySelector('[data-wiz="level"]'), 'the level field after its redraw');
});

test('Skills: a type change, Add and × keep the focus in the sheet, on the same card\'s control or on Add', { skip }, async t => {
  const w = await sheetOn(t);
  w.tab('skills').click();
  w.sheet().querySelector('[data-wiz="add"]').click();
  const card = at => w.sheet().querySelector(`.wz-skill[data-skill="${at}"]`);
  const type = card(0).querySelector('select[data-field="type"]');
  type.focus();
  type.value = 'defence';
  type.dispatch('change');
  assert.equal(w.focused(), card(0).querySelector('select[data-field="type"]'));
  assert.equal(w.focused().value, 'defence');
  w.sheet().querySelector('[data-wiz="add"]').focus();
  w.sheet().querySelector('[data-wiz="add"]').click();
  assert.equal(w.focused(), w.sheet().querySelector('[data-wiz="add"]'));
  card(1).querySelector('[data-wiz="remove"]').focus();
  card(1).querySelector('[data-wiz="remove"]').click();
  assert.equal(w.focused(), w.sheet().querySelector('[data-wiz="add"]'), 'the row is gone: Add has the focus');
  assert.ok(w.within());
});

test('the skill\'s "What it does" is a three-row textarea, and Enter in it is not a line break', { skip }, async t => {
  const w = await sheetOn(t);
  w.tab('skills').click();
  w.sheet().querySelector('[data-wiz="add"]').click();
  const about = w.sheet().querySelector('[data-skill="0"] [data-field="about"]');
  assert.equal(about.tagName.toLowerCase(), 'textarea');
  assert.equal(about.getAttribute('rows'), '3');
  assert.equal(about.dispatch('keydown', { key: 'Enter' }).defaultPrevented, true);
  assert.equal(about.dispatch('keydown', { key: 'a' }).defaultPrevented, false);
});
