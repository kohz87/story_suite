/**
 * Counts lines in text; empty text is 0 and a trailing newline adds no extra line.
 */
export function countLines(text) {
  if (!text) return 0;
  const trimmed = text.endsWith('\n') ? text.slice(0, -1) : text;
  return trimmed.split('\n').length;
}
