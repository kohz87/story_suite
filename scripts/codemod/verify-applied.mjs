// Verifies an applied area: the tree (against what already failed before the move) and the two-commit diff.
import fs from 'node:fs';
import path from 'node:path';
import { unresolvedBaseline } from './baseline.mjs';
import { areaMapper, planForArea } from './area.mjs';
import { verifyDiff, verifyTree } from './verify.mjs';

/**
 * Verifies the result at `root`; `base` is the commit before the moves, `moves` the move commit and `head` the
 * rewrite commit (defaults HEAD~1 and HEAD; fix-up commits after the rewrite commit are judged by the tree check only).
 * With `codemap` it also runs the code map check (off by default: a moved tree needs its map regenerated and may need renames first).
 * Returns { problems, dataFiles } where dataFiles names the non-JS files the rewrite commit changed.
 */
export function verifyApplied(root, ruleSets, area, base, { codemap = false, moves = 'HEAD~1', head = 'HEAD' } = {}) {
  const hasCodemap = codemap && fs.existsSync(path.join(root, 'scripts/codemap/cli.mjs'));
  const before = unresolvedBaseline(root, base);
  const { plan } = planForArea([...before.files].sort(), ruleSets, area);
  const mapper = areaMapper(plan, ruleSets, area);
  const baseline = new Map([...before.counts].map(([file, count]) => [mapper.map(file), count]));
  const diff = verifyDiff(root, base, moves, head, ruleSets, { area });
  return { problems: [...verifyTree(root, ruleSets, { codemap: hasCodemap, area, baseline }), ...diff.problems], dataFiles: diff.dataFiles };
}
