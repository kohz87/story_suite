// The Tools page's Story history card: how far back this chat keeps its replies step by step, and the switch that tidies older ones
// (core/turn/seal-idle.js). Drawn from the `history` view; nothing in it changes the story.
import { h } from '../kit/dom.js';

/** Builds the card from the `history` view ({ title, text, on, button }, or null: no card). `state` = { busy, note, toggle(on) }. */
export function renderHistory(view, state) {
  if (!view) return null;
  const row = h('div', { class: 'srow', dataset: { key: 'tools.history.on' } },
    h('span', { class: 'lb' }, h('b', 'Tidy old story history'), h('small', state.note || view.text)),
    h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2', disabled: state.busy, onClick: () => state.toggle(!view.on) }, view.button)));
  return h('div', { class: 'sgrp', dataset: { card: 'history' } }, h('div', { class: 'gt' }, view.title), row);
}
