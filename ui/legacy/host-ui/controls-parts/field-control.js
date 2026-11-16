// One settings control for one field (switch, choice, profile, number, text, or a list of items) and its onChange wiring.

import { normalizeField, FIELD_TYPES } from '../../../../../../core/registry.js';
import { SETTING_LIST_ROWS } from '../../../../../../core/sdk.js';
import { fill } from '../../../../../../core/strings.js';
import { cutAt } from '../../../../../../core/text.js';
import { profileSelect } from '../../../../../../core/model-call/profile-field.js';
import { SETTINGS_TEXT } from '../text.js';
import { el, button } from './dom.js';
import { readInt, optionsOf, emptyValue, subLabel } from './values.js';
import { listTextFields, listToLines, linesToList, lineForm } from './list-lines.js';

// One control for one field; `onChange(value)` gets the new value.
export function control(doc, field, value, onChange, id, memo = null) {
    const f = normalizeField(field);
    if (f.type === 'bool') {
        const input = el(doc, 'input');
        input.type = 'checkbox';
        input.checked = Boolean(value);
        input.addEventListener('change', () => onChange(Boolean(input.checked)));
        return input;
    }
    if (f.type === 'choice') {
        const select = el(doc, 'select', 'text_pole');
        for (const option of optionsOf(f)) {
            const node = el(doc, 'option', '', option.label);
            node.value = option.value;
            select.appendChild(node);
        }
        select.value = String(value ?? '');
        select.addEventListener('change', () => onChange(select.value));
        return select;
    }
    // A Connection Manager profile's name, or '' for the chat's connection (profile-field.js).
    if (f.type === 'profile') return profileSelect(doc, value, onChange);
    if (f.type === 'int') {
        const input = el(doc, 'input', 'text_pole');
        input.type = 'number';
        if (Number.isInteger(f.min)) input.min = String(f.min);
        if (Number.isInteger(f.max)) input.max = String(f.max);
        input.step = '1';
        input.inputMode = 'numeric';
        input.value = String(value ?? '');
        input.addEventListener('change', () => {
            const next = readInt(input.value, f);
            // Not a number: the stored value stays, and is shown again.
            if (next === null) { input.value = String(value ?? ''); return; }
            input.value = String(next);
            value = next;
            onChange(next);
        });
        return input;
    }
    if (f.type === 'list') return listControl(doc, f, Array.isArray(value) ? value : [], onChange, id, memo);
    const input = el(doc, f.multiline ? 'textarea' : 'input', 'text_pole');
    if (!f.multiline) input.type = 'text';
    // A text field's `max` holds for typing and pasting alike (settings.set cuts it there too).
    const max = Number.isInteger(f.max) && f.max >= 0 ? f.max : null;
    if (max !== null) input.maxLength = max;
    input.value = String(value ?? '');
    input.addEventListener('change', () => {
        if (max !== null && input.value.length > max) input.value = cutAt(input.value, max);
        onChange(input.value);
    });
    return input;
}

// What an item of a list is called on its Remove button: its first text field ("January"), else its place.
function itemName(item, subs, index) {
    for (const [key, sub] of subs) {
        const value = item?.[key];
        if (sub.type === 'text' && typeof value === 'string' && value.trim()) return cutAt(value.trim().replace(/\s+/g, ' '), 40);
    }
    return fill(SETTINGS_TEXT.listItem, { n: index + 1 });
}

