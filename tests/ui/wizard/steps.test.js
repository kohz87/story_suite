// The new wizard's steps keep the old wizard's rules (modules/rpg's wizard-data): the stat budget and bounds, the starting sets, the skill rows
// (one Adept, signature skills fixed), a saved character's import and its undo, the problems that stop Create, the "made, but not …" end,
// and `onEnd(created)` told exactly once however the sheet closes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hostAvailable } from '../../../testkit/index.js';
import { page, begin, settle } from '../../modules/rpg/view/page.js';
import { CHAR_FILE } from '../../../modules/rpg/charfile.js';
import { createWizardWorld } from '../../../ui/wizard/world.js';
import { createNewWizard } from '../../../ui/wizard/wizard.js';
import { createBackStack } from '../../../ui/runtime/back-stack.js';

const available = await hostAvailable();
const skip = available.ok ? false : available.reason;
// (the fake page keeps a `disabled` or `hidden` attribute apart from the property: either counts)
const off = node => node.disabled === true || node.hasAttribute('disabled');
const long = async () => { for (let n = 0; n < 6; n += 1) await settle(); };
const SAVED = JSON.stringify({ [CHAR_FILE]: 1, soul: 2, points: 3, stats: { str: 14, vit: 12, agi: 11, dex: 10, int: 8, wis: 9, cha: 10 },
  skills: [{ name: 'Iron Breath', about: 'Steadies the lungs.', stat: 'vit', uses: 'stamina', rank: 2 }], items: [{ name: 'Torch', qty: 2 }], money: 5 });

async function sheetOn(t, { prefill = null, chat = true, wrap = null } = {}) {
  const got = await page(t, { formula: 'standard', persona: 'Wessel', ...(wrap ? { wrap } : {}) });
  if (chat) await begin(got.host);
  else { got.host.ctx.chat.splice(0); await got.host.turn.onTimelineChanged(); }
  await settle();
  const sdk = { ...got.host.sdk, command: wrap ? (type, payload, options) => wrap(type, payload, options, (...a) => got.host.sdk.command(...a)) : got.host.sdk.command };
  const world = createWizardWorld({ sdk, ctx: () => got.host.ctx });
  const backStack = createBackStack();
  const unbind = backStack.bindDocument(got.doc);
  t.after(unbind);
  const ends = [];
  const wizard = createNewWizard({ world, command: (type, payload) => sdk.command(type, payload, { cause: 'ui' }), sheetCtx: () => ({ doc: got.doc, backStack, sheetHost: got.doc.body }) });
  assert.equal(wizard.open(prefill, { onEnd: created => ends.push(created) }), true);
  const sheet = () => got.doc.querySelector('.sh-ov[data-sheet="new-character"]');
  const go = step => sheet().querySelector(`.wz-steps button[data-value="${step}"]`).click();
  const pill = () => sheet().querySelector('.wz-pill').textContent;
  return { ...got, wizard, sheet, go, pill, ends };
}

test('Stats: + and − spend and free points within the bounds; Reset puts them back; the HP · MP · SP line follows', { skip }, async t => {
  const w = await sheetOn(t);
  w.go('stats');
  assert.equal(w.pill(), 'Points left: 10');
  const row = stat => w.sheet().querySelector(`.ps-st[data-stat="${stat}"]`);
  assert.equal(off(row('str').querySelector('[data-minus="str"]')), true, '5 is the minimum');
  const growth = w.sheet().querySelector('[data-wiz="growth"]').textContent;
  for (let n = 0; n < 5; n += 1) row('vit').querySelector('[data-plus="vit"]').click();
  assert.equal(row('vit').querySelector('.v').textContent, '10');
  assert.ok(row('vit').querySelector('.v').classList.contains('up'));
  assert.equal(off(row('vit').querySelector('[data-plus="vit"]')), true, '10 is the most at creation');
  assert.equal(w.pill(), 'Points left: 5');
  assert.notEqual(w.sheet().querySelector('[data-wiz="growth"]').textContent, growth, 'more VIT, more HP');
  for (let n = 0; n < 5; n += 1) row('str').querySelector('[data-plus="str"]').click();
  assert.equal(w.pill(), 'Points left: 0');
  assert.equal(off(row('dex').querySelector('[data-plus="dex"]')), true, 'no points left');
  w.sheet().querySelector('[data-wiz="reset"]').click();
  assert.equal(w.pill(), 'Points left: 10');
});

test('Skills: a starting set fills the rows; add and remove; only one may start at Adept', { skip }, async t => {
  const w = await sheetOn(t);
  w.go('skills');
  const sets = w.sheet().querySelectorAll('.wz-set');
  assert.ok(sets.length >= 1);
  sets[0].click();
  assert.equal(w.sheet().querySelector('.wz-set').getAttribute('aria-pressed'), 'true');
  const cards = () => w.sheet().querySelectorAll('.wz-skill');
  const filled = cards().length;
  assert.ok(filled > 0, 'the set\'s skills');
  assert.match(w.pill(), new RegExp(`^${filled} of \\d+ skills$`));
  w.sheet().querySelector('[data-wiz="add"]').click();
  assert.equal(cards().length, filled + 1);
  cards().at(-1).querySelector('[data-wiz="remove"]').click();
  assert.equal(cards().length, filled);
  const start = at => cards()[at].querySelector('select[data-field="start"]');
  start(0).value = '1';
  start(0).dispatch('change');
  assert.equal(start(1).querySelector('option[value="1"]').hasAttribute('disabled'), true, 'Adept is taken');
});

