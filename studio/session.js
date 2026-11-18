// The job: one open pack's editing session, with no DOM. It holds the opened pack and its undo history of frozen documents. Every change
// goes commit → edits.apply → a new snapshot → history, then a debounced check of the snapshot (about 300 ms) and a draft save.
//
// createSession(opened, options) → a session. `opened` is what Open gives (`{ name, text, doc, parseError, portraits }`); `options`:
// `{ kind, legacy, delay = 300, timer = { set, clear }, drafts = { save(kind, id, doc), clear(kind, id) } | null, onUpdate(what) }`.
// `onUpdate` is called with 'doc' after every change of the present document and with 'check' or 'draft' when those land.
//
// The session reads like an opened pack: `name, kind, legacy, parseError, text, doc, portraits` are the present document's. `check` is
// the result for `checked` (the snapshot it was run on); `stale` is true while the present is not yet checked, and `flush()` checks it
// now (Export does). `edited` is false when the present is the opened document (undo all the way back gives it again).
//
// commit(patches) and setPortrait(name | null, bytes | null, { patches, drop }?) → `{ ok: true, same? }` or `{ ok: false, refusal }`; an
// edit that changes nothing is no history step and leaves the text as written. setPortrait adds, replaces (bytes) or removes (null) the
// picture `name` (null: none), and its `patches` (the field that names the picture) and `drop` (a picture no one names any more, taken
// out if the pack holds it) go in the same step, all or nothing. undo() and redo() → whether a step was
// taken. restore(draft) puts a saved draft on top of the opened document (one undo step back to the file). draftId is the draft slot's
// id (null: the pack keeps no draft).

import { checkPack } from './check.js';
import { apply, setPortrait as portraitStep } from './model/edits.js';
import { openDoc } from './model/doc.js';
import { createHistory, record, redo as redoStep, undo as undoStep } from './model/history.js';

const sameDoc = (a, b) => a.doc === b.doc || JSON.stringify(a.doc) === JSON.stringify(b.doc);
const samePortraits = (a, b) => a.portraits.length === b.portraits.length && a.portraits.every((file, i) => file.name === b.portraits[i].name && file.bytes === b.portraits[i].bytes);

export function createSession(opened, { kind = 'world', legacy = false, delay = 300, timer = { set: (fn, ms) => setTimeout(fn, ms), clear: id => clearTimeout(id) }, drafts = null, onUpdate = () => {} } = {}) {
    const base = openDoc({ text: opened.text, doc: opened.doc ?? null, portraits: opened.portraits });
    const editable = !legacy && !opened.parseError && base.doc !== null && typeof base.doc === 'object' && !Array.isArray(base.doc);
    const draftId = editable && drafts && typeof base.doc.id === 'string' && base.doc.id ? base.doc.id : null;
    const baseCheck = checkPack(base.text, { kind, legacy });
    let history = createHistory(base);
    let checked = base;
    let check = baseCheck;
    let pending = null;
    let draft = { at: null, message: null };

    function runCheck() {
        pending = null;
        const doc = history.present;
        check = doc === base ? baseCheck : checkPack(doc.text, { kind, legacy });
        checked = doc;
        onUpdate('check');
        if (!draftId) return;
        const job = doc === base ? drafts.clear(kind, draftId) : drafts.save(kind, draftId, doc);
        Promise.resolve(job).then(result => {
            if (history.present !== doc) return;
            draft = result?.ok ? { at: doc === base ? null : result.at, message: null } : { at: null, message: result?.message ?? 'Could not save the draft.' };
            onUpdate('draft');
        });
    }

    function moved(next) {
        if (next === history) return false;
        history = next;
        if (pending !== null) timer.clear(pending);
        pending = timer.set(runCheck, delay);
        onUpdate('doc');
        return true;
    }

    function step(result) {
        if (!result.ok) return result;
        const present = history.present;
        if (sameDoc(result.doc, present) && samePortraits(result.doc, present)) return { ok: true, same: true };
        moved(record(history, result.doc));
        return { ok: true };
    }

    const refuse = () => ({ ok: false, refusal: legacy ? 'A pack below format 4 is read-only here; convert it to format 4 to edit it.' : `${opened.name} is not a pack the Studio can edit (it is not a JSON object).` });

    return {
        get name() { return opened.name; },
        kind,
        legacy,
        editable,
        draftId,
        get parseError() { return opened.parseError ?? null; },
        get text() { return history.present.text; },
        get doc() { return history.present.doc; },
        get portraits() { return history.present.portraits; },
        get present() { return history.present; },
        get edited() { return history.present !== base; },
        get check() { return check; },
        get checked() { return checked; },
        get stale() { return checked !== history.present; },
        get canUndo() { return history.canUndo; },
        get canRedo() { return history.canRedo; },
        get draft() { return draft; },
        commit: patches => (editable ? step(apply(history.present, patches)) : refuse()),
        setPortrait(name, bytes, { patches = [], drop = null } = {}) {
            if (!editable) return refuse();
            if (kind !== 'world') return { ok: false, refusal: 'Portraits belong to a world pack’s cast.' };
            let result = name === null ? { ok: true, doc: history.present } : portraitStep(history.present, name, bytes);
            if (result.ok && patches.length) result = apply(result.doc, patches);
            if (result.ok && drop !== null && drop !== name && result.doc.portraits.some(file => file.name === drop)) result = portraitStep(result.doc, drop, null);
            return step(result);
        },
        undo: () => moved(undoStep(history)),
        redo: () => moved(redoStep(history)),
        restore(saved) {
            if (!editable) return refuse();
            return step({ ok: true, doc: openDoc({ text: saved.text, portraits: saved.portraits }) });
        },
        flush() {
            if (pending !== null) timer.clear(pending);
            if (pending !== null || checked !== history.present) runCheck();
            return check;
        },
        dispose() { if (pending !== null) timer.clear(pending); pending = null; },
    };
}
