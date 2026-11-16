// The field carry (flag `suite.redrawScheduler`): when a redraw replaces the pane of the same tab while a field in it has the focus
// (a forced draw: a tab select, a programmatic refresh), the field's text, caret and focus go to the same field of the new pane, and an input
// event tells the tab its field changed. A chat switch carries nothing (the host asks for no carry).

const FIELDS = ['INPUT', 'TEXTAREA', 'SELECT'];
const tagOf = el => String(el?.tagName ?? '').toUpperCase();
const fieldsOf = pane => [...(pane?.querySelectorAll?.('input, textarea, select') ?? [])];

/** → what to carry from the focused field of `pane` (null when no field there has the focus). */
export function captureField(doc, pane) {
    const at = doc?.activeElement;
    if (!at || !pane?.contains?.(at) || !FIELDS.includes(tagOf(at))) return null;
    const index = fieldsOf(pane).indexOf(at);
    if (index < 0) return null;
    return { index, tag: tagOf(at), type: at.type ?? '', name: at.dataset?.name ?? at.name ?? '', value: at.value ?? '', start: at.selectionStart ?? null, end: at.selectionEnd ?? null };
}

/** Puts the captured value, caret and focus on the same field of `next` (the same place among its fields, the same kind). */
export function restoreField(next, snap) {
    if (!snap) return false;
    const field = fieldsOf(next)[snap.index];
    if (!field || tagOf(field) !== snap.tag || (field.type ?? '') !== snap.type) return false;
    if (['checkbox', 'radio', 'file'].includes(snap.type) || snap.tag === 'SELECT') return false;
    if ((field.dataset?.name ?? field.name ?? '') !== snap.name) return false;   // (a render that changed shape: another field at this place)
    try {
        field.value = snap.value;
        // (the tab keeps a draft from its `input` events, e.g. the Dossiers search: it must learn the carried text too)
        const W = field.ownerDocument?.defaultView;
        field.dispatchEvent?.(new (W?.InputEvent ?? W?.Event ?? Event)('input', { bubbles: true }));
        field.focus?.(); if (snap.start !== null) field.setSelectionRange?.(snap.start, snap.end ?? snap.start); } catch { /* a field without a caret */ }
    return true;
}
