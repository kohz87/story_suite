// The Tools page's Diagnostics card: the report to copy into a bug report.
import { h } from '../kit/dom.js';

/** Builds the card. `state` = { note, copy() }: `note` is the last answer ("Copied", or why not), `copy` asks the engine for the report and puts it on the clipboard. */
export function renderDiagnostics(state) {
  return h('div', { class: 'sgrp', dataset: { card: 'diagnostics' } }, h('div', { class: 'gt' }, 'Diagnostics'),
    h('div', { class: 'srow', dataset: { key: 'tools.report' } },
      h('span', { class: 'lb' }, h('b', 'Report'), h('small', state.note || 'Versions, packs, problems; copy it into a bug report')),
      h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2', onClick: () => state.copy() }, 'Copy report'))));
}
