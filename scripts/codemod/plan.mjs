// Turns tracked files plus rule sets into a move/delete plan and refuses unmatched files, collisions, clobbered targets and live imports of deletes.
import { execFileSync } from 'node:child_process';
import { matchPath, ruleKey } from './rules.mjs';
import { resolveSpecifier, scanSpecifiers } from './specifiers.mjs';

/** Lists the repo's tracked files (sorted) with `git ls-files`. */
export function trackedFiles(root) {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 });
  return out.split('\0').filter(Boolean).sort();
}

/**
 * Builds { moves: [{from,to}], deletes: [path], unmatched: [path], deadRules: [{area,from}], collisions: [{to,sources}], existing: [{from,to}], chains: [{from,to}], duplicates: [{key,areas}] }.
 * A "duplicate" is one rule name (`from`, a trailing * ignored) given by two rule sets; order never decides, so it fails the plan.
 * A "chain" is a move whose target is another move's source (a rename chain or a swap); `git mv` would fail on it.
 * A file is "unmatched" when no rule covers it and it lies under a rule file's `scope` (any file, when no rule
 * file gives a scope). A "dead rule" matches no tracked file; it is a warning, not a failure. Files whose target
 * equals their own path are not moves.
 */
export function buildPlan(files, ruleSets) {
  const rules = ruleSets.flatMap(set => set.rules);
  const scopes = ruleSets.map(set => set.scope);
  const everything = scopes.some(scope => scope === null);
  const prefixes = scopes.flatMap(scope => scope ?? []);
  const inScope = file => everything || prefixes.some(prefix => file === prefix || file.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`));
  const plan = { moves: [], deletes: [], unmatched: [], deadRules: [], collisions: [], existing: [], chains: [], duplicates: [] };
  const owners = new Map();
  for (const set of ruleSets) for (const key of new Set(set.rules.map(ruleKey))) owners.set(key, [...(owners.get(key) ?? []), set.area]);
  for (const [key, areas] of owners) if (areas.length > 1) plan.duplicates.push({ key, areas });
  if (plan.duplicates.length) return plan;
  for (const set of ruleSets) {
    for (const rule of set.rules) {
      if (!files.some(file => matchPath([rule], file))) plan.deadRules.push({ area: set.area, from: rule.from });
    }
  }
  for (const file of files) {
    const hit = matchPath(rules, file);
    if (!hit) { if (inScope(file)) plan.unmatched.push(file); continue; }
    if (hit.to === null) plan.deletes.push(file);
    else if (hit.to !== file) plan.moves.push({ from: file, to: hit.to });
  }
  const moveSources = new Set(plan.moves.map(move => move.from));
  const sources = new Set([...moveSources, ...plan.deletes]);
  const fileSet = new Set(files);
  const byTarget = new Map();
  for (const move of plan.moves) {
    byTarget.set(move.to, [...(byTarget.get(move.to) ?? []), move.from]);
    if (moveSources.has(move.to)) plan.chains.push(move);
    else if (fileSet.has(move.to) && !sources.has(move.to)) plan.existing.push(move);
  }
  for (const [to, from] of byTarget) if (from.length > 1) plan.collisions.push({ to, sources: from });
  return plan;
}

/**
 * Lists what is wrong with a plan, as sentences; an empty list means it may be applied. With `{ files, readFile }`,
 * also refuses a delete that a kept JS file still imports or reads with `new URL(..., import.meta.url)`. A
 * planned-delete importer is ignored: its tests go with it. Non-literal URL reads go into `warnings` when supplied.
 */
export function planProblems(plan, { files = null, readFile = null, warnings = null } = {}) {
  const references = deletedReferences(plan, files, readFile);
  if (warnings) warnings.push(...references.warnings);
  return [
    ...plan.duplicates.map(item => `rule "${item.key}" is given by more than one rule file (${item.areas.join(', ')})`),
    ...plan.unmatched.map(file => `no rule covers ${file}`),
    ...plan.collisions.map(item => `${item.sources.join(', ')} all move to ${item.to}`),
    ...plan.chains.map(move => `${move.from} moves to ${move.to}, which is itself moved (a rename chain or swap)`),
    ...plan.existing.map(move => `${move.from} would overwrite the existing ${move.to}`),
    ...references.problems,
  ];
}

/** Finds imports and URL reads of a deleted file in kept files, grouped by the deleted target. */
function deletedReferences(plan, files, readFile) {
  if (!files || !readFile || !plan.deletes.length) return { problems: [], warnings: [] };
  const allFiles = new Set(files);
  const deleted = new Set(plan.deletes);
  const importers = new Map();
  const warnings = new Set();
  for (const file of files) {
    if (deleted.has(file) || !/\.(?:mjs|js)$/.test(file)) continue;
    let source;
    try { source = readFile(file); } catch { continue; }
    const scan = scanSpecifiers(source);
    if (scan.error) continue;
    for (const item of scan.specs) {
      const hit = resolveSpecifier(file, item.spec, allFiles, item.kind === 'url');
      if (!hit || !deleted.has(hit.target)) continue;
      importers.set(hit.target, [...(importers.get(hit.target) ?? []), file]);
    }
    for (const item of scan.nonLiteral) {
      if (item.kind === 'url') warnings.add(`${file}:${item.line}: non-literal URL reference cannot be checked against planned deletes`);
    }
  }
  const problems = [...importers]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([target, from]) => `plan deletes ${target}, still imported by ${[...new Set(from)].sort().join(', ')}`);
  return { problems, warnings: [...warnings].sort() };
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