test('Edit first: a companion\'s signature skill keeps its stat, type and rank and cannot be removed', { skip }, async t => {
  const w = await sheetOn(t, { prefill: { name: 'Mara', soul: 3, best: 'int', skills: [{ name: 'Starfall', about: 'Calls the sky down.', stat: 'int', uses: 'mana', rank: 1, type: 'area' }] } });
  assert.equal(w.sheet().querySelector('[data-wiz="name"]').value, 'Mara');
  w.go('skills');
  const card = w.sheet().querySelector('.wz-skill[data-signature="true"]');
  assert.ok(card);
  for (const selector of ['select[data-field="stat"]', 'select[data-field="type"]', 'select[data-field="start"]', '[data-wiz="remove"]']) assert.equal(off(card.querySelector(selector)), true, selector);
  assert.equal(off(card.querySelector('input[data-field="name"]')), false, 'its name may be fixed');
});

test('Who: the name follows into the summary; the level is held to 1..cap; a saved file imports and Undo puts the draft back', { skip }, async t => {
  const w = await sheetOn(t);
  const name = w.sheet().querySelector('[data-wiz="name"]');
  name.value = 'Ren';
  name.dispatch('input');
  assert.match(w.sheet().querySelector('.wz-sum').textContent, /^R?Ren/);
  const level = w.sheet().querySelector('[data-wiz="level"]');
  level.value = '400';
  level.dispatch('change');
  assert.equal(w.sheet().querySelector('[data-wiz="level"]').value, '99');
  w.sheet().querySelector('input[type="file"]').files = [{ name: 'wessel.json', size: SAVED.length, text: async () => SAVED }];
  w.sheet().querySelector('input[type="file"]').dispatch('change');
  await long();
  assert.match(w.sheet().querySelector('[data-wiz="import-done"]').textContent, /Imported from wessel\.json/);
  w.go('stats');
  assert.equal(w.sheet().querySelector('.ps-st[data-stat="str"] .v').textContent, '14', 'the file\'s stats');
  w.go('who');
  w.sheet().querySelector('[data-wiz="import-undo"]').click();
  assert.ok(w.sheet().querySelector('[data-wiz="import"]'));
  w.go('stats');
  assert.equal(w.sheet().querySelector('.ps-st[data-stat="str"] .v').textContent, '5');
});

test('Review: the problems stop Create (no name); Back and Next walk the steps', { skip }, async t => {
  const w = await sheetOn(t);
  const name = w.sheet().querySelector('[data-wiz="name"]');
  name.value = '';
  name.dispatch('input');
  w.sheet().querySelector('[data-wiz="next"]').click();
  assert.equal(w.sheet().dataset.step, 'stats');
  w.sheet().querySelector('[data-wiz="back"]').click();
  assert.equal(w.sheet().dataset.step, 'who');
  w.go('review');
  assert.equal(w.sheet().querySelector('[data-wiz="next"]'), null, 'no Next on the last step');
  const problems = w.sheet().querySelector('.wz-problems');
  assert.equal(problems.hasAttribute('hidden'), false);
  assert.match(problems.textContent, /Give the character a name\./);
  assert.equal(off(w.sheet().querySelector('[data-wiz="create"]')), true);
});

test('a block the fights need refused: the character is made, the sheet says what was not added, Done closes; onEnd(true) once', { skip }, async t => {
  const refuse = (type, payload, options, real) => (type === 'dm.define' && payload?.definition?.role === 'foes' ? { ok: false, code: 'REFUSED', message: 'No.' } : real(type, payload, options));
  const w = await sheetOn(t, { wrap: refuse });
  w.go('review');
  w.sheet().querySelector('[data-wiz="create"]').click();
  await long();
  assert.match(w.sheet().querySelector('.wz-status').textContent, /Wessel is in the party\. Not added: Foes/);
  assert.deepEqual(w.ends, [], 'still open');
  w.sheet().querySelector('[data-wiz="done"]').click();
  assert.equal(w.sheet(), null);
  assert.deepEqual(w.ends, [true]);
});

test('Create with no message in the chat: one plain sentence, nothing made', { skip }, async t => {
  const w = await sheetOn(t, { chat: false });
  w.go('review');
  w.sheet().querySelector('[data-wiz="create"]').click();
  await long();
  assert.match(w.sheet().querySelector('.wz-status').textContent, /Start the chat first/);
  assert.equal(w.wizard.isOpen(), true);
  assert.equal(w.host.head(), null, 'nothing made');
});

test('onEnd(false) exactly once on ×, on Escape, and on the back stack; a closed sheet keeps nothing', { skip }, async t => {
  const w = await sheetOn(t);
  w.sheet().querySelector('.sh-x').click();
  w.wizard.close();
  assert.deepEqual(w.ends, [false]);
  assert.equal(w.wizard.session(), null);
  const again = [];
  assert.equal(w.wizard.open(null, { onEnd: created => again.push(created) }), true);
  w.doc.key('Escape');
  w.doc.key('Escape');
  assert.deepEqual(again, [false]);
  assert.equal(w.sheet(), null);
});
