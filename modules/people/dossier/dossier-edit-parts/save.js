// Settling a manual Save: untouched fields put back verbatim, shortened-field warnings and hand-entered memories.

import { EDITOR_FIELDS } from './fields.js';

// After the saved record is normalized (typed is the edited record just before): put back, verbatim,
// every untouched field the Save did not otherwise change (a rename still adds the old name to the aliases; a field whose lock the reader
// removed is compacted like any unprotected one). Returns the labels of edited or newly unprotected
// fields the stored limits shortened or adjusted, for one warning.
export function settleEditorSave(saved, current, typed, untouched, { keepVerbatim = () => true } = {}) {
    const savedLocks = new Set(Array.isArray(saved?.manualProfileFields) ? saved.manualProfileFields : []);
    const unprotected = key => (current?.manualProfileFields || []).includes(key) && !savedLocks.has(key);
    const shortened = [];
    for (const [key, field] of Object.entries(EDITOR_FIELDS)) {
        if (untouched.has(key) && !unprotected(key) && keepVerbatim(key)
            && JSON.stringify(typed[key] ?? null) === JSON.stringify(current?.[key] ?? null)) {
            if (Object.prototype.hasOwnProperty.call(current || {}, key)) saved[key] = structuredClone(current[key]);
            else delete saved[key];
            continue;
        }
        if (!Object.prototype.hasOwnProperty.call(typed, key) || key === 'gender') continue;
        const plain = value => String(value ?? '').replace(/\s+/g, ' ').trim();
        const wanted = typed[key];
        const kept = saved[key];
        const keptLines = new Set((Array.isArray(kept) ? kept : []).map(plain));
        const lost = field.list
            ? (Array.isArray(wanted) ? wanted : []).some(line => !keptLines.has(plain(line)))
            : plain(wanted) !== plain(kept);
        if (lost) shortened.push(field.label);
    }
    return shortened;
}

// The memories the reader entered by hand after a Save (a later scan never evicts them): the lines of
// an edited Memories field that were not already stored, plus the earlier hand-entered ones still kept.
export function editorManualMemories(current, saved, untouched) {
    const stored = new Set((Array.isArray(current?.memories) ? current.memories : []).map(plainLine));
    const before = (Array.isArray(current?.manualMemories) ? current.manualMemories : []).map(plainLine);
    const kept = Array.isArray(saved?.memories) ? saved.memories : [];
    if (untouched.has('memories')) return kept.filter(item => before.includes(plainLine(item)));
    return kept.filter(item => !stored.has(plainLine(item)) || before.includes(plainLine(item)));
}
function plainLine(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}
