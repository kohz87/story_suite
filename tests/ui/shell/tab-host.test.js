import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../packages/story-block/tests/ui-fake-dom.js';
import { createTabHost, visibleTabs } from '../../../ui/shell/tab-host.js';

const ids = (host) => host.el.querySelectorAll('.su-tab').map((n) => n.getAttribute('data-tab'));

test('visibleTabs applies the Party and Fight show rules', () => {
  assert.deepEqual(visibleTabs(), ['now', 'party', 'bag', 'people', 'world', 'journal', 'story']);
  assert.deepEqual(visibleTabs({ rpg: false }), ['now', 'bag', 'people', 'world', 'journal', 'story']);
  assert.equal(visibleTabs({ rpg: true, fightOpen: true }).length, 8);
  assert.deepEqual(visibleTabs({ rpg: false, fightOpen: true }).slice(-1), ['fight']);
});

test('the Scene tab shows only while an interaction is open, between Story and Fight', () => {
  assert.equal(visibleTabs().includes('scene'), false);
  assert.deepEqual(visibleTabs({ sceneOpen: true, fightOpen: true }).slice(-3), ['story', 'scene', 'fight']);
});

test('renders strip and phone bar with labels, one current tab', () => {
  installFakeDom();
  const host = createTabHost();
  assert.deepEqual(ids(host), visibleTabs());
  const tabs = host.el.querySelectorAll('.su-tab');
  assert.equal(tabs[0].getAttribute('aria-selected'), 'true');
  assert.equal(tabs[1].getAttribute('aria-selected'), 'false');
  assert.equal(tabs[0].getAttribute('role'), 'tab');
  assert.equal(host.el.querySelector('.su-strip').getAttribute('role'), 'tablist');
  const bar = host.el.querySelectorAll('.su-bar-btn');
  assert.equal(bar.length, 7);
  assert.equal(bar[0].querySelector('.su-bar-label').textContent, 'Now');
  assert.equal(bar[0].getAttribute('aria-current'), 'true');
  assert.ok(tabs[0].querySelector('svg'));
});

test('clicking a tab selects it, resets scroll and calls onSelect once', () => {
  installFakeDom();
  const picked = [];
  const host = createTabHost({ onSelect: (id) => picked.push(id) });
  host.scroll.scrollTop = 300;
  host.el.querySelector('.su-bar-btn[data-tab="bag"]').click();
  assert.equal(host.current(), 'bag');
  assert.equal(host.scroll.scrollTop, 0);
  assert.equal(host.panel.getAttribute('data-tab'), 'bag');
  assert.equal(host.el.querySelector('.su-tab[data-tab="bag"]').getAttribute('aria-selected'), 'true');
  host.select('bag');
  assert.deepEqual(picked, ['bag']);
});

test('select refuses a hidden tab', () => {
  installFakeDom();
  const host = createTabHost({ flags: { rpg: false } });
  assert.equal(host.select('party'), false);
  assert.equal(host.select('fight'), false);
  assert.equal(host.current(), 'now');
});

test('setFlags adds Fight, and falls back to Now when the current tab disappears', () => {
  installFakeDom();
  const host = createTabHost();
  assert.equal(host.setFlags({ fightOpen: true }).length, 8);
  host.select('fight');
  assert.equal(host.current(), 'fight');
  host.setFlags({ fightOpen: false });
  assert.equal(host.current(), 'now');
  host.select('party');
  host.setFlags({ rpg: false });
  assert.equal(host.current(), 'now');
  assert.equal(ids(host).includes('party'), false);
  assert.deepEqual(host.tabs(), visibleTabs({ rpg: false }));
});

test('arrow keys, Home and End move the selection with wrap', () => {
  installFakeDom();
  const host = createTabHost();
  const key = (k) => host.el.querySelector(`.su-tab[data-tab="${host.current()}"]`).dispatch('keydown', { key: k });
  key('ArrowRight');
  assert.equal(host.current(), 'party');
  key('ArrowLeft');
  key('ArrowLeft');
  assert.equal(host.current(), 'story');
  key('Home');
  assert.equal(host.current(), 'now');
  key('End');
  assert.equal(host.current(), 'story');
  key('x');
  assert.equal(host.current(), 'story');
});

test('mini bar appears after the card scrolls away, never on Fight, and its buttons call back', () => {
  installFakeDom();
  const calls = [];
  const host = createTabHost({ onChat: () => calls.push('chat'), onSettings: () => calls.push('settings') });
  const mini = host.el.querySelector('.su-mini');
  host.cardSlot.offsetTop = 0;
  host.cardSlot.offsetHeight = 120;
  host.scroll.scrollTop = 50;
  host.scroll.dispatch('scroll');
  assert.equal(mini.classList.contains('on'), false);
  host.scroll.scrollTop = 200;
  host.scroll.dispatch('scroll');
  assert.equal(mini.classList.contains('on'), true);
  mini.querySelector('[data-act="chat"]').click();
  mini.querySelector('[data-act="settings"]').click();
  assert.deepEqual(calls, ['chat', 'settings']);
  host.setFlags({ fightOpen: true });
  host.select('fight');
  host.scroll.scrollTop = 400;
  host.scroll.dispatch('scroll');
  assert.equal(mini.classList.contains('on'), false);
});

test('exposes the card slot, strip and panel inside the scroll area', () => {
  installFakeDom();
  const host = createTabHost();
  assert.ok(host.scroll.contains(host.cardSlot));
  assert.ok(host.scroll.contains(host.panel));
  assert.ok(host.scroll.contains(host.el.querySelector('.su-strip')));
});
