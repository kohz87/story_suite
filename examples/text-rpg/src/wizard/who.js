// Adapted from ui/wizard/who.js (keep in step when that file changes). The wizard's Who step for Text RPG: the name (no saved-character import and no starting level here).
import { h } from '../kit/dom.js';
import { RULES } from './rules.js';
import { W } from './words.js';

/** Draws the Who step for the wizard session `ctx` ({ run, put, summary }). */
export function drawWho(ctx) {
  const { run } = ctx;
  const name = h('input', { type: 'text', maxlength: String(RULES.nameMax), value: run.draft.name ?? '', dataset: { wiz: 'name' },
    onInput: () => { ctx.put({ ...run.draft, name: name.value }); ctx.summary(); } });
  return h('div', { class: 'wz-form' },
    h('label', { class: 'ef' }, W.name, name),
    h('p', { class: 'ps-p wz-help' }, W.nameHint),
    h('p', { class: 'ps-p', dataset: { wiz: 'start-note' } }, W.whoNote));
}
