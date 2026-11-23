// A Rules row for a long text (a plug-in's prompt): the Tools page's prompt editor in a row: a box prefilled with the built-in text while the setting is empty, Save, and Reset to default.
import { h } from '../kit/dom.js';

/**
 * The controls of a `prompt` row ({ value, builtin, max, label }): `emit(text)` stores what was typed; text equal to the built-in one (or empty) is stored as '',
 * which means "use the built-in text". Reset to default stores '' and puts the built-in text back in the box.
 */
export function promptControl(row, emit) {
  const builtin = String(row.builtin ?? '');
  const own = typeof row.value === 'string' && row.value.trim() !== '';
  const box = h('textarea', { class: 'txt2 area2 prompt-box', rows: '12', spellcheck: 'false', maxlength: row.max ? String(row.max) : null, 'aria-label': row.label });
  box.value = own ? row.value : builtin;
  const reset = h('button', { type: 'button', class: 'btn2', dataset: { act: 'reset' }, title: 'Put the built-in text back' });
  reset.disabled = !own;
  reset.textContent = 'Reset to default';
  const save = h('button', { type: 'button', class: 'btn2', dataset: { act: 'save' } });
  save.textContent = 'Save';
  save.addEventListener('click', () => {
    const text = box.value.trim() === builtin.trim() ? '' : box.value;
    reset.disabled = text === '';
    emit(text);
  });
  reset.addEventListener('click', () => {
    box.value = builtin;
    reset.disabled = true;
    emit('');
  });
  return [box, h('span', { class: 'prompt-acts' }, save, reset)];
}
