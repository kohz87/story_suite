// Builds the spoiler switch row and the hidden-until-shown text used for scene secrets.
import { h } from './dom.js';
import { toggle } from './controls.js';

/** Builds a titled switch row; `onChange(next)` runs when the reader flips it. */
export function spoilerSwitch({ id = 'spoiler', title, hint, checked = false, onChange } = {}) {
  const labelId = `${id}-label`;
  return h(
    'div',
    { class: 'spo' },
    h('span', { class: 't', id: labelId }, title, hint ? h('small', null, hint) : null),
    toggle({ checked, labelledBy: labelId, onChange }),
  );
}

/** Returns the text when shown, or a muted placeholder (never the text itself) when hidden. */
export function hiddenValue(text, shown, hiddenLabel = 'Hidden') {
  if (shown) return h('span', { class: 'shown' }, text ?? '');
  return h('span', { class: 'hid', 'aria-label': hiddenLabel }, hiddenLabel);
}
