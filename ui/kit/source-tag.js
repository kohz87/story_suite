// Shows a stored evidence quote's leading "[mN]" tag as SillyTavern's "#N" message number. Display only: nothing stored changes.

const LEADING_TAG = /^(\s*)\[m(\d+)\]\s*/i;

/** "[m12] she laughed" → "#12 — she laughed"; a bare tag → "#12"; no leading tag (or a tag mid-text) → the text unchanged. */
export function showSourceTag(value) {
  const text = String(value ?? '');
  const found = LEADING_TAG.exec(text);
  if (!found) return text;
  const rest = text.slice(found[0].length);
  return rest ? `${found[1]}#${found[2]} — ${rest}` : `${found[1]}#${found[2]}`;
}
