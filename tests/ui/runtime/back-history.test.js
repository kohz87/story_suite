// The browser's (and a phone's) Back walks the suite's back-stack (soak #12): the dossier first, then the suite, and only then the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { mountSuite } from '../../../ui/mount.js';
import { createFakePort } from '../../../ui/port/fake-port.js';
import { createBackStack } from '../../../ui/runtime/back-stack.js';
import { bindBackHistory } from '../../../ui/runtime/back-history.js';

// A window with a history: pushState drops the forward entries; back() lands later (as in a browser) and fires popstate then; `userBack()` is the Back button.
function fakeWindow() {
  const entries = [{ state: null }];
  let at = 0;
  const pending = [];
  const listeners = new Set();
  const fire = () => { for (const fn of [...listeners]) fn({ type: 'popstate' }); };
  const step = () => { if (at > 0) { at -= 1; fire(); } };
  return {
    history: {
      get state() { return entries[at].state; },
      pushState(state) { entries.splice(at + 1); entries.push({ state }); at += 1; },
      back() { pending.push(step); },
    },
    addEventListener(type, fn) { if (type === 'popstate') listeners.add(fn); },
    removeEventListener(type, fn) { if (type === 'popstate') listeners.delete(fn); },
    userBack: step,
    land() { while (pending.length) pending.shift()(); },
    get at() { return at; },
    get length() { return entries.length; },
    listeners: () => listeners.size,
  };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const layer = doc => doc.body.querySelector('.su-layer').getAttribute('data-state');

function boot() {
  const doc = installFakeDom();
  const win = fakeWindow();
  doc.defaultView = win;
  const suite = mountSuite({ port: createFakePort(), doc, initial: 'people' });
  return { doc, win, suite };
}

test('Back closes the dossier, then the suite, and only then would leave the page (soak #12)', async () => {
  const { doc, win, suite } = boot();
  await tick();
  assert.equal(win.at, 0, 'nothing is added while the suite is closed');
  suite.open('people');
  await tick();
  assert.equal(win.at, 1, 'one entry of the suite\'s own');
  doc.body.querySelector('[data-person-id="torka"]').click();
  await tick();
  assert.equal(win.at, 1, 'still one: the dossier does not add a second');
  win.userBack();
  await tick();
  assert.equal(doc.body.querySelector('.dossier'), null, 'Back closed the dossier');
  assert.equal(layer(doc), 'open', 'the suite is still open');
  assert.equal(win.at, 1, 'and the entry is back for the next Back');
  win.userBack();
  await tick();
  assert.equal(layer(doc), 'closed', 'Back closed the suite');
  assert.equal(win.at, 0, 'the page is where it was: the next Back is the page\'s own');
  suite.destroy();
  assert.equal(win.listeners(), 0, 'destroy stops listening');
});

test('closing by Escape takes the entry off, and that popstate closes nothing; reopening before it lands still gets an entry', async () => {
  const { win, suite } = boot();
  suite.open('now');
  await tick();
  assert.equal(win.at, 1);
  assert.equal(suite.backStack.handleKeydown({ key: 'Escape', preventDefault() {} }), true);
  await tick();
  win.land();
  await tick();
  assert.equal(win.at, 0, 'history.back() took the suite\'s entry off');
  assert.equal(suite.backStack.size(), 0);
  suite.open('now');
  await tick();
  suite.close();
  await tick();
  suite.open('now');
  await tick();
  win.land();
  await tick();
  assert.equal(suite.backStack.hasLayer('suite'), true, 'the late popstate did not close the reopened suite');
  assert.equal(win.at, 1, 'the reopened suite has its entry');
  suite.destroy();
});

test('Settings on a section page: Back goes to the list first (the close is refused) and the entry is put back', async () => {
  const doc = installFakeDom();
  const win = fakeWindow();
  const stack = createBackStack();
  let page = 'section';
  stack.push({ id: 'suite', layer: 'suite', close: () => {} });
  stack.push({ id: 'settings', layer: 'settings', close: () => { if (page === 'section') { page = 'list'; return false; } return true; } });
  const off = bindBackHistory(stack, win);
  await tick();
  assert.equal(win.at, 1);
  win.userBack();
  await tick();
  assert.equal(page, 'list');
  assert.equal(stack.has('settings'), true);
  assert.equal(win.at, 1, 'armed again');
  win.userBack();
  await tick();
  assert.equal(stack.has('settings'), false);
  assert.equal(win.at, 1, 'the suite is still open');
  off();
  assert.equal(doc.body.children.length, 0);
});

test('a page without a history API gets a no-op', () => {
  const stack = createBackStack();
  assert.equal(typeof bindBackHistory(stack, null), 'function');
  assert.equal(typeof bindBackHistory(stack, { addEventListener() {} }), 'function');
});
