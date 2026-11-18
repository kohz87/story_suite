// Entry 1 on the live mount: the first Send of a chat with the RPG on and no You is held by the new view's sheet "Make your character first"
// and its two answers and its close do what the earlier dialog did.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hostAvailable } from '../../../testkit/index.js';
import { startNotes } from '../../../modules/rpg/start.js';
import { CORE_FEATURE } from '../../../core/features.js';
import { wizardPage, settleLong, click, party } from './page.js';

const available = await hostAvailable();
const skip = available.ok ? false : available.reason;
const layer = doc => doc.querySelector('.su-layer').getAttribute('data-state');
const notes = p => startNotes(p.host.ctx.chatMetadata);

async function held(t, text = 'I step onto the barge.') {
  const p = await wizardPage(t);
  p.field.value = text;
  const event = p.press();
  await settleLong();
  return { ...p, event };
}

test('the first Send is held by the new sheet: the text stays in the box, nothing is sent', { skip }, async t => {
  const p = await held(t);
  assert.ok(p.event.defaultPrevented, 'the click is stopped');
  assert.deepEqual(p.sent, [], 'SillyTavern did not send');
  assert.equal(p.field.value, 'I step onto the barge.', 'the message never leaves the box');
  const hold = p.hold();
  assert.ok(hold, 'the new sheet is open');
  assert.equal(layer(p.doc), 'open', 'inside the suite, opened for it');
  assert.equal(hold.querySelector('.sh-h h3').textContent, 'Make your character first');
  assert.equal(hold.querySelector('.wz-quote').textContent, 'I step onto the barge.');
  assert.deepEqual(hold.querySelectorAll('.wz-hold-acts button').map(b => b.textContent), ['Send without the RPG for now', 'Create your character, then send']);
});

test('Create your character, then send: the wizard opens; Create makes You, closes the suite and sends the message', { skip }, async t => {
  const p = await held(t);
  click(p.hold(), '[data-hold="create"]');
  await settleLong();
  assert.equal(p.hold(), null);
  const sheet = p.sheet();
  assert.ok(sheet, 'the new wizard');
  click(sheet, '.wz-steps button[data-value="review"]');
  click(sheet, '[data-wiz="create"]');
  await settleLong();
  assert.equal(p.sheet(), null, 'Create closed it');
  assert.deepEqual(party(p.host), ['Wessel', 'Wessel'], 'You: a Character and its Skills');
  assert.deepEqual(p.sent, ['I step onto the barge.'], 'sent once, past both holds (the story has You now)');
  assert.equal(layer(p.doc), 'closed', 'back at the chat');
  assert.ok(p.commands.filter(c => c.type === 'dm.define').every(c => c.options?.cause === 'ui'), 'the reader\'s own commands, as the old window sends them');
});

test('the wizard cancelled: the text stays, nothing is sent, the next Send asks again', { skip }, async t => {
  const p = await held(t);
  click(p.hold(), '[data-hold="create"]');
  await settleLong();
  click(p.sheet(), '.sh-x');
  await settleLong();
  assert.deepEqual(p.sent, []);
  assert.equal(p.field.value, 'I step onto the barge.');
  assert.equal(layer(p.doc), 'closed');
  p.press();
  await settleLong();
  assert.ok(p.hold(), 'held again');
});

test('Send without the RPG for now: sent as usual, the chat remembers (no dice for that reply), never asked again', { skip }, async t => {
  const p = await held(t);
  click(p.hold(), '[data-hold="without"]');
  await settleLong();
  assert.deepEqual(p.sent, ['I step onto the barge.']);
  assert.deepEqual(notes(p), { hidden: false, asked: true, skip: true }, 'the same chat notes the old dialog writes');
  assert.equal(layer(p.doc), 'closed');
  p.field.value = 'And again.';
  p.press();
  await settleLong();
  assert.deepEqual(p.sent, ['I step onto the barge.', 'And again.']);
  assert.equal(p.hold(), null);
});

test('closing the sheet (× or Escape) puts the text back and closes the suite; the next Send asks again', { skip }, async t => {
  const p = await held(t);
  p.field.value = '';
  click(p.hold(), '.sh-x');
  await settleLong();
  assert.equal(p.field.value, 'I step onto the barge.', 'back in the box');
  assert.equal(layer(p.doc), 'closed');
  assert.equal(notes(p).asked, false);
  p.press();
  await settleLong();
  assert.ok(p.hold());
  p.doc.key('Escape');
  await settleLong();
  assert.equal(p.hold(), null, 'Escape closes it');
});

test('Enter in the box is held the same way; Shift+Enter, a slash command, an empty box are not', { skip }, async t => {
  const p = await wizardPage(t);
  p.field.value = 'Hello.';
  assert.equal(p.enter({ shiftKey: true }).defaultPrevented, false);
  p.field.value = '/help';
  p.press();
  p.field.value = '   ';
  p.press();
  await settleLong();
  assert.equal(p.hold(), null);
  p.field.value = 'Hello.';
  assert.equal(p.enter().defaultPrevented, true);
  await settleLong();
  assert.ok(p.hold());
});

test('nothing is held with the RPG off (once the story has You, the Create test above sends past the hold)', { skip }, async t => {
  const off = await wizardPage(t);
  off.host.features.set(CORE_FEATURE.leanRpg, false);
  await settleLong();
  off.field.value = 'Hello.';
  off.press();
  await settleLong();
  assert.equal(off.hold(), null);
  assert.deepEqual(off.sent, ['Hello.']);
});

test('a chat change closes the hold and the wizard (the old dialog\'s rule: the text goes back)', { skip }, async t => {
  const p = await held(t);
  click(p.hold(), '[data-hold="create"]');
  await settleLong();
  assert.ok(p.sheet());
  await p.host.st.loadChat(JSON.parse(JSON.stringify(p.host.ctx.chat)), 'another-chat');
  await settleLong();
  assert.equal(p.sheet(), null);
  assert.deepEqual(p.sent, [], 'nothing sent into either chat');
});

// soak #17: after Create the suite closes and the focus is in the message box (a touch screen gets it back on the Send it pressed, no keyboard popping up)
async function createdFrom(t, touch) {
  const p = await wizardPage(t);
  if (touch) p.win.matchMedia = query => ({ matches: query === '(pointer: coarse)' });
  const send = p.doc.getElementById('send_but');
  send.focus();
  p.field.value = 'I step onto the barge.';
  p.press();
  await settleLong();
  assert.notEqual(p.doc.activeElement, send, 'the suite took the focus');
  click(p.hold(), '[data-hold="create"]');
  await settleLong();
  click(p.sheet(), '.wz-steps button[data-value="review"]');
  click(p.sheet(), '[data-wiz="create"]');
  await settleLong();
  assert.equal(layer(p.doc), 'closed');
  assert.deepEqual(p.sent, ['I step onto the barge.']);
  return { p, send };
}

test('after Create the focus is in the message box, not on the page body', { skip }, async t => {
  const { p } = await createdFrom(t, false);
  assert.equal(p.doc.activeElement, p.field);
});

test('after Create on a touch screen the focus is back on the Send button', { skip }, async t => {
  const { p, send } = await createdFrom(t, true);
  assert.equal(p.doc.activeElement, send);
});
