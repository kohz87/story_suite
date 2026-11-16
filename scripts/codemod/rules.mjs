// Reads codemod layout rule files and matches a repo path to the longest rule prefix, with stem handling.
import fs from 'node:fs';

/** The name a rule is unique by: `x` and `x*` clash (they would both take x/..), so the star is not part of it. */
export function ruleKey(rule) {
  return rule.from.endsWith('*') ? rule.from.slice(0, -1) : rule.from;
}

/**
 * Validates one parsed rule file ({ area, scope?, rules: [{ from, to, stem? }] }) and returns it normalised.
 * `to: null` means the files are deleted; `stem: true` also covers `x.*` and `x-parts/` next to `x/`. A `from` ending
 * in `*` is a name prefix (`dir/npc-meters*` takes every path that starts `dir/npc-meters`); its `to` must end in `*` too
 * (or be null), and what follows the prefix is kept.
 */
export function parseRules(data) {
  if (!data || typeof data.area !== 'string' || !data.area) throw new Error('rule file needs a string "area"');
  if (!Array.isArray(data.rules)) throw new Error(`rule file "${data.area}" needs a "rules" array`);
  const seen = new Set();
  const rules = data.rules.map((rule, index) => {
    const where = `rule ${index} of "${data.area}"`;
    if (typeof rule.from !== 'string' || !rule.from || rule.from.startsWith('/') || rule.from.endsWith('/')) throw new Error(`${where}: "from" must be a repo-relative path without a trailing slash`);
    if (rule.to !== null && (typeof rule.to !== 'string' || !rule.to || rule.to.endsWith('/'))) throw new Error(`${where}: "to" must be a path without a trailing slash, or null`);
    const prefix = rule.from.endsWith('*');
    if (prefix && (rule.from.slice(0, -1).includes('*') || rule.from.length < 2 || rule.from.endsWith('/*'))) throw new Error(`${where}: a name-prefix "from" is one name followed by a single *`);
    if (prefix && rule.to !== null && !rule.to.endsWith('*')) throw new Error(`${where}: a name-prefix rule needs a "to" that ends in * (or null)`);
    if (!prefix && typeof rule.to === 'string' && rule.to.includes('*')) throw new Error(`${where}: "to" has a * but "from" is not a name prefix`);
    if (seen.has(ruleKey(rule))) throw new Error(`${where}: duplicate "from" ${rule.from}`);
    seen.add(ruleKey(rule));
    return { from: rule.from, to: rule.to, stem: rule.stem === true };
  });
  const scope = data.scope === undefined ? null : data.scope;
  if (scope !== null && (!Array.isArray(scope) || scope.some(item => typeof item !== 'string'))) throw new Error(`rule file "${data.area}": "scope" must be an array of path prefixes`);
  return { area: data.area, scope, rules };
}

/** Reads and validates a rule file from disk. */
export function loadRules(file) {
  return parseRules(JSON.parse(fs.readFileSync(file, 'utf8')));
}

function restAfter(rule, filePath) {
  const { from } = rule;
  if (from.endsWith('*')) return filePath.startsWith(from.slice(0, -1)) ? filePath.slice(from.length - 1) : null;
  if (filePath === from) return '';
  if (filePath.startsWith(`${from}/`)) return filePath.slice(from.length);
  if (!rule.stem) return null;
  if (filePath === `${from}-parts` || filePath.startsWith(`${from}-parts/`)) return filePath.slice(from.length);
  if (filePath.startsWith(`${from}.`) && !filePath.slice(from.length).includes('/')) return filePath.slice(from.length);
  return null;
}

/**
 * Matches a repo path against rules (an array of normalised rule objects). The longest `from` wins. Two rules with
 * the same name (`ruleKey`) tie: `parseRules` refuses that inside one file and `buildPlan` across files, and here
 * it throws, so the order of the rules never decides. Returns { rule, to } (`to` is null for a delete) or null.
 */
export function matchPath(rules, filePath) {
  let best = null;
  for (const rule of rules) {
    const rest = restAfter(rule, filePath);
    if (rest === null) continue;
    if (best && ruleKey(rule) === ruleKey(best.rule)) throw new Error(`two rules have the same name ${ruleKey(rule)} (${best.rule.from}, ${rule.from})`);
    if (!best || ruleKey(rule).length > ruleKey(best.rule).length) best = { rule, rest };
  }
  if (!best) return null;
  const base = best.rule.to === null ? null : best.rule.to.replace(/\*$/, '');
  return { rule: best.rule, to: base === null ? null : base + best.rest };
}
