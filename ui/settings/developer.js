// The Tools page's developer card: a switch for module authors, and under it the Template renderer (the generic activity view on a sample).
import { h } from '../kit/dom.js';
import { toggle } from '../kit/controls.js';
import { genericScene } from '../tabs/scene/generic.js';
import { sceneFixture } from '../fixtures/interaction.js';

export const DEVELOPER_KEY = 'dev.tools';
export const TEMPLATE_NOTE = 'Template renderer: for module authors. Ship your own view for your activity.';

/** Builds the developer cards: the switch, and with it on the Template page. `state` = { on }, `ctx` = { onChange(key, value), repaint() }. Nothing is sent from the sample. */
export function renderDeveloper(state, ctx = {}) {
  const labelId = 'sf-dev-tools';
  const flip = value => { ctx.onChange?.(DEVELOPER_KEY, value); ctx.repaint?.(); };
  const row = h('div', { class: 'srow swrow', dataset: { key: DEVELOPER_KEY, type: 'sw' } },
    h('span', { class: 'lb' }, h('b', { id: labelId }, 'Developer tools'), h('small', 'Shows the Template page below. On this device only; players never need it.')),
    h('span', { class: 'ctl' }, toggle({ checked: Boolean(state.on), labelledBy: labelId, onChange: flip })));
  const cards = [h('div', { class: 'sgrp', dataset: { card: 'developer' } }, h('div', { class: 'gt' }, 'Developer'), row)];
  if (state.on) {
    cards.push(h('div', { class: 'sgrp template', dataset: { card: 'template' } },
      h('div', { class: 'gt' }, 'Template'),
      h('p', { class: 'fine template-note' }, TEMPLATE_NOTE),
      h('div', { class: 'template-body scene-tab' }, genericScene(sceneFixture('open'), {}))));
  }
  return cards;
}
