// The wizard's guards, each pinned so that taking it out fails a test (REVWIZ1 follow-up 2 and 3): an open while one is up (its own words) and with the
// RPG off, the Send hold while a reply is generating and when SillyTavern does not send on Enter, the You rule with and without a persona name,
// ownerFor for a You, and Create sending nothing once the chat has changed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hostAvailable } from '../../../testkit/index.js';
import { CORE_FEATURE } from '../../../core/features.js';
import { page, begin, settle } from '../../modules/rpg/view/page.js';
import { createBackStack } from '../../../ui/runtime/back-stack.js';
import { attachWizard } from '../../../ui/wizard/attach.js';
import { createNewWizard, WIZARD_ID } from '../../../ui/wizard/wizard.js';
import { createWizardWorld, hasYouIn } from '../../../ui/wizard/world.js';
import { ownerFor } from '../../../modules/rpg/view/wizard-data-parts/create-run.js';
import { wizardPage, settleLong, click } from './page.js';

const available = await hostAvailable();
const skip = available.ok ? false : available.reason;

async function mounted(t) {
  const got = await page(t, { formula: 'standard', persona: 'Wessel' });
  await begin(got.host);
  await settle();
  const backStack = createBackStack();
  t.after(backStack.bindDocument(got.doc));
  const suite = { isOpen: () => true, backStack, root: got.doc.body };
  const attach = attachWizard({ doc: got.doc, ctx: () => got.host.ctx, sdk: got.host.sdk, suite });
  t.after(() => attach.destroy());
  return { ...got, attach, backStack };
}

test('a second open says the window is open already; with the RPG off the window is refused in its own words; neither opens a second sheet', { skip }, async t => {
  const m = await mounted(t);
  assert.equal(m.attach.open(WIZARD_ID, null), true);
  assert.deepEqual(m.attach.open(WIZARD_ID, null), { ok: false, code: 'FAILED', message: 'The New character window is open already.' });
  assert.equal(m.doc.querySelectorAll('.sh-ov[data-sheet="new-character"]').length, 1);
  m.attach.wizard.close();
  m.host.features.set(CORE_FEATURE.leanRpg, false);
  await settleLong();
  assert.deepEqual(m.attach.open(WIZARD_ID, null), { ok: false, code: 'FAILED', message: 'That window is not available now.' });
  assert.equal(m.doc.querySelector('.sh-ov[data-sheet="new-character"]'), null, 'nothing opened');
  assert.equal(m.attach.open('story-block/other', null), false, 'another window is not this view\'s');
});

test('the hold lets a Send through while a reply is generating, and Enter when SillyTavern does not send on Enter', { skip }, async t => {
  const busy = await wizardPage(t);
  const stop = busy.doc.createElement('div');
  stop.id = 'mes_stop';
  busy.doc.body.appendChild(stop);
  busy.win.getComputedStyle = () => ({ display: 'block' });
  busy.field.value = 'Hello.';
  busy.press();
  await settleLong();
  assert.equal(busy.hold(), null, 'not held while generating');
  assert.deepEqual(busy.sent, ['Hello.']);
  const lines = await wizardPage(t);
  lines.host.ctx.shouldSendOnEnter = () => false;
  lines.field.value = 'Hello.';
  lines.enter();
  await settleLong();
  assert.equal(lines.hold(), null, 'Enter is a line break there: nothing held');
});

test('You: with a persona name only a character of that name counts; with none, any character does; ownerFor is the bag for a You even when a party actor shares the name', { skip }, async t => {
  const p = await wizardPage(t);
  p.doc.querySelector('#story-suite-ui-menu').click();
  await settleLong();
  p.doc.querySelector('.su-strip .su-tab[data-tab="party"]').click();
  await settleLong();
  p.doc.querySelector('.su-panel [data-act="new-character"]').click();
  await settleLong();
  click(p.sheet(), '.wz-steps button[data-value="review"]');
  click(p.sheet(), '[data-wiz="create"]');
  await settleLong();
  const state = createWizardWorld({ sdk: p.host.sdk, ctx: () => p.host.ctx }).headState();
  assert.equal(hasYouIn(state, 'Wessel'), true);
  assert.equal(hasYouIn(state, 'Someone Else'), false, 'a character, but not the persona\'s: no You yet');
  assert.equal(hasYouIn(state, ''), true, 'no persona name: any character counts (the old hold\'s rule)');
  assert.equal(hasYouIn(null, ''), false);
  const query = () => [{ id: 'mara', name: 'Mara' }];
  assert.equal(ownerFor({ kind: 'you', name: 'Mara' }, query), 'party');
  assert.equal(ownerFor({ kind: 'companion', name: ' mara ' }, query), 'mara');
  assert.equal(ownerFor({ kind: 'companion', name: 'Nobody' }, query), 'party');
});

test('Create sends nothing once the chat has changed under the sheet', { skip }, async t => {
  const got = await page(t, { formula: 'standard', persona: 'Wessel' });
  await begin(got.host);
  await settle();
  const sent = [];
  let chat = 'chat-1';
  const world = { ...createWizardWorld({ sdk: got.host.sdk, ctx: () => got.host.ctx }) };
  world.chatId = () => chat;
  const wizard = createNewWizard({ world, command: (type, payload) => { sent.push(type); return got.host.sdk.command(type, payload, { cause: 'ui' }); }, sheetCtx: () => ({ doc: got.doc, sheetHost: got.doc.body }) });
  assert.equal(wizard.open(), true);
  const sheet = got.doc.querySelector('.sh-ov[data-sheet="new-character"]');
  click(sheet, '.wz-steps button[data-value="review"]');
  chat = 'chat-2';
  click(sheet, '[data-wiz="create"]');
  await settleLong();
  assert.deepEqual(sent, [], 'no command reached the other chat');
  assert.ok(sheet.querySelector('.wz-status').textContent.length > 0, 'the reader is told it did not work');
});
