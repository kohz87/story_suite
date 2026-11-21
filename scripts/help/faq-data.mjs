import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The Help page's text: docs/FAQ.md is the one source and ui/settings/help-faq-data.js holds it as a string, so the release bundle carries it (no file to fetch).
// node scripts/help/faq-data.mjs --write | --check (npm run codemap writes it; npm run check compares it).
const SOURCE = 'docs/FAQ.md';
const TARGET = 'ui/settings/help-faq-data.js';

/** The text of ui/settings/help-faq-data.js for the FAQ markdown `markdown`. */
export function renderFaqData(markdown) {
  return `// Generated from docs/FAQ.md by scripts/help/faq-data.mjs (npm run codemap); do not edit by hand.\nexport const FAQ_MARKDOWN = ${JSON.stringify(markdown.replace(/\r\n/g, '\n'))};\n`;
}

function main(mode, root) {
  const text = renderFaqData(fs.readFileSync(path.join(root, SOURCE), 'utf8'));
  const file = path.join(root, TARGET);
  if (mode === '--write') { fs.writeFileSync(file, text, 'utf8'); console.log(`wrote ${TARGET}`); return; }
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) { console.error(`${TARGET} is stale: run npm run codemap`); process.exit(1); }
  console.log(`${TARGET} up to date`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2];
  if (mode !== '--write' && mode !== '--check') { console.error('usage: node scripts/help/faq-data.mjs --write|--check'); process.exit(1); }
  main(mode, path.resolve(import.meta.dirname, '../..'));
}
