// Reads the FAQ markdown (docs/FAQ.md) into questions with their paragraphs, and a paragraph into plain, bold, code and link pieces.

/**
 * Splits the markdown at its `## ` headings: `[{ title, paragraphs: [string] }]`. Text before the first heading is dropped; a blank line ends a paragraph.
 */
export function parseFaq(markdown) {
  const entries = [];
  let entry = null;
  let lines = [];
  const close = () => { if (entry && lines.length) entry.paragraphs.push(lines.join(' ')); lines = []; };
  for (const raw of String(markdown ?? '').replace(/\r\n/g, '\n').split('\n')) {
    const heading = /^##\s+(.+?)\s*$/.exec(raw);
    if (heading) { close(); entry = { title: heading[1], paragraphs: [] }; entries.push(entry); continue; }
    if (!entry || /^#\s/.test(raw)) continue;
    if (raw.trim() === '') close(); else lines.push(raw.trim());
  }
  close();
  return entries;
}

const PIECE = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;

/**
 * Splits one paragraph into `{ text }`, `{ bold }`, `{ code }` and `{ label, to }` pieces. A link `settings:<id>` has `page: <id>` (a Settings page); any other link keeps its label as plain text.
 */
export function inlinePieces(text) {
  const pieces = [];
  let at = 0;
  const plain = s => { if (s) pieces.push({ text: s }); };
  for (const m of String(text).matchAll(PIECE)) {
    plain(text.slice(at, m.index));
    if (m[1] !== undefined) pieces.push({ bold: m[1] });
    else if (m[2] !== undefined) pieces.push({ code: m[2] });
    else if (m[4].startsWith('settings:')) pieces.push({ label: m[3], page: m[4].slice(9) });
    else plain(m[3]);
    at = m.index + m[0].length;
  }
  plain(text.slice(at));
  return pieces;
}

/** The plain words of an entry (title and every paragraph, markup removed), for searching. */
export function entryText(entry) {
  return [entry.title, ...entry.paragraphs.map(p => inlinePieces(p).map(x => x.text ?? x.bold ?? x.code ?? x.label).join(''))].join(' ').toLowerCase();
}
