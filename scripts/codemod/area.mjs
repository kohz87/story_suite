// Narrows a whole-layout plan to the moves one area owns, so an area can be applied and verified alone.
import path from 'node:path';
import { matchPath, ruleKey } from './rules.mjs';
import { buildPlan, makeMapper } from './plan.mjs';

/** Returns a `file => area` function over all rule sets (null when no rule covers the file). */
export function areaOf(ruleSets) {
  const rules = ruleSets.flatMap(set => set.rules);
  const owner = new Map();
  for (const set of ruleSets) for (const rule of set.rules) owner.set(ruleKey(rule), set.area);
  return file => {
    const hit = matchPath(rules, file);
    return hit ? owner.get(ruleKey(hit.rule)) : null;
  };
}

/**
 * Plans `files` with ALL rule sets (so every file has its owner), then keeps only what `area` owns: its moves,
 * deletes, dead rules, and the collisions, chains and overwrites that involve one of its files. Unmatched files and
 * duplicate rule names are not any area's, so duplicates block every area. An unmatched file has no owner either; it blocks
 * the area only when it sits in a folder the area moves or deletes files out of (it would be stranded there), so another
 * area's rule gap does not hold this area up (it is still listed by `plan` and fails `plan --all`). Returns { plan }.
 */
export function planForArea(files, ruleSets, area) {
  const full = buildPlan(files, ruleSets);
  if (!ruleSets.some(set => set.area === area)) throw new Error(`no rule set for area ${area}`);
  if (full.duplicates.length) return { plan: full };
  const owns = file => areaOf(ruleSets)(file) === area;
  const dirs = new Set([...full.moves.map(move => move.from), ...full.deletes].filter(owns).map(file => path.posix.dirname(file)));
  const plan = {
    moves: full.moves.filter(move => owns(move.from)),
    deletes: full.deletes.filter(owns),
    unmatched: full.unmatched.filter(file => dirs.has(path.posix.dirname(file))),
    deadRules: full.deadRules.filter(rule => rule.area === area),
    collisions: full.collisions.filter(item => item.sources.some(owns)),
    existing: full.existing.filter(move => owns(move.from)),
    chains: full.chains.filter(move => owns(move.from)),
    duplicates: [],
  };
  return { plan };
}

/**
 * Like `makeMapper`, but only paths the area owns are mapped: another area's file or folder stays where it is (its
 * longest rule may be a different area's, so area-only matching would claim it wrongly).
 */
export function areaMapper(plan, ruleSets, area) {
  const base = makeMapper(plan, ruleSets);
  const owner = areaOf(ruleSets);
  return { map: filePath => (owner(filePath) === area ? base.map(filePath) : filePath) };
}
