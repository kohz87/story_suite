import { packageMap } from './package-map.mjs';

const readJson = (text, fallback) => (text ? JSON.parse(text) : fallback);

/**
 * The package map documents: one `{ mapPath, markdown, problems, summary }` per directory under
 * packages/ that has code files. `readOptional` returns a repo file's text or '' when it is missing.
 */
export function packageOutputs({ files, readSource, readOptional }) {
  const names = [...new Set(files.map(p => /^packages\/([^/]+)\//.exec(p)?.[1]).filter(Boolean))].sort();
  return names.map(pkg => {
    const prefix = `packages/${pkg}/`;
    const result = packageMap({
      pkg,
      files: files.filter(p => p.startsWith(prefix)),
      readSource,
      explicitJobs: readJson(readOptional(`docs/codemap/jobs-${pkg}.json`), {}),
      devMapText: readOptional(`${prefix}docs/dev/codemap.md`),
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
