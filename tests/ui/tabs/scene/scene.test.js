import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/dom.js';
import { sceneTab } from '../../../../ui/tabs/scene/host.js';
import { choicesOf, linesOf } from '../../../../ui/tabs/scene/generic.js';
import { sceneFixture } from '../../../../ui/fixtures/interaction.js';
import { h } from '../../../../ui/kit/dom.js';
import { createFakePort } from '../../../../ui/port/fake-port.js';

const ctxOf = (port = createFakePort()) => ({ port, renderers: {} });
const sent = ctx => ctx.port.recorded.map(r => [r.type, r.payload]);
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

test('an open scene: header, the lines, three choices, Discard but no Send', () => {
  installFakeDom();
  const tab = sceneTab(sceneFixture('open'), ctxOf());
  assert.equal(tab.dataset.tab, 'scene');
  assert.deepEqual(tab.querySelectorAll('[data-card]').map(c => c.dataset.card), ['scene-head', 'lines', 'choices', 'scene-actions']);
  assert.equal(tab.querySelector('.fhead b').textContent, 'The ferry crossing');
  assert.equal(tab.querySelector('.fpill').textContent, 'open');
  assert.equal(tab.querySelectorAll('.scene-choice-list button').length, 3);
  assert.equal(tab.querySelector('[data-act="send"]'), null);
  assert.ok(tab.querySelector('[data-act="discard"]'));
});

test('pressing a choice stages one input for its actor; Send and Discard are commands on the session id', async () => {
  installFakeDom();
  const ctx = ctxOf();
  const vm = sceneFixture('staged');
  const tab = sceneTab(vm, ctx);
  tab.querySelectorAll('.scene-choice-list button')[1].click();
  await flush();
  tab.querySelector('[data-act="send"]').click();
  await flush();
  tab.querySelector('[data-act="discard"]').click();
  await flush();
  assert.deepEqual(sent(ctx), [
    ['interaction.stage', { id: vm.id, step: { inputs: [{ choice: 'haggle', actor: 'astra' }] } }],
    ['interaction.send', { id: vm.id }],
    ['interaction.discard', { id: vm.id }],
  ]);
  assert.equal(tab.querySelector('.fine.scene-state'), null);
  assert.equal(tab.querySelector('.scene-choices .fine').textContent, '1 step chosen so far.');
});

test('a sent scene shows its note, no choices and no Send; a taken-back one says so', () => {
  installFakeDom();
  const sentTab = sceneTab(sceneFixture('sent'), ctxOf());
  assert.equal(sentTab.querySelector('.scene-state').textContent, 'Sent. It plays out with the next reply.');
  assert.equal(sentTab.querySelector('.scene-choices'), null);
  assert.equal(sentTab.querySelector('[data-act="send"]'), null);
  const back = sceneTab(sceneFixture('invalidated'), ctxOf());
  assert.equal(back.querySelector('.fpill').textContent, 'taken back');
  assert.equal(back.querySelector('.scene-choices'), null);
});

test('a refused command shows the engine message and a second press while one runs does nothing', async () => {
  installFakeDom();
  let release = null;
  const port = { command: () => new Promise(resolve => { release = resolve; }) };
  const tab = sceneTab(sceneFixture('open'), ctxOf(port));
  const buttons = tab.querySelectorAll('.scene-choice-list button');
  buttons[0].click();
  buttons[1].click();
  assert.equal(tab.dataset.busy, '1');
  release({ ok: false, code: 'CHANGED', message: 'The ferry changed.' });
  await flush();
  assert.equal(tab.dataset.busy, undefined);
  const note = tab.querySelector('.scene-note');
  assert.equal(note.hidden, false);
  assert.equal(note.textContent, 'The ferry changed.');
});

test('a kind with its own renderer is drawn by it; one without gets the generic one', () => {
  installFakeDom();
  const vm = sceneFixture('open');
  const own = sceneTab(vm, { port: createFakePort(), renderers: { [vm.kindId]: () => h('div', { dataset: { renderer: 'own' } }) } });
  assert.equal(own.querySelector('[data-renderer="generic"]'), null);
  assert.ok(own.querySelector('[data-renderer="own"]'));
  assert.ok(sceneTab(vm, ctxOf()).querySelector('[data-renderer="generic"]'));
});

test('lines and choices are read defensively and capped; an empty view says so; no view-model gives no tab', () => {
  installFakeDom();
  assert.deepEqual(linesOf({ lines: ['a', ' ', 3, null, ' b '] }), ['a', 'b']);
  assert.deepEqual(choicesOf({ choices: [{ id: 7, label: 'x', actor: 'a' }, { id: 'y' }, 'z', { id: 'v', label: 'no actor' }, { id: 'w', label: 'ok', actor: ' bob ' }] }),
    [{ id: '7', label: 'x', actor: 'a' }, { id: 'w', label: 'ok', actor: 'bob' }]);
  assert.equal(choicesOf({ choices: Array.from({ length: 30 }, (_, i) => ({ id: i, label: 'c', actor: 'a' })) }).length, 12);
  const empty = sceneTab({ ...sceneFixture('open'), view: null }, ctxOf());
  assert.ok(empty.querySelector('.scene-empty'));
  assert.equal(sceneTab(null, ctxOf()), null);
});
