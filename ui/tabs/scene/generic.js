// The generic renderer for an interaction kind with no drawing of its own: the kind's `view.lines` as text and `view.choices` as buttons.
import { h } from '../../kit/dom.js';
import { button } from '../../kit/controls.js';

const MAX_LINES = 40;
const MAX_CHOICES = 12;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => (typeof value === 'string' ? value.trim() : '');

const NOTE = {
  sent: 'Sent. It plays out with the next reply.',
  invalidated: 'The earlier part was taken back. Restore that reply or discard this.',
};

/** The text lines of a generic view. */
export function linesOf(view) {
  return (Array.isArray(view?.lines) ? view.lines : []).map(text).filter(Boolean).slice(0, MAX_LINES);
}

/** The choices of a generic view: { id, label, actor }, ids as text; one without an id, a label and an actor is left out (the engine refuses a step with no actor). */
export function choicesOf(view) {
  const out = [];
  for (const item of Array.isArray(view?.choices) ? view.choices : []) {
    if (!isRecord(item) || !['string', 'number'].includes(typeof item.id) || !text(item.label) || !text(item.actor)) continue;
    out.push({ id: String(item.id), label: text(item.label), actor: text(item.actor) });
  }
  return out.slice(0, MAX_CHOICES);
}

/** Builds the generic body. `api.stage(step)` stages one step; a press on a choice stages one input for its actor. */
export function genericScene(vm, api = {}) {
  const lines = linesOf(vm.view), choices = choicesOf(vm.view);
  const live = vm.state === 'open' || vm.state === 'staged';
  const stage = choice => api.stage?.({ inputs: [{ choice: choice.id, actor: choice.actor }] });
  return h('div', { class: 'scene-generic', dataset: { renderer: 'generic' } },
    lines.length ? h('section', { class: 'card glass scene-lines', dataset: { card: 'lines' } }, lines.map(line => h('p', { class: 'anote' }, line))) : null,
    NOTE[vm.state] ? h('p', { class: 'fine scene-state' }, NOTE[vm.state]) : null,
    choices.length && live
      ? h('section', { class: 'card glass scene-choices', dataset: { card: 'choices' } },
        vm.steps ? h('p', { class: 'fine' }, `${vm.steps} ${vm.steps === 1 ? 'step' : 'steps'} chosen so far.`) : null,
        h('div', { class: 'scene-choice-list' }, choices.map(choice => button({ label: choice.label, dataset: { choice: choice.id }, onClick: () => stage(choice) }))))
      : null,
    !lines.length && !choices.length ? h('p', { class: 'fine scene-empty' }, 'Nothing to show for this yet.') : null);
}
