import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { listCodeFiles } from './code-files.mjs';
import { countLines } from './count-lines.mjs';
import { checkLegacyRatchet } from './legacy-ratchet.mjs';
import { LINE_LIMIT, checkSizes, parseLegacyList } from './file-size.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const legacyRelPath = 'docs/merge/legacy-oversize.txt';
const legacyAbsPath = path.join(repoRoot, legacyRelPath);

const writeLegacy = process.argv.includes('--write-legacy');
const baseFlag = process.argv.indexOf('--base');
const baseRef = baseFlag >= 0 ? process.argv[baseFlag + 1] : undefined;

// The legacy list at the base ref, or null when there is no base, the ref is unknown, or it has no list.
function readBaseList(ref) {
  if (!ref) return null;
  try {
    const text = execFileSync('git', ['show', `${ref}:${legacyRelPath}`], {
      cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
    return parseLegacyList(text);
  } catch {
    return null;
  }
}
const baseList = readBaseList(baseRef);

const codePaths = listCodeFiles(repoRoot);
const files = codePaths.map(relPath => ({
  path: relPath,
  lines: countLines(fs.readFileSync(path.join(repoRoot, relPath), 'utf8')),
}));

if (writeLegacy) {
  const oversize = files.filter(f => f.lines > LINE_LIMIT);
  if (baseList) {
    const added = oversize.filter(f => !baseList.has(f.path));
    if (added.length > 0) {
      for (const f of added) console.error(`${f.path}: not in the base legacy list; split it instead of listing it`);
      process.exit(1);
    }
  }
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
if (baseList) errors.push(...checkLegacyRatchet({ current: legacy, base: baseList }).errors);
else if (baseRef) console.log(`size check: no legacy list at ${baseRef}; ratchet skipped`);

if (errors.length > 0) {
  for (const err of errors) console.error(err);
  process.exit(1);
}

console.log(
  `size check: ${files.length} files, all within ${LINE_LIMIT} lines or on the legacy list (${legacy.size} listed)`,
);
