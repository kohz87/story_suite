export const LINE_LIMIT = 450;

/**
 * Parses a legacy-oversize list ("path count" lines), ignoring blanks and # comments.
 */
export function parseLegacyList(text) {
  const map = new Map();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(\S+)\s+(\d+)$/);
    if (match) map.set(match[1], Number(match[2]));
  }
  return map;
}

/**
 * Checks file line counts against LINE_LIMIT and the legacy-oversize allowlist.
 */
export function checkSizes({ files, legacy }) {
  const findings = [];
  const seen = new Set();

  for (const { path: filePath, lines } of files) {
    seen.add(filePath);
    const legacyLimit = legacy.get(filePath);
    if (legacyLimit === undefined) {
      if (lines > LINE_LIMIT) {
        findings.push({ path: filePath, message: `${filePath}: ${lines} lines (limit ${LINE_LIMIT})` });
      }
      continue;
    }
    if (lines <= LINE_LIMIT) {
      findings.push({
        path: filePath,
        message: `${filePath}: now ${lines} lines; remove it from the legacy list`,
      });
    } else if (lines > legacyLimit) {
      findings.push({
        path: filePath,
        message: `${filePath}: grew from ${legacyLimit} to ${lines} lines`,
      });
    }
  }

  for (const legacyPath of legacy.keys()) {
    if (!seen.has(legacyPath)) {
      findings.push({
        path: legacyPath,
        message: `${legacyPath}: listed in the legacy list but missing`,
      });
    }
  }

  findings.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { errors: findings.map(f => f.message) };
}
