// Turns tracked files plus rule sets into a move/delete plan and refuses unmatched files, collisions and clobbered targets.
import { execFileSync } from 'node:child_process';
import { matchPath } from './rules.mjs';

/** Lists the repo's tracked files (sorted) with `git ls-files`. */
export function trackedFiles(root) {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 });
  return out.split('\0').filter(Boolean).sort();
}

/**
 * Builds { moves: [{from,to}], deletes: [path], unmatched: [path], collisions: [{to,sources}], existing: [{from,to}] }.
 * A file is "unmatched" when no rule covers it and it lies under a rule file's `scope` (any file, when no rule
 * file gives a scope). Files whose target equals their own path are not moves.
 */
export function buildPlan(files, ruleSets) {
  const rules = ruleSets.flatMap(set => set.rules);
  const scopes = ruleSets.map(set => set.scope);
  const everything = scopes.some(scope => scope === null);
  const prefixes = scopes.flatMap(scope => scope ?? []);
  const inScope = file => everything || prefixes.some(prefix => file === prefix || file.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`));
  const plan = { moves: [], deletes: [], unmatched: [], collisions: [], existing: [] };
  for (const file of files) {
    const hit = matchPath(rules, file);
    if (!hit) { if (inScope(file)) plan.unmatched.push(file); continue; }
    if (hit.to === null) plan.deletes.push(file);
    else if (hit.to !== file) plan.moves.push({ from: file, to: hit.to });
  }
  const sources = new Set([...plan.moves.map(move => move.from), ...plan.deletes]);
  const fileSet = new Set(files);
  const byTarget = new Map();
  for (const move of plan.moves) {
    byTarget.set(move.to, [...(byTarget.get(move.to) ?? []), move.from]);
    if (fileSet.has(move.to) && !sources.has(move.to)) plan.existing.push(move);
  }
  for (const [to, from] of byTarget) if (from.length > 1) plan.collisions.push({ to, sources: from });
  return plan;
}

/** Lists what is wrong with a plan, as sentences; an empty list means it may be applied. */
export function planProblems(plan) {
  return [
    ...plan.unmatched.map(file => `no rule covers ${file}`),
    ...plan.collisions.map(item => `${item.sources.join(', ')} all move to ${item.to}`),
    ...plan.existing.map(move => `${move.from} would overwrite the existing ${move.to}`),
  ];
}

/**
 * Returns { map(path) } that gives the new path of a file or folder: a moved file's target, a deleted
 * path's null, otherwise whatever the rules say for it (folders), otherwise the path unchanged.
 */
export function makeMapper(plan, ruleSets) {
  const rules = ruleSets.flatMap(set => set.rules);
  const moved = new Map(plan.moves.map(move => [move.from, move.to]));
  const deleted = new Set(plan.deletes);
  return {
    map(filePath) {
      if (moved.has(filePath)) return moved.get(filePath);
      if (deleted.has(filePath)) return null;
      const hit = matchPath(rules, filePath);
      return hit ? hit.to : filePath;
    },
  };
}
