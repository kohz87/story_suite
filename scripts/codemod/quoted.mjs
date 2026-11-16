// Reads the quoted strings of one source line so two lines can be compared with their string values emptied.

// A regex literal is skipped whole (a quote inside it is not a string); it is told from a division by what precedes it.
const REGEX = String.raw`(?<=^|[(,=:\[!&|?{};]\s*)\/(?![*/])(?:[^/\\\n\[]|\\.|\[(?:[^\]\\\n]|\\.)*\])+\/[dgimsuvy]*`;
const QUOTED = String.raw`(['"\`])((?:(?!\1)[^\\]|\\.)*)\1`;
const TOKEN = new RegExp(`${REGEX}|${QUOTED}`, 'g');

/** The line with every quoted string emptied, so two lines that differ only in a path compare equal. */
export const flatten = line => line.replace(TOKEN, (whole, quote) => (quote ? `${quote}${quote}` : whole)).trim();

/** The values of the quoted strings in a line, in order (a regex literal is not one). */
export const quotedValues = line => [...line.matchAll(TOKEN)].filter(match => match[1]).map(match => match[2]);
