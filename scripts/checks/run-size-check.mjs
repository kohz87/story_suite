import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { listCodeFiles } from './code-files.mjs';
import { countLines } from './count-lines.mjs';
import { checkLegacyRatchet, decideBase } from './legacy-ratchet.mjs';
import { nulProblem } from './nul-check.mjs';
import { LINE_LIMIT, checkSizes, parseLegacyList } from './file-size.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const legacyRelPath = 'docs/merge/legacy-oversize.txt';
const legacyAbsPath = path.join(repoRoot, legacyRelPath);

// Ratchet note: the import commit has no legacy list, so the push that creates the list (stage B1)
// cannot be ratcheted; every later push and pull request is compared with a base that has the list.
const writeLegacy = process.argv.includes('--write-legacy');
const baseFlag = process.argv.indexOf('--base');
const baseRef = baseFlag >= 0 ? process.argv[baseFlag + 1] : undefined;
if (baseFlag >= 0 && !baseRef) {
  console.error('size check: --base needs a git ref');
  process.exit(1);
}

function git(args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

// Reads the legacy list at the base ref and decides what to do with it; any git failure other than
// "the path is not in that commit" is an error.
function readBase(ref) {
  let resolved;
  try {
    resolved = git(['rev-parse', '--verify', `${ref}^{commit}`]).trim();
  } catch (error) {
    return decideBase({ ref, resolved: '', read: { error: String(error.stderr || error.message).trim() } });
  }
  let read;
  try {
    git(['cat-file', '-e', `${resolved}:${legacyRelPath}`]);
    read = { text: git(['show', `${resolved}:${legacyRelPath}`]) };
  } catch (error) {
    const missing = error.status === 1 && !String(error.stderr || '').trim()
      || /does not exist|exists on disk, but not in/.test(String(error.stderr));
    read = missing ? { missing: true } : { error: String(error.stderr || error.message).trim() };
  }
  return decideBase({ ref, resolved, read });
}

let baseList = null;
if (baseRef) {
  const decision = readBase(baseRef);
  if (decision.error) {
    console.error(`size check: ${decision.error}`);
    process.exit(1);
  }
  if (decision.list !== undefined) baseList = parseLegacyList(decision.list);
}

const codePaths = listCodeFiles(repoRoot);
const texts = new Map(codePaths.map(relPath => [relPath, fs.readFileSync(path.join(repoRoot, relPath), 'utf8')]));
const files = codePaths.map(relPath => ({ path: relPath, lines: countLines(texts.get(relPath)) }));

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
for (const [relPath, text] of texts) {
  const problem = nulProblem(relPath, text);
  if (problem) errors.push(problem);
}
if (baseList) errors.push(...checkLegacyRatchet({ current: legacy, base: baseList }).errors);
else if (!baseRef) console.log('size check: no --base given; the legacy-list ratchet was not applied');
else console.log(`size check: ${baseRef} is the import commit, which has no list; ratchet skipped`);

if (errors.length > 0) {
  for (const err of errors) console.error(err);
  process.exit(1);
}

console.log(
  `size check: ${files.length} files, all within ${LINE_LIMIT} lines or on the legacy list (${legacy.size} listed)`,
);
