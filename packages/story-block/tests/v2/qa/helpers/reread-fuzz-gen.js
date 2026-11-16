// QA fuzz helper: the edited text of the "edit then Re-read" step (reread-fuzz-run.js). An earlier reply's
// text is rewritten to a variant with MORE lines (new ones before or after its own) or DIFFERENT lines
// (its own replaced by more new ones), so the Re-read writes more entries, or uses more revs before them,
// than the reply did live: the case where an entry keyed by rev runs into a later reply's (PROBLEMSKEY).
// The new lines are the fuzz's own change lines plus lines that raise problems (lines no module reads,
// lines a module refuses). `extraLines(r)` adds a host's own lines (a module the run registers).
// Not a test file (the test glob does not match helpers/).
import { changeLine } from './state-fuzz-gen.js';

// Lines that only raise problems: a kind nobody reads, a line that is no change, a bad item line, a quest
// line Story Block does not read (a Story Director host reads it and raises its own problem).
const BAD = ['+ dragon Smaug', 'not a change line', '* - item', '~ wound Ren — a scratch', '+ item', '~ quest Lost Road | step:'];
const SPARE = ['Spare Lantern', 'Edited Thing', 'Old Map'];

/** The lines of every <Changes> block of `text`, in order. */
export function linesOf(text) {
    const lines = [];
    for (const match of String(text).matchAll(/<Changes>\n?([\s\S]*?)<\/Changes>/g)) lines.push(...match[1].split('\n').filter(line => line.trim()));
    return lines;
}

/** One new line for an edit: a change line, a problem-raising line, a thing only edits give, or a host's own. */
function editLine(r, extraLines) {
    const roll = r.int(0, 9);
    if (roll <= 3) return changeLine(r);
    if (roll <= 6) return r.pick(BAD);
    if (roll <= 7 || !extraLines) return `+ item ${r.pick(SPARE)} | qty: ${r.int(1, 3)}`;
    return r.pick(extraLines(r));
}

/** { text, kind, added }: the edited reply. `kind` is 'more-before', 'more-after' or 'different'. */
export function editedText(r, text, { extraLines = null } = {}) {
    const own = linesOf(text);
    // (the story before its block, shown or hidden: capture hides a read block in an HTML comment)
    const story = String(text).split(/<!-- STORY_SUITE_V2|<Changes>/)[0].replace(/\n\(edited\)\s*$/, '').trimEnd() || 'A reply.';
    const kind = r.pick(['more-before', 'more-after', 'different']);
    const count = r.int(1, 6) + (kind === 'different' ? own.length : 0);
    const added = Array.from({ length: count }, () => editLine(r, extraLines));
    const lines = kind === 'more-before' ? [...added, ...own] : kind === 'more-after' ? [...own, ...added] : added;
    return { text: `${story}\n(edited)\n<Changes>\n${lines.join('\n')}\n</Changes>`, kind, added };
}
