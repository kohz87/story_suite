// The field carry (flag `suite.redrawScheduler`): when a redraw replaces the pane of the same tab while a field in it has the focus
// (a tab select or a chat switch draws at once), the field's text and caret go to the same field of the new pane.

const FIELDS = ['INPUT', 'TEXTAREA', 'SELECT'];
const tagOf = el => String(el?.tagName ?? '').toUpperCase();
const fieldsOf = pane => [...(pane?.querySelectorAll?.('input, textarea, select') ?? [])];

/** → what to carry from the focused field of `pane` (null when no field there has the focus). */
export function captureField(doc, pane) {
    const at = doc?.activeElement;
    if (!at || !pane?.contains?.(at) || !FIELDS.includes(tagOf(at))) return null;
    const index = fieldsOf(pane).indexOf(at);
    if (index < 0) return null;
    return { index, tag: tagOf(at), type: at.type ?? '', value: at.value ?? '', start: at.selectionStart ?? null, end: at.selectionEnd ?? null };
}

/** Puts the captured value, caret and focus on the same field of `next` (the same place among its fields, the same kind). */
export function restoreField(next, snap) {
    if (!snap) return false;
    const field = fieldsOf(next)[snap.index];
    if (!field || tagOf(field) !== snap.tag || (field.type ?? '') !== snap.type) return false;
    if (snap.type === 'checkbox' || snap.type === 'radio' || snap.tag === 'SELECT') return false;
    field.value = snap.value;
    try { field.focus?.(); if (snap.start !== null) field.setSelectionRange?.(snap.start, snap.end ?? snap.start); } catch { /* a field without a caret */ }
    return true;
}
