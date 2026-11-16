/* Named appearance forms: normalising, formatting, parsing and looking one up by name. A part of appearance-model.js (same owner, moved without change). */
import { APPEARANCE_FORM_LIMIT, appearanceText, clean, formKey, formState } from '../appearance-text.js';

export function normalizeAppearanceForms(value, { updates = false } = {}) {
    const source = Array.isArray(value)
        ? value
        : (value && typeof value === 'object'
            ? Object.entries(value).map(([name, form]) => form && typeof form === 'object' ? { name, ...form } : { name, appearance: form })
            : []);
    const forms = [];
    for (const raw of source) {
        if (!raw || typeof raw !== 'object') continue;
        const name = clean(raw.name ?? raw.form ?? raw.formName ?? raw.form_name, 120);
        const appearance = appearanceText(raw.appearance ?? raw.description ?? raw.visual ?? raw.value);
        if (!name || !appearance) continue;
        const entry = { name, appearance };
        if (updates) {
            entry.state = formState(raw.state ?? raw.appearanceState ?? raw.appearance_state);
            entry.reason = clean(raw.reason ?? raw.appearanceReason ?? raw.appearance_reason, 500);
        }
        const index = forms.findIndex(item => formKey(item.name) === formKey(name));
        if (index >= 0) forms[index] = entry;
        else forms.push(entry);
        if (forms.length >= APPEARANCE_FORM_LIMIT) break;
    }
    return forms;
}

export function formatAppearanceForms(value) {
    return normalizeAppearanceForms(value).map(form => `${form.name} | ${form.appearance}`).join('\n');
}
export function parseAppearanceFormsText(value) {
    const lines = String(value ?? '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (lines.length > APPEARANCE_FORM_LIMIT) throw new Error(`Appearance forms are limited to ${APPEARANCE_FORM_LIMIT}.`);
    const forms = [];
    const keys = new Set();
    for (const line of lines) {
        const split = line.indexOf('|');
        if (split <= 0) throw new Error('Each appearance form must use: Form name | Description');
        const name = clean(line.slice(0, split), 120);
        const appearance = appearanceText(line.slice(split + 1));
        const key = formKey(name);
        if (!name || !appearance) throw new Error('Each appearance form needs both a name and description.');
        if (!key || keys.has(key)) throw new Error(`Duplicate appearance form: ${name}`);
        keys.add(key);
        forms.push({ name, appearance });
    }
    return forms;
}
export function appearanceFormByName(npc = {}, name = '') {
    const key = formKey(name);
    if (!key) return null;
    return normalizeAppearanceForms(npc.appearanceForms ?? npc.appearance_forms).find(form => formKey(form.name) === key) || null;
}
