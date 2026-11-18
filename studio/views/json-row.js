// The JSON row of one record (the Studio mock's record page, MK-1): "Edit as JSON" and Show, then the record as 2-space JSON in a box that
// is read as you type (a mistake names its line, and Apply stays off until it is fixed), Apply (one undo step, through the editor
// context's commit) and Undo changes. Under the box: the pack checker's problems in this record, or that it has none.
//
// What is typed and whether the row is open live in `state` (the editor context's keep), so a redraw after a check keeps them. A focus on
// the record with a field path (Go to, F8) opens the row with the caret at the field (`focus.path`, or the nearest part of it the record has): the box carries
// `data-at`, the caret offset, and the class `st-at`, which the Studio focuses after drawing.

import { h } from '../../ui/kit/dom.js';

const MARK = '\u0001st-field\u0001';

/** The caret offset in `text` (the value as 2-space JSON) of the field at `path`, at the start of its line; 0 when it is not there. */
export function fieldOffset(value, path, text = JSON.stringify(value, null, 2)) {
    if (!Array.isArray(path) || !path.length || value === null || typeof value !== 'object') return 0;
    const copy = JSON.parse(JSON.stringify(value));
    let node = copy;
    let steps = 0;
    for (const step of path.slice(0, -1)) {
        if (node === null || typeof node !== 'object' || !Object.hasOwn(node, step)) break;
        node = node[step];
        steps += 1;
    }
    const last = path[steps];
    if (steps < path.length - 1 || node === null || typeof node !== 'object' || !Object.hasOwn(node, last)) {
        if (!steps) return 0;
        return fieldOffset(value, path.slice(0, steps), text);
    }
    node[last] = MARK;
    const marked = JSON.stringify(copy, null, 2);
    const at = marked.indexOf(JSON.stringify(MARK));
    const lineStart = marked.lastIndexOf('\n', at) + 1;
    const indent = /^ */.exec(marked.slice(lineStart))[0].length;
    return Math.min(lineStart + indent, text.length);
}

// "Unexpected token } in JSON at position 52 (line 4 column 3)" → "Line 4: unexpected token }".
function jsonMistake(text) {
    try {
        return { value: JSON.parse(text) };
    } catch (error) {
        const message = String(error.message);
        const pos = /position (\d+)/.exec(message);
        const line = pos ? text.slice(0, Number(pos[1])).split('\n').length : (/line (\d+)/.exec(message)?.[1] ?? null);
        const said = message.replace(/\s*in JSON at position \d+.*$/s, '').replace(/^JSON\.parse: /, '').replace(/\s*\(line \d+ column \d+\)$/, '');
        return { mistake: `${line ? `Line ${line}: ` : ''}${said.charAt(0).toLowerCase()}${said.slice(1)}` };
    }
}

const mark = (ok, text) => h('span', { class: ok ? 'needok' : 'pairerr' }, h('span', { 'aria-label': ok ? 'Note' : 'Problem' }, ok ? '✓' : '✕'), ` ${text}`);

/**
 * `{ value, steps, noun, problems, focus, state }`: the record, its patch path, what it is called ("entry"), the checker's problems inside
 * it, the focus (`{ path }`; a null path only marks the record) and the kept row state. `commit(patches)` → `{ ok, refusal? }`. Returns the row's `.sgrp`.
 */
export function jsonRow({ value, steps, noun, problems = [], focus = null, state = {} }, commit) {
    const written = JSON.stringify(value, null, 2);
    if (focus?.path) state.open = true;
    const group = h('div', { class: 'sgrp st-jsonrow' }, h('div', { class: 'gt' }, 'JSON'));
    if (!state.open) {
        group.append(h('div', { class: 'srow' },
            h('span', { class: 'lb' }, h('b', 'Edit as JSON'), h('small', `This ${noun} as JSON, for anything the view has no field for`)),
            h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2 st-jsonshow', 'aria-label': `Show this ${noun} as JSON`, onClick: () => { state.open = true; group.replaceWith(jsonRow({ value, steps, noun, problems, focus, state }, commit)); } }, 'Show'))));
        return group;
    }
    const box = h('textarea', { class: 'sent st-jsonin', rows: Math.min(20, written.split('\n').length + 1), spellcheck: 'false', 'aria-label': `This ${noun} as JSON` });
    box.value = typeof state.text === 'string' ? state.text : written;
    const line = h('small', { class: 'fprob', role: 'status' });
    const apply = h('button', { type: 'button', class: 'btn2 pri st-apply' }, 'Apply');
    const reset = h('button', { type: 'button', class: 'btn2 st-reset' }, 'Undo changes');
    const shownProblems = () => (problems.length
        ? mark(false, `${problems[0].message}${problems.length > 1 ? ` (and ${problems.length - 1} more; see Problems)` : ''}`)
        : mark(true, `Checked: no problems in this ${noun}.`));
    function read() {
        const changed = box.value !== written;
        state.text = changed ? box.value : null;
        const parsed = jsonMistake(box.value);
        box.classList.toggle('bad', Boolean(parsed.mistake));
        if (parsed.mistake) box.setAttribute('aria-invalid', 'true');
        else box.removeAttribute('aria-invalid');
        apply.disabled = Boolean(parsed.mistake) || !changed;
        if (parsed.mistake) line.replaceChildren(mark(false, parsed.mistake), ' Apply is off until it is fixed.');
        else line.replaceChildren(changed ? mark(true, 'The JSON reads. Apply makes it one undo step, and the pack checker then checks it.') : shownProblems());
        return parsed;
    }
    box.addEventListener('input', read);
    apply.addEventListener('click', () => {
        const parsed = read();
        if (parsed.mistake) return;
        const typed = state.text;
        state.text = null; // the Studio redraws the row from the new document while commit runs
        const result = commit([{ op: 'set', path: steps, value: parsed.value }]);
        if (!result?.ok) { state.text = typed; line.replaceChildren(mark(false, result?.refusal ?? 'The change was not made.')); return; }
        if (result.same) { box.value = written; read(); }
    });
    reset.addEventListener('click', () => { box.value = written; read(); });
    if (focus?.path && typeof state.text !== 'string') {
        box.dataset.at = String(fieldOffset(value, focus.path, written));
        box.classList.add('st-at');
    }
    read();
    group.append(h('div', { class: 'srow wide' },
        h('span', { class: 'lb' }, h('b', `This ${noun} as JSON`), h('small', 'Read as you type; Apply makes it one undo step')),
        h('span', { class: 'ctl' }, box, line, apply, reset)));
    return group;
}
