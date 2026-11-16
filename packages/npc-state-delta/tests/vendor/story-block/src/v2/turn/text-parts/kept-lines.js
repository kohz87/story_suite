// Kept lines: limits how much of a module hook's tail text may be kept whole.

// The most a module's hook may keep whole in the tail (`{ text, keep: true }` lines): two meeting cues and a rumor fit; more is droppable.
export const KEPT_LINES_MAX = 4;
export const KEPT_CHARS_MAX = 4000;

// A hook's lines as the tail gets them. A hook may give a line as `{ text, keep: true }`: kept whole whatever the budget says (prompt.js
// `pinned`), like the no-rolls line. A module keeps at most KEPT_LINES_MAX lines and KEPT_CHARS_MAX characters this way (code points); a
// kept line over that is passed as an ordinary line, which the budget may drop, so one module can never spend the whole tail.
export function keptGiven(lines, noRollsLine) {
    let keptLines = 0, keptChars = 0;
    return lines.map(line => {
        if (typeof line === 'string') return line === noRollsLine ? { text: line, keep: true } : line;
        if (!(line && typeof line === 'object' && typeof line.text === 'string' && line.text.trim())) return null;
        if (line.keep !== true) return line.text;
        const size = [...line.text].length;
        if (keptLines >= KEPT_LINES_MAX || keptChars + size > KEPT_CHARS_MAX) return line.text;
        keptLines += 1; keptChars += size;
        return { text: line.text, keep: true };
    }).filter(line => line !== null);
}
