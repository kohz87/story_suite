import test from 'node:test';
import assert from 'node:assert/strict';
import { makeMessage } from '../../helpers/ui-fake-dom.js';
import { installFakeDom } from '../helpers/dom.js';
import { messageElement, addMenuEntry, fillInput, chatPrefs } from '../../../ui/port/st-chat.js';

test('messageElement finds a reply by mesid and returns null otherwise', () => {
  const doc = installFakeDom();
  const m = makeMessage(doc, 3);
  assert.equal(messageElement(doc, 3), m);
  assert.equal(messageElement(doc, 4), null);
  assert.equal(messageElement(doc, -1), null);
  assert.equal(messageElement(doc, '3'), null);
  assert.equal(messageElement(null, 3), null);
});

test('addMenuEntry adds one clickable item once, and nothing without the menu', () => {
  const doc = installFakeDom();
  assert.equal(addMenuEntry(doc, { label: 'Suite' }), null);
  const menu = doc.createElement('div');
  menu.id = 'extensionsMenu';
  doc.body.appendChild(menu);
  let clicks = 0;
  const item = addMenuEntry(doc, { label: 'Suite', onClick: () => { clicks += 1; } });
  assert.equal(item.textContent, 'Suite');
  item.click();
  assert.equal(clicks, 1);
  assert.equal(addMenuEntry(doc, { label: 'Suite' }), null);
  assert.equal(menu.children.length, 1);
  assert.equal(addMenuEntry(doc, {}), null);
});

test('fillInput sets the box text, fires input, and reports a missing box', () => {
  const doc = installFakeDom();
  assert.equal(fillInput(doc, 'x'), false);
  const box = doc.createElement('textarea');
  box.id = 'send_textarea';
  doc.body.appendChild(box);
  let seen = 0;
  box.addEventListener('input', () => { seen += 1; });
  assert.equal(fillInput(doc, 'Ask Mira about the ledger.'), true);
  assert.equal(box.value, 'Ask Mira about the ledger.');
  assert.equal(seen, 1);
  assert.equal(fillInput(doc, null), true);
  assert.equal(box.value, '');
});

test('chatPrefs reads and writes chat metadata and saves', () => {
  let saved = 0;
  const ctx = { chatMetadata: {}, saveMetadataDebounced() { saved += 1; } };
  const prefs = chatPrefs(() => ctx);
  assert.deepEqual(prefs.get(), {});
  assert.equal(prefs.set('scene', true), true);
  assert.equal(prefs.set('plan', false), true);
  assert.deepEqual(prefs.get(), { scene: true, plan: false });
  assert.equal(saved, 2);
});

test('chatPrefs refuses without metadata or a key, and ignores a bad saved value', () => {
  const none = chatPrefs(null);
  assert.deepEqual(none.get(), {});
  assert.equal(none.set('scene', true), false);
  const ctx = { chatMetadata: { storySuiteUiPrefs: ['bad'] } };
  const prefs = chatPrefs(ctx);
  assert.deepEqual(prefs.get(), {});
  assert.equal(prefs.set('', true), false);
  const throwing = chatPrefs(() => { throw new Error('no chat'); });
  assert.equal(throwing.set('scene', true), false);
  const noSave = chatPrefs({ chatMetadata: {}, saveMetadata() { throw new Error('x'); } });
  assert.equal(noSave.set('a', 1), true);
});
