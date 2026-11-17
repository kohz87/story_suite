// Story Suite v2: whether a control is disabled, and which elements a control name is prefixed on.

import { dom } from './access.js';

export function isDisabled(el) {
    try {
        const matches = dom(el, 'matches');
        if (typeof matches === 'function') return Boolean(matches.call(el, ':disabled'));
    } catch { /* a DOM without :disabled (the tests'): the property below */ }
    return dom(el, 'disabled') === true;
}

// The elements a control `name` is prefixed on (the form-associated ones a <form> exposes by name).
export const CONTROLS = new Set(['input', 'select', 'textarea', 'button', 'fieldset', 'output', 'object']);
