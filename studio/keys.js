// The Studio's keyboard: Ctrl/Cmd+O open, Ctrl/Cmd+S export the zip, Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z (or Ctrl+Y) redo, / search,
// Alt+1…9 a part, F8 the next problem, Esc back. In a text box Ctrl/Cmd+Z and redo are the box's own (its typing), not the pack's.

const typing = target => target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

/**
 * Listens on `doc` and calls the matching action: `{ open, exportZip, undo, redo, search, part(n), nextProblem, back }`. Returns a function that
 * stops listening.
 */
export function bindKeys(doc, actions) {
    const onKey = event => {
        const mod = event.ctrlKey || event.metaKey;
        const key = event.key;
        let action = null;
        if (mod && !event.altKey && key.toLowerCase() === 'o') action = () => actions.open();
        else if (mod && !event.altKey && key.toLowerCase() === 's') action = () => actions.exportZip();
        else if (mod && !event.altKey && !typing(event.target) && (key.toLowerCase() === 'y' || (key.toLowerCase() === 'z' && event.shiftKey))) action = () => actions.redo?.();
        else if (mod && !event.altKey && !typing(event.target) && key.toLowerCase() === 'z') action = () => actions.undo?.();
        else if (event.altKey && !mod && /^Digit[1-9]$/.test(event.code)) action = () => actions.part(Number(event.code.slice(5)));
        else if (key === 'F8') action = () => actions.nextProblem();
        else if (key === '/' && !mod && !typing(event.target)) action = () => actions.search();
        else if (key === 'Escape') action = () => actions.back();
        if (!action) return;
        event.preventDefault();
        action();
    };
    doc.addEventListener('keydown', onKey);
    return () => doc.removeEventListener('keydown', onKey);
}
