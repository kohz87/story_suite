import fs from 'node:fs';
import path from 'node:path';
import { listCodeFiles } from './code-files.mjs';
import { countLines } from './count-lines.mjs';
import { LINE_LIMIT, checkSizes, parseLegacyList } from './file-size.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const legacyRelPath = 'docs/merge/legacy-oversize.txt';
const legacyAbsPath = path.join(repoRoot, legacyRelPath);

const writeLegacy = process.argv.includes('--write-legacy');
const codePaths = listCodeFiles(repoRoot);
const files = codePaths.map(relPath => ({
  path: relPath,
  lines: countLines(fs.readFileSync(path.join(repoRoot, relPath), 'utf8')),
}));

if (writeLegacy) {
  const oversize = files.filter(f => f.lines > LINE_LIMIT);
  const header = [
    '# Legacy files over 450 lines imported from the three old repos at B1.',
    '# Format: <repo-relative path> <line count>.',
    '# This list may only shrink — split a file when it moves out of packages/.',
  ];
  const body = oversize.map(f => `${f.path} ${f.lines}`);
  fs.mkdirSync(path.dirname(legacyAbsPath), { recursive: true });
  fs.writeFileSync(legacyAbsPath, [...header, ...body].join('\n') + '\n', 'utf8');
  console.log(`wrote ${legacyRelPath} (${oversize.length} files)`);
  process.exit(0);
}

const legacyText = fs.existsSync(legacyAbsPath) ? fs.readFileSync(legacyAbsPath, 'utf8') : '';
const legacy = parseLegacyList(legacyText);
const { errors } = checkSizes({ files, legacy });

if (errors.length > 0) {
  for (const err of errors) console.error(err);
  process.exit(1);
}

console.log(
  `size check: ${files.length} files, all within ${LINE_LIMIT} lines or on the legacy list (${legacy.size} listed)`,
);
