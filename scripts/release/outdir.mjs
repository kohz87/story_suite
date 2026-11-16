import fs from 'node:fs';
import path from 'node:path';

// Where the release build may write. The output folder is never inside the source and never holds anything the tool
// did not create: every folder it fills carries a marker file, and only a folder with the marker is ever emptied.
export const MARKER = '.story-suite-release-output';
const SOURCE_DIRS = ['packages', 'ui', 'scripts', 'tests'];

// The real path of a folder that may not exist yet: the nearest existing parent, resolved, plus the rest.
function realish(target) {
  const rest = [];
  let probe = path.resolve(target);
  while (!fs.existsSync(probe)) { rest.unshift(path.basename(probe)); probe = path.dirname(probe); }
  return path.join(fs.realpathSync(probe), ...rest);
}
const within = (outer, inner) => { const rel = path.relative(outer, inner); return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel)); };

// Throws unless `out` is a safe place to write: not the repo root or a parent of it, and not equal to, inside or
// around packages/, ui/, scripts/ or tests/.
export function assertSafeOut(out, repoRoot) {
  const target = realish(out);
  const root = realish(repoRoot);
  if (within(target, root)) throw new Error(`release: --out ${out} is the repository or contains it; choose a folder such as dist/release`);
  for (const dir of SOURCE_DIRS) {
    const source = path.join(root, dir);
    if (within(source, target) || within(target, source)) throw new Error(`release: --out ${out} is inside or around ${dir}/, which is source; choose a folder such as dist/release`);
  }
}

// Gives back an empty folder carrying the marker. An existing folder is emptied only if it carries the marker
// (or is empty); anything else is refused and left as it is.
export function claimOutDir(dir) {
  if (fs.existsSync(dir)) {
    const marked = fs.existsSync(path.join(dir, MARKER));
    if (!marked && (!fs.statSync(dir).isDirectory() || fs.readdirSync(dir).length)) throw new Error(`release: ${dir} exists and was not made by the release build (no ${MARKER}); not deleting it`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, MARKER), 'Made by scripts/release.mjs; safe to delete.\n');
}
