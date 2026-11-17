// The Tools page's Problems card: what the engine flagged, and a blocked branch's rebuild entry with its two ways to start again.
import { h } from '../kit/dom.js';

/**
 * Builds the card from the `problems` view (`{ items, rebuild }`). `state` = { rebuilding: { module, read } | null, error, confirming, setConfirm(bool), start(read) }.
 * With nothing to show it draws nothing, unless `state.force` (the Show button) asks for the empty card.
 */
export function renderProblems(view, state) {
  const items = view?.items ?? [];
  const rb = view?.rebuild ?? null;
  if (!items.length && !rb && !state.force) return null;
  const rows = items.map(p => h('div', { class: 'srow', dataset: { problem: p.code } },
    h('span', { class: 'lb' }, h('b', p.message || p.code), h('small', [p.module, p.code, p.reply ? `reply ${p.reply}` : null].filter(Boolean).join(' · ')))));
  if (rb) {
    const working = state.rebuilding;
    const confirm = state.confirming && !working ? h('div', { class: 'cfm' }, h('b', 'Start this branch’s dossiers from the chat?'),
      h('small', 'Story Suite reads the chat again and builds new dossiers from it. Notes made by hand on this branch are not kept. It uses about one model call per reply read.'),
      h('span', { class: 'ctl' }, rb.choices.map(c => h('button', { type: 'button', class: 'btn2 dng', onClick: () => state.start(c.read) }, c.label)),
        h('button', { type: 'button', class: 'btn2', onClick: () => state.setConfirm(false) }, 'Cancel'))) : null;
    rows.unshift(h('div', { class: 'srow', dataset: { problem: 'rebuild' } },
      h('span', { class: 'lb' }, h('b', rb.title), h('small', working ? 'Reading the chat. Replies resume when it finishes.' : (state.error || rb.body))),
      h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2', disabled: Boolean(working), onClick: () => state.setConfirm(true) }, working ? 'Starting…' : 'Start from the chat'))), confirm);
  }
  return h('div', { class: 'sgrp', dataset: { card: 'problems' } }, h('div', { class: 'gt' }, 'Problems'), rows.length ? rows : h('p', { class: 'fine' }, 'Nothing to report.'));
}
