import { packageMap } from './package-map.mjs';

const readJson = (text, fallback) => (text ? JSON.parse(text) : fallback);

/**
 * The package map documents: one `{ mapPath, markdown, problems, summary }` per directory under
 * a package root (scripts/layout.json) that has code files. `readOptional` returns a repo file's text or '' when it is missing.
 */
export function packageOutputs({ files, readSource, readOptional, layout }) {
  const roots = new Map(files.map(p => [layout.packageRootOf(p), layout.packageOf(p)]).filter(([dir, name]) => dir && name));
  const names = [...new Set(roots.values())].sort();
  return names.map(pkg => {
    const dir = [...roots].find(([, name]) => name === pkg)[0];
    const prefix = `${dir}/`;
    const result = packageMap({
      pkg,
      prefix,
      files: files.filter(p => p.startsWith(prefix)),
      readSource,
      explicitJobs: readJson(readOptional(`docs/codemap/jobs-${pkg}.json`), {}),
      devMapText: readOptional(`${prefix}${layout.packageDevMap}`),
      features: readJson(readOptional(`docs/codemap/features-${pkg}.json`), []),
    });
    return {
      mapPath: `docs/codemap/${pkg}.md`,
      markdown: result.markdown,
      problems: result.problems,
      summary: `${pkg} ${result.rows} files, ${result.lines} lines (${result.backlog} over the export limit)`,
    };
  });
}
