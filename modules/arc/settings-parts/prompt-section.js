// Renders the planner prompt editor and Reset control for the settings panel.

import { DEFAULT_PLANNER_PROMPT } from '../plan.js';
import { NS, PROMPT_MAX } from './schema.js';

/**
 * The planner prompt's editor (Story Block's settings `section(el, api)`, api = { get, set, values }): a
 * text box holding the reader's prompt (or the default), saved as they type, and Reset, which brings the
 * default back. The default is stored as '' so a newer default reaches readers who never changed it.
 * `needs` (text): shown instead when Story Block cannot make the call.
 */
export function promptSection(el, api, { needs = '' } = {}) {
    const doc = el.ownerDocument ?? globalThis.document;
    const make = (tag, className, text) => {
        const node = doc.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    };
    const wrap = make('div', 'sd-arc-prompt');
    if (needs) wrap.append(make('p', 'sd-arc-needs', needs));
    const label = make('label', 'sd-arc-prompt-label', 'Arc planning: Planner prompt');
    const area = make('textarea', 'text_pole sd-arc-prompt-text');
    area.rows = 12;
    area.spellcheck = false;
    area.setAttribute('aria-label', 'Planner prompt');
    const stored = String(api?.get?.(`${NS}prompt`) ?? '');
    area.value = stored.trim() ? stored : DEFAULT_PLANNER_PROMPT;
    const hint = make('p', 'sd-arc-prompt-hint', 'Macros: {{genre}}, {{now}}, {{place}}, {{note}}, {{previous_arc}}, {{tracker}}, {{recent}}, {{fights}}, {{user}}, {{char}}. Code reads only the plan lines the default asks for.');
    const state = make('span', 'sd-arc-prompt-state');
    const show = () => { state.textContent = area.value.trim() && area.value !== DEFAULT_PLANNER_PROMPT ? 'Your own prompt.' : 'The default prompt.'; };
    area.addEventListener('input', () => {
        const value = area.value.slice(0, PROMPT_MAX);
        api?.set?.(`${NS}prompt`, value === DEFAULT_PLANNER_PROMPT || !value.trim() ? '' : value);
        show();
    });
    const reset = make('button', 'menu_button sd-arc-prompt-reset', 'Reset');
    reset.type = 'button';
    reset.addEventListener('click', () => {
        area.value = DEFAULT_PLANNER_PROMPT;
        api?.set?.(`${NS}prompt`, '');
        show();
    });
    show();
    label.append(area);
    const row = make('div', 'sd-arc-prompt-row');
    row.append(reset, state);
    wrap.append(label, hint, row);
    el.append(wrap);
    return wrap;
}
