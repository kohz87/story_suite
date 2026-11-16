// A list field's text form: which lists have one, a list written as lines, and lines read back into a list.

import { normalizeField } from '../../../../core/registry.js';
import { SETTING_LIST_ROWS } from '../../../../core/sdk.js';
import { fill } from '../../../../core/strings.js';
import { cutAt } from '../../../../core/text.js';
import { SETTINGS_TEXT } from '../text.js';
import { emptyValue, subLabel } from './values.js';

/**
 * A list field's sub-fields when it has a text form ([[key, field]], in order), else null: every field
 * of its `of` is text or a whole number (a list holding a switch or a choice has rows only).
 */
export function listTextFields(field) {
    const f = normalizeField(field);
    if (f?.type !== 'list' || !f.of || typeof f.of !== 'object') return null;
    const subs = Object.entries(f.of).map(([key, sub]) => [key, normalizeField(sub)]);
    return subs.length && subs.every(([, sub]) => sub?.type === 'text' || sub?.type === 'int') ? subs : null;
}

// "Name: Days": how one line of a list's text form is written.
export const lineForm = subs => subs.map(([key, sub]) => subLabel(key, sub)).join(': ');

/** A list's items as its text form: one per line, the fields in order joined by ": " ("Frostmoon: 30"). */
export function listToLines(field, items) {
    const subs = listTextFields(field) ?? [];
    return (Array.isArray(items) ? items : []).map(item => subs.map(([key, sub]) => {
        const value = item && Object.hasOwn(item, key) ? item[key] : emptyValue(sub);
        return String(value ?? '').replace(/\s*[\r\n]+\s*/g, ' ').trim();
    }).join(': ')).join('\n');
}

/**
 * The text form read back: → { ok: true, items } or { ok: false, line (1-based), text, error } for the
 * first line that does not read. Blank lines are skipped. A line holds the fields in order split by ":";
 * when there are more parts than fields and the list has one text field, the extra colons are that
 * field's ("Day: of Ash: 30" → name "Day: of Ash"). A whole number must be one and inside its min/max
 * (refused, not moved: "Days must be at least 1"). At most SETTING_LIST_ROWS items; any number below.
 */
export function linesToList(field, text) {
    const subs = listTextFields(field);
    if (!subs) return { ok: false, line: 0, text: '', error: 'this list has no text form' };
    const form = lineForm(subs);
    const texts = subs.map(([, sub], at) => (sub.type === 'text' ? at : -1)).filter(at => at >= 0);
    const items = [];
    const lines = String(text ?? '').split(/\r\n|\r|\n/);
    for (let at = 0; at < lines.length; at += 1) {
        const line = lines[at].trim();
        if (!line) continue;
        const fail = error => ({ ok: false, line: at + 1, text: line, error });
        if (items.length >= SETTING_LIST_ROWS) return fail(fill(SETTINGS_TEXT.lineCount, { max: SETTING_LIST_ROWS }));
        let parts = line.split(':');
        if (parts.length < subs.length) return fail(fill(SETTINGS_TEXT.lineParts, { form }));
        if (parts.length > subs.length) {
            if (texts.length !== 1) return fail(fill(SETTINGS_TEXT.lineExtra, { n: subs.length }));
            const t = texts[0];
            const after = subs.length - t - 1;
            parts = [...parts.slice(0, t), parts.slice(t, parts.length - after).join(':'), ...parts.slice(parts.length - after)];
        }
        const item = {};
        for (let i = 0; i < subs.length; i += 1) {
            const [key, sub] = subs[i];
            const part = parts[i].trim();
            if (sub.type === 'int') {
                const name = subLabel(key, sub);
                if (!/^[+-]?\d+$/.test(part)) return fail(fill(SETTINGS_TEXT.lineWhole, { field: name }));
                const n = Number(part);
                if (Number.isInteger(sub.min) && n < sub.min) return fail(fill(SETTINGS_TEXT.lineMin, { field: name, min: sub.min }));
                if (Number.isInteger(sub.max) && n > sub.max) return fail(fill(SETTINGS_TEXT.lineMax, { field: name, max: sub.max }));
                item[key] = n;
            } else {
                const max = Number.isInteger(sub.max) && sub.max >= 0 ? sub.max : null;
                item[key] = max !== null && part.length > max ? cutAt(part, max) : part;
            }
        }
        items.push(item);
    }
    return { ok: true, items };
}
