// Small checks and the one-line text cleaner shared by the mood parts.

export const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
export const isFiniteNumber = value => typeof value === 'number' && Number.isFinite(value);

/** Plain text on one line: control characters and the line-grammar '|' become spaces, runs collapse, ends trim. */
export function flatText(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/[\r\n\t|]+/g, ' ').replace(/\s+/g, ' ').trim();
}
