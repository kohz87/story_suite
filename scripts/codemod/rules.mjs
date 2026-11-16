// Reads codemod layout rule files and matches a repo path to the longest rule prefix, with stem handling.
import fs from 'node:fs';

/**
 * Validates one parsed rule file ({ area, scope?, rules: [{ from, to, stem? }] }) and returns it normalised.
 * `to: null` means the files are deleted; `stem: true` also covers `x.*` and `x-parts/` next to `x/`.
 */
export function parseRules(data) {
  if (!data || typeof data.area !== 'string' || !data.area) throw new Error('rule file needs a string "area"');
  if (!Array.isArray(data.rules)) throw new Error(`rule file "${data.area}" needs a "rules" array`);
  const seen = new Set();
  const rules = data.rules.map((rule, index) => {
    const where = `rule ${index} of "${data.area}"`;
    if (typeof rule.from !== 'string' || !rule.from || rule.from.startsWith('/') || rule.from.endsWith('/')) throw new Error(`${where}: "from" must be a repo-relative path without a trailing slash`);
    if (rule.to !== null && (typeof rule.to !== 'string' || !rule.to || rule.to.endsWith('/'))) throw new Error(`${where}: "to" must be a path without a trailing slash, or null`);
    if (seen.has(rule.from)) throw new Error(`${where}: duplicate "from" ${rule.from}`);
    seen.add(rule.from);
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
  if (filePath === from) return '';
  if (filePath.startsWith(`${from}/`)) return filePath.slice(from.length);
  if (!rule.stem) return null;
  if (filePath === `${from}-parts` || filePath.startsWith(`${from}-parts/`)) return filePath.slice(from.length);
  if (filePath.startsWith(`${from}.`) && !filePath.slice(from.length).includes('/')) return filePath.slice(from.length);
  return null;
}

/**
 * Matches a repo path against rules (an array of normalised rule objects). The longest `from` wins. A tie cannot
 * happen: two rules of one length can only both match a path when their `from` strings are equal, and `parseRules`
 * refuses duplicates. Returns { rule, to } (`to` is null for a delete) or null.
 */
export function matchPath(rules, filePath) {
  let best = null;
  for (const rule of rules) {
    const rest = restAfter(rule, filePath);
    if (rest === null) continue;
    if (!best || rule.from.length > best.rule.from.length) best = { rule, rest };
  }
  if (!best) return null;
  return { rule: best.rule, to: best.rule.to === null ? null : best.rule.to + best.rest };
}
