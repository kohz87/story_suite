import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../../packages/story-block/tests/ui-fake-dom.js';
import { buildSettings } from '../../../../ui/fixtures/settings.js';
import { renderStartSection, renderModule, moduleState, sectionFrame } from '../../../../ui/settings/sections/start.js';

const setup = (extra = {}) => {
  const doc = installFakeDom();
  const settings = buildSettings(extra);
  const calls = [];
  const ctx = { doc, settings, onChange: (k, v) => calls.push(['c', k, v]), onAction: (k, l) => calls.push(['a', k, l]), go: id => calls.push(['go', id]) };
  const sec = id => settings.sections.find(s => s.id === id);
  return { doc, settings, calls, ctx, sec };
};

test('moduleState copies the view-model once per settings object and shares it', () => {
  const { ctx, settings } = setup();
  const a = moduleState(ctx);
  assert.equal(a, moduleState({ ...ctx }));
  a.chat.rpg.on = false;
  assert.equal(settings.modules.chat.rpg.on, true);
  assert.equal(a.scope, 'chat');
  assert.equal(a.preset, 'standard');
  assert.equal(moduleState({}).scope, 'chat');
});

test('Start shows scope, three presets, five collapsed module blocks and the removed list', () => {
  const { ctx, sec } = setup();
  const [wrap] = renderStartSection(sec('start'), ctx);
  assert.equal(wrap.querySelectorAll('.pre').length, 3);
  assert.equal(wrap.querySelector('.pre[aria-pressed="true"] b').textContent, 'Standard');
  assert.equal(wrap.querySelector('.custom'), null);
  assert.equal(wrap.querySelectorAll('.mod').length, 5);
  assert.equal(wrap.querySelectorAll('.msubs').length, 0);
  assert.equal(wrap.querySelectorAll('.removed li').length, 10);
  assert.equal(wrap.querySelector('.mod[data-mod="rpg"] .mc').textContent, '3 of 3 on · ≈ 520 tokens');
});

test('Features opens the switches, a switch change marks Custom and emits the path', () => {
  const { ctx, sec, calls } = setup();
  const [wrap] = renderStartSection(sec('start'), ctx);
  wrap.querySelector('.mod[data-mod="people"] .lnk').click();
  const subs = wrap.querySelectorAll('.mod[data-mod="people"] .msubs .srow');
  assert.equal(subs.length, 5);
  wrap.querySelector('[data-sub="people:drift"]').click();
  assert.deepEqual(calls.at(-1), ['c', 'modules.chat.people.subs.drift', true]);
  assert.ok(wrap.querySelector('.custom'));
  assert.equal(wrap.querySelector('.pre[aria-pressed="true"]'), null);
  assert.equal(wrap.querySelector('.mod[data-mod="people"] .mc').textContent, '5 of 5 on · ≈ 820 tokens');
});

test('a preset emits modules.preset; the scope switch swaps to the New chats set', () => {
  const { ctx, sec, calls } = setup({ rpg: false });
  const [wrap] = renderStartSection(sec('start'), ctx);
  assert.equal(wrap.querySelector('.mod[data-mod="rpg"]').className, 'mod off');
  wrap.querySelector('.pre[data-pre="lean"]').click();
  assert.deepEqual(calls.at(-1), ['c', 'modules.preset', 'lean']);
  assert.equal(wrap.querySelector('.pre[aria-pressed="true"] b').textContent, 'Lean');
  wrap.querySelector('.scope .seg button[data-value="newChats"]').click();
  assert.deepEqual(calls.at(-1), ['c', 'modules.scope', 'newChats']);
  assert.equal(wrap.querySelector('.mod[data-mod="rpg"]').className, 'mod');
  wrap.querySelector('.btn2').click();
  assert.deepEqual(calls.at(-1), ['a', 'reset.start', 'Reset to Standard']);
});

test('a module switch greys its features; needs lines show ok or (off)', () => {
  const { ctx, sec } = setup();
  const state = moduleState(ctx);
  state.chat.director.subs.checks = false;
  const [wrap] = renderStartSection(sec('start'), ctx);
  wrap.querySelector('.mod[data-mod="people"] .lnk').click();
  const need = wrap.querySelectorAll('.mod[data-mod="people"] .needbad');
  assert.equal(need[0].textContent, 'needs Checks (off)');
  wrap.querySelector('.mod[data-mod="people"] .mh .sw').click();
  assert.equal(wrap.querySelector('.mod[data-mod="people"]').className, 'mod off');
  assert.equal(wrap.querySelector('.mod[data-mod="people"] .srow').className.includes('dis'), true);
  assert.equal(wrap.querySelector('.mod[data-mod="people"] .mc').textContent, 'off');
  assert.ok(wrap.querySelector('.needok'));
});

test('Settings › goes to the module page through ctx.go', () => {
  const { ctx, sec, calls } = setup();
  const [wrap] = renderStartSection(sec('start'), ctx);
  wrap.querySelector('.mod[data-mod="world"] [data-sec="world"]').click();
  assert.deepEqual(calls.at(-1), ['go', 'world']);
});

test('renderModule in page mode is open with no footer and repaints itself', () => {
  const { ctx } = setup();
  const meta = { id: 'extras', name: 'Chat extras', icon: '✦', sec: 'extras', tok: 180, desc: 'd', off: 'o', subs: [{ key: 'choices', name: 'Choices', desc: 'x', tags: ['cost:tokens'], needs: null }] };
  const el = renderModule(meta, ctx, { page: true });
  assert.equal(el.querySelectorAll('.msubs .srow').length, 1);
  assert.equal(el.querySelector('.mf'), null);
  assert.equal(el.querySelector('.tg2.cost').textContent, 'tokens');
  el.querySelector('.mh .sw').click();
  assert.equal(el.className, 'mod off');
});

test('sectionFrame orders applies note, module block, before, groups, after and Reset', () => {
  const { ctx, sec, calls } = setup();
  const p = globalThis.document.createElement('p');
  const nodes = sectionFrame(sec('people'), ctx, { module: 'people', before: [p] });
  assert.equal(nodes[0].className, 'applies');
  assert.match(nodes[0].textContent, /switches below are for this chat/);
  assert.equal(nodes[1].className, 'mods');
  assert.equal(nodes[2], p);
  assert.equal(nodes.at(-1).textContent, 'Reset People to defaults');
  nodes.at(-1).click();
  assert.deepEqual(calls.at(-1), ['a', 'reset.people', 'Reset']);
  const bare = sectionFrame(sec('packs'), ctx);
  assert.equal(bare.length, 1);
  assert.doesNotMatch(bare[0].textContent, /switches below/);
});