// A list of {…}, compact: one line per item with its fields side by side (`[January ] [31] ×`), each
// input named by its field for screen readers (the column heads above say it for the eye), a small
// × to remove the item, and Add at the end. A sub-field of a type this Story Block does not know is
// not drawn; its value stays in the item.
// A list of text and whole-number fields also has a text form: a textarea, one item per line
// ("Frostmoon: 30"), read when it changes (on blur); a line that does not read is named under it and
// the stored list stays as it was. `form: 'lines'` starts in it; "Edit as text" / "Edit as rows" switch,
// and the choice is kept in `memo` (the settings' open state) across redraws.
function listControl(doc, field, items, onChange, id, memo = null) {
    const root = el(doc, 'div', 'story-suite-list');
    root.setAttribute('role', 'group');
    let list = structuredClone(items);
    const subs = Object.entries(field.of ?? {})
        .map(([key, sub]) => [key, normalizeField(sub)])
        .filter(([, sub]) => FIELD_TYPES.includes(sub?.type) && sub.type !== 'list');
    const labelOf = subLabel;
    const textFields = listTextFields(field);
    const formKey = `list-form:${id}`;
    let asText = textFields !== null && (memo?.has(formKey) ? memo.get(formKey) === true : field.form === 'lines');
    const fieldName = field.label ?? SETTINGS_TEXT.add;
    function toggleButton() {
        const toggle = button(doc, 'menu_button story-suite-list-toggle', '', fill(asText ? SETTINGS_TEXT.asRowsTitle : SETTINGS_TEXT.asTextTitle, { field: fieldName }));
        toggle.appendChild(el(doc, 'span', '', asText ? SETTINGS_TEXT.asRows : SETTINGS_TEXT.asText));
        toggle.setAttribute('aria-pressed', String(asText));
        return toggle;
    }
    function switchForm(next) {
        asText = next;
        memo?.set(formKey, asText);
        draw();
        root.querySelector('.story-suite-list-toggle')?.focus?.();
    }
    function drawText() {
        const area = el(doc, 'textarea', 'text_pole story-suite-list-text');
        area.id = `${id}-text`;
        area.rows = Math.max(4, Math.min(list.length + 1, 16));
        area.spellcheck = false;
        area.value = listToLines(field, list);
        area.setAttribute('aria-labelledby', `${id}-label`);
        const help = el(doc, 'small', 'story-suite-muted story-suite-list-help', fill(SETTINGS_TEXT.linesHelp, { form: lineForm(textFields), max: SETTING_LIST_ROWS }));
        help.id = `${id}-help`;
        const error = el(doc, 'p', 'story-suite-list-error');
        error.id = `${id}-error`;
        error.setAttribute('role', 'alert');
        error.hidden = true;
        area.setAttribute('aria-describedby', help.id);
        // Reads the text; true when it read (stored, written back tidy), false with the bad line named.
        const read = () => {
            const result = linesToList(field, area.value);
            if (!result.ok) {
                error.textContent = fill(SETTINGS_TEXT.lineError, { n: result.line, line: cutAt(result.text, 40), why: result.error });
                error.hidden = false;
                area.setAttribute('aria-invalid', 'true');
                area.setAttribute('aria-describedby', `${help.id} ${error.id}`);
                return false;
            }
            error.textContent = '';
            error.hidden = true;
            area.removeAttribute('aria-invalid');
            area.setAttribute('aria-describedby', help.id);
            list = result.items;
            area.value = listToLines(field, list);
            onChange(structuredClone(list));
            return true;
        };
        area.addEventListener('change', read);
        const foot = el(doc, 'div', 'story-suite-list-foot');
        const toggle = toggleButton();
        // Back to rows only when the text reads (else the error says which line, and the text stays).
        toggle.addEventListener('click', () => { if (read()) switchForm(false); else area.focus?.(); });
        foot.appendChild(toggle);
        root.append(area, help, error, foot);
    }
    const draw = (focusAt = null) => {
        root.replaceChildren();
        root.dataset.form = asText ? 'lines' : 'rows';
        if (asText) { drawText(); return; }
        if (list.length && subs.length) {
            const head = el(doc, 'div', 'story-suite-list-head');
            head.setAttribute('aria-hidden', 'true');
            for (const [key, sub] of subs) {
                const cell = el(doc, 'span', 'story-suite-list-cell', labelOf(key, sub));
                cell.dataset.type = sub.type;
                head.appendChild(cell);
            }
            head.appendChild(el(doc, 'span', 'story-suite-list-spacer'));
            root.appendChild(head);
        }
        const removes = [];
        list.forEach((item, index) => {
            const row = el(doc, 'div', 'story-suite-list-item');
            row.dataset.index = String(index);
            for (const [key, sub] of subs) {
                const cell = el(doc, 'span', 'story-suite-list-cell');
                cell.dataset.field = key;
                cell.dataset.type = sub.type;
                const value = item && Object.hasOwn(item, key) ? item[key] : emptyValue(sub);
                const inputId = `${id}-${index}-${key}`.replace(/[^\w-]/g, '_');
                const input = control(doc, sub, value, next => {
                    list[index] = { ...list[index], [key]: next };
                    onChange(structuredClone(list));
                }, inputId);
                input.id = inputId;
                input.setAttribute('aria-label', `${labelOf(key, sub)}, ${fill(SETTINGS_TEXT.listItem, { n: index + 1 })}`);
                if (sub.type === 'text' || sub.type === 'int') input.placeholder = labelOf(key, sub);
                cell.appendChild(input);
                row.appendChild(cell);
            }
            const name = fill(SETTINGS_TEXT.remove, { name: itemName(item, subs, index) });
            const remove = button(doc, 'menu_button story-suite-list-remove', '', name);
            remove.appendChild(el(doc, 'span', '', '×')).setAttribute('aria-hidden', 'true');
            remove.addEventListener('click', () => {
                list = list.filter((_, at) => at !== index);
                onChange(structuredClone(list));
                // The focus goes to the next item's ×, else to Add, never to the page behind.
                draw(Math.min(index, list.length - 1));
            });
            removes.push(remove);
            row.appendChild(remove);
            root.appendChild(row);
        });
        const add = button(doc, 'menu_button story-suite-list-add', '', field.label ? fill(SETTINGS_TEXT.addTitle, { field: field.label }) : SETTINGS_TEXT.add);
        add.appendChild(el(doc, 'span', '', SETTINGS_TEXT.add));
        add.addEventListener('click', () => {
            list = [...list, Object.fromEntries(subs.map(([key, sub]) => [key, emptyValue(sub)]))];
            onChange(structuredClone(list));
            draw();
            [...root.querySelectorAll('.story-suite-list-item')].at(-1)?.querySelector('input, select, textarea')?.focus?.();
        });
        if (textFields) {
            const foot = el(doc, 'div', 'story-suite-list-foot');
            const toggle = toggleButton();
            toggle.addEventListener('click', () => switchForm(true));
            foot.append(add, toggle);
            root.appendChild(foot);
        } else root.appendChild(add);
        if (focusAt !== null) (removes[focusAt] ?? add).focus?.();
    };
    draw();
    return root;
}
