/**
 * Renders a package's feature entry-point index. `features` is `[{ name, entry, about }]`; every entry
 * must be a file in the map, so a renamed or removed entry point is reported as a problem.
 */
export function renderFeatures(features, fileSet, featuresFile) {
  const problems = [];
  const lines = ['', '## Feature entry points', ''];
  if (features.length === 0) problems.push(`${featuresFile}: no feature entry points listed`);
  lines.push('| Feature | Start reading at | What it covers |', '|---|---|---|');
  for (const { name, entry, about } of features) {
    if (!name || !entry || !about) problems.push(`${featuresFile}: every feature needs name, entry and about`);
    else if (!fileSet.has(entry)) problems.push(`${featuresFile}: feature "${name}" points at ${entry}, which is not a file in the map`);
    lines.push(`| ${name} | \`${entry}\` | ${about.replaceAll('|', '\\|')} |`);
  }
  return { lines, problems };
}
