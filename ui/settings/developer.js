// The Tools page's developer card: a switch for module authors; with it on, "Use the old view" (the hidden fallback) and the Template renderer (the generic activity view on a sample).
import { h } from '../kit/dom.js';
import { toggle } from '../kit/controls.js';
import { genericScene } from '../tabs/scene/generic.js';
import { sceneFixture } from '../fixtures/interaction.js';

export const DEVELOPER_KEY = 'dev.tools';
export const TEMPLATE_NOTE = 'Template renderer: for module authors. Ship your own view for your activity.';
/** The fallback switch's key: off in the new view; turning it on shows the old view on this device (until the old view is removed). */
export const OLD_VIEW_KEY = 'dev.oldView';

/** Builds the developer cards: the switch, and with it on "Use the old view" and the Template page. `state` = { on }, `ctx` = { onChange(key, value), repaint() }. Nothing is sent from the sample. */
export function renderDeveloper(state, ctx = {}) {
  const labelId = 'sf-dev-tools';
  const flip = value => { ctx.onChange?.(DEVELOPER_KEY, value); ctx.repaint?.(); };
  const row = h('div', { class: 'srow swrow', dataset: { key: DEVELOPER_KEY, type: 'sw' } },
    h('span', { class: 'lb' }, h('b', { id: labelId }, 'Developer tools'), h('small', 'Shows Use the old view and the Template page below. On this device only; players never need it.')),
    h('span', { class: 'ctl' }, toggle({ checked: Boolean(state.on), labelledBy: labelId, onChange: flip })));
  const oldId = 'sf-old-view';
  const oldRow = () => h('div', { class: 'srow swrow', dataset: { key: OLD_VIEW_KEY, type: 'sw' } },
    h('span', { class: 'lb' }, h('b', { id: oldId }, 'Use the old view'), h('small', 'The view before this one, until it is removed. On this device only; untick it in Extensions to come back.')),
    h('span', { class: 'ctl' }, toggle({ checked: false, labelledBy: oldId, onChange: value => ctx.onChange?.(OLD_VIEW_KEY, value) })));
  const cards = [h('div', { class: 'sgrp', dataset: { card: 'developer' } }, h('div', { class: 'gt' }, 'Developer'), row, ...(state.on ? [oldRow()] : []))];
  if (state.on) {
    cards.push(h('div', { class: 'sgrp template', dataset: { card: 'template' } },
      h('div', { class: 'gt' }, 'Template'),
      h('p', { class: 'fine template-note' }, TEMPLATE_NOTE),
      h('div', { class: 'template-body scene-tab' }, genericScene(sceneFixture('open'), {}))));
  }
  return cards;
}
