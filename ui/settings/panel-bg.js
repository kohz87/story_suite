// Settings › Look › Panel background: On shows the picture behind the panels, Off (the default) a plain flat surface. Kept per device, applied at once.
import { h } from '../kit/dom.js';
import { toggle } from '../kit/controls.js';

/** The device preference's key (a fold-style flag: true is On). */
export const PANELBG_KEY = 'look.panelBg';
const PANELBG_LABEL = 'Panel background';
const PANELBG_HELP = 'On shows the sky picture behind the panels. Off, the default, leaves a plain flat colour so the panels are easier to read. On this device only.';

/** Sets the suite root's `data-panelbg` ("on" or "off"); the shell's CSS hides the backdrop layer when it is off. */
export function applyPanelBg(root, on) {
  root?.setAttribute?.('data-panelbg', on ? 'on' : 'off');
  return Boolean(on);
}

/** The Look page's Panel background card. `state` = { on }, `ctx` = { onChange(key, value) }. */
export function renderPanelBg(state, ctx = {}) {
  const id = 'sf-panel-bg';
  const flip = value => { state.on = Boolean(value); ctx.onChange?.(PANELBG_KEY, state.on); };
  return h('div', { class: 'sgrp', dataset: { card: 'panel-bg' } }, h('div', { class: 'gt' }, 'Backdrop'),
    h('div', { class: 'srow swrow', dataset: { key: PANELBG_KEY, type: 'sw' } },
      h('span', { class: 'lb' }, h('b', { id }, PANELBG_LABEL), h('small', PANELBG_HELP)),
      h('span', { class: 'ctl' }, toggle({ checked: Boolean(state.on), labelledBy: id, onChange: flip }))));
}
