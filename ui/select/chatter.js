// Reads the `chatter.replies` answer into the chat view's inner chatter blocks: one { index, lines: [{ name, text }] } per reply that has thoughts.

const text = value => (typeof value === 'string' ? value.trim() : '');

/** → [{ index, lines }] in chat order; a gap (the feature off, no answer), a reply without a name and a thought, and a bad index are left out. */
export function selectChatter(answer) {
  const out = [];
  for (const item of Array.isArray(answer) ? answer : []) {
    if (!item || !Number.isInteger(item.index) || item.index < 0) continue;
    const lines = (Array.isArray(item.lines) ? item.lines : []).map(row => ({ name: text(row?.name), text: text(row?.text) })).filter(row => row.name && row.text);
    if (lines.length) out.push({ index: item.index, lines });
  }
  return out;
}
