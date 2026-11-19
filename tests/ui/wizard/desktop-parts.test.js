// The nodes the wizard draws for its desktop layout (wizard.css shows them from 1100 px; the fake page has no CSS): the summary card's stat tiles,
// skill list and portrait, the done steps, the Stats step's order (notes, rows, then Points left · HP line · Reset), the hint beside a held-back
// Create, and the step's scroll kept across a redraw on the same step (from 1100 px the step scrolls on its own and is drawn anew each time).
import test from 'node:test';
import assert from 'node:assert/strict';
import { hostAvailable } from '../../../testkit/index.js';
import { page, begin, settle } from '../../modules/rpg/view/page.js';
import { createWizardWorld } from '../../../ui/wizard/world.js';
import { createNewWizard } from '../../../ui/wizard/wizard.js';
import { createBackStack } from '../../../ui/runtime/back-stack.js';

const available = await hostAvailable();
const skip = available.ok ? false : available.reason;

async function sheetOn(t, { portrait = null } = {}) {
  const got = await page(t, { formula: 'standard', persona: 'Wessel' });
  await begin(got.host);
  await settle();
  const sdk = got.host.sdk;
  const backStack = createBackStack();
  t.after(backStack.bindDocument(got.doc));
  const world = { ...createWizardWorld({ sdk, ctx: () => got.host.ctx }), ...(portrait ? { portrait: () => portrait } : {}) };
  const wizard = createNewWizard({ world, command: (type, payload) => sdk.command(type, payload, { cause: 'ui' }), sheetCtx: () => ({ doc: got.doc, backStack, sheetHost: got.doc.body }) });
  assert.equal(wizard.open(), true);
  const sheet = () => got.doc.querySelector('.sh-ov[data-sheet="new-character"]');
  const go = step => sheet().querySelector(`.wz-steps button[data-value="${step}"]`).click();
  return { ...got, wizard, sheet, go };
}

test('the summary card: seven stat tiles, a raised one marked; the skills as a list (— before any); the steps before this one are done', { skip }, async t => {
  const w = await sheetOn(t);
  const tiles = () => w.sheet().querySelectorAll('.wz-sum .wz-tiles span');
  assert.deepEqual(tiles().map(tile => tile.textContent), ['STR5', 'VIT5', 'AGI5', 'DEX5', 'INT5', 'WIS5', 'CHA5']);
  assert.equal(w.sheet().querySelector('.wz-sum .wz-sk').textContent, '—');
  w.go('stats');
  w.sheet().querySelector('[data-plus="vit"]').click();
  assert.equal(tiles()[1].classList.contains('hi'), true, 'VIT raised');
  assert.equal(tiles()[0].classList.contains('hi'), false);
  assert.deepEqual(w.sheet().querySelectorAll('.wz-steps button').map(tab => tab.classList.contains('done')), [true, false, false, false]);
  w.go('skills');
  w.sheet().querySelector('.wz-set').click();
  const names = w.sheet().querySelectorAll('.wz-sum .wz-sk li').map(li => li.textContent);
  assert.ok(names.length > 0, 'the set\'s skills are listed');
  assert.ok(w.sheet().querySelector('.wz-cards .wz-skill'), 'the skill cards sit in their own box (two to a row from 1100 px)');
});

test('the portrait: a You with a name gets the persona\'s picture on the tile; an unsafe value is never used', { skip }, async t => {
  const w = await sheetOn(t, { portrait: '/User%20Avatars/wessel.png' });
  const ava = w.sheet().querySelector('.wz-ava');
  assert.equal(ava.classList.contains('wz-pic'), true);
  assert.equal(ava.textContent, 'W', 'the initial stays (hidden by the picture from 1100 px)');
  const bad = await sheetOn(t, { portrait: 'x") ; background:red' });
  assert.equal(bad.sheet().querySelector('.wz-ava').classList.contains('wz-pic'), false);
});

test('Stats: the notes, then the rows, then Points left · the HP line · Reset (on a phone CSS puts Reset above the rows)', { skip }, async t => {
  const w = await sheetOn(t);
  w.go('stats');
  const step = w.sheet().querySelector('.wz-body').children[0];
  const kids = [...step.children].map(node => node.dataset?.wiz ?? node.className);
  assert.deepEqual(kids, ['stats-note', 'wz-rows', 'wz-left']);
  assert.deepEqual([...step.querySelector('.wz-left').children].map(node => node.dataset?.wiz ?? node.className), ['chip2 wz-left-pill', 'growth', 'reset']);
  assert.equal(step.querySelector('.wz-left-pill').textContent, 'Points left: 10');
});

test('Review: "Fix the problem above, then Create." sits beside Create only while a problem holds it back', { skip }, async t => {
  const w = await sheetOn(t);
  w.go('review');
  assert.equal(w.sheet().querySelector('.wz-foot .wz-hint'), null, 'a named You has no problem');
  w.go('who');
  const name = w.sheet().querySelector('[data-wiz="name"]');
  name.value = '';
  name.dispatch?.('input') ?? name.dispatchEvent(new Event('input'));
  w.go('review');
  const foot = w.sheet().querySelector('.wz-foot');
  assert.equal(foot.querySelector('.wz-hint')?.textContent, 'Fix the problem above, then Create.');
  assert.deepEqual([...foot.children].slice(-2).map(node => node.dataset?.wiz ?? node.className), ['wz-hint', 'create']);
});

test('a redraw on the same step keeps the step\'s scroll; another step starts at the top', { skip }, async t => {
  const w = await sheetOn(t);
  w.go('skills');
  w.sheet().querySelector('.wz-set').click();
  w.sheet().querySelector('.wz-body').scrollTop = 240;
  w.sheet().querySelector('[data-wiz="add"]').click();
  assert.equal(w.sheet().querySelector('.wz-body').scrollTop, 240, 'Add a skill redrew the step where it was');
  w.go('review');
  assert.equal(w.sheet().querySelector('.wz-body').scrollTop || 0, 0);
});
