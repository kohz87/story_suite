// Story Suite v2: the small text helpers every capture file shares (regex escape, line length cap, whitespace tests).

export const escapeRe = text => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A change line longer than this is not read (a Problem says so): no real change needs it.
export const MAX_LINE = 2000;

const SPACE = /\s/;
export const isSpace = char => char !== undefined && SPACE.test(char);
// `text` without the whitespace at its end (String#trimEnd is linear; `/\s+$/` is not in V8).
export const trimEnd = text => text.trimEnd();
