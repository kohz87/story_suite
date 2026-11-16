// Writes the generated Story Block copy of the one redraw scheduler; with --check, fails on drift.
// Any new generated file needs a move rule in scripts/codemod/layout/*.rules.json
// (this copy is moved to its area; J14 deletes it); `npm run layout:plan` fails on an unmatched file.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atEitherLayout } from './release/layout-paths.mjs';

export const HEADER = '// generated from ui/runtime/redraw.js; do not edit.\n';

export function expectedCopy(root) {
  return HEADER + fs.readFileSync(path.join(root, 'ui/runtime/redraw.js'), 'utf8');
}

export function syncRedrawCopy(root, check) {
  // named as of the old layout; found where the checkout has it (a missing copy is looked for in both places)
  const target = path.join(root, atEitherLayout(root, 'packages/story-block/src/v2/shared/redraw.js'));
  const want = expectedCopy(root);
  if (check) {
    const have = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
    return have === want ? 0 : 1;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, want);
  return 0;
}

if (path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.env.SYNC_REDRAW_ROOT || path.resolve(import.meta.dirname, '..');
  const check = process.argv.includes('--check');
  const code = syncRedrawCopy(root, check);
  if (code) console.error('redraw copy is out of date: run node scripts/sync-redraw-copy.mjs');
  process.exit(code);
}
