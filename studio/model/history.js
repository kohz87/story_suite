// The job: undo and redo over frozen document snapshots.
//
// A history is a frozen `{ present, canUndo, canRedo, past, future }`. Nothing mutates: each call returns a new history, and
// undo then redo gives back the very same snapshot objects, so what the author sees after undo is exactly what they had.
//
// createHistory(doc, limit?) → a history holding one snapshot. record(history, doc) → the history with `doc` as the present and the
// redo steps dropped (the same snapshot again is no step). undo(history) and redo(history) → the history one step back or forward,
// or the same history when there is nothing to do. At most `limit` (200) undo steps are kept; the oldest go first.

const LIMIT = 200;

const make = (past, present, future, limit) => Object.freeze({
    present, past: Object.freeze(past), future: Object.freeze(future), canUndo: past.length > 0, canRedo: future.length > 0, limit,
});

export const createHistory = (doc, limit = LIMIT) => make([], doc, [], limit);

export function record(history, doc) {
    if (doc === history.present) return history;
    return make([...history.past, history.present].slice(-history.limit), doc, [], history.limit);
}

export function undo(history) {
    if (!history.canUndo) return history;
    const past = history.past.slice(0, -1);
    return make(past, history.past[history.past.length - 1], [history.present, ...history.future], history.limit);
}

export function redo(history) {
    if (!history.canRedo) return history;
    return make([...history.past, history.present], history.future[0], history.future.slice(1), history.limit);
}
