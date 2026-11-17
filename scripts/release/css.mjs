import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

// The extension's stylesheet (manifest "css") is a list of @import lines in the source tree. The build joins them, in order, into that one
// file at the same path, so a start loads one CSS file. Rules are not touched (no minify); a font or image named by url() is copied to the
// same path under outDir, so the url written in the bundle (relative to the stylesheet at the extension root) still resolves.
const ASSETS = ['.woff', '.woff2', '.ttf', '.otf', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'];

/** Bundles `entry` (a path under repoRoot) into outDir/<entry>; returns the written file names relative to outDir. Does nothing if the entry is missing. */
export async function bundleStylesheet(repoRoot, outDir, entry) {
  if (!entry || !fs.existsSync(path.join(repoRoot, entry))) return [];
  const result = await build({
    absWorkingDir: path.resolve(repoRoot), entryPoints: [{ in: path.resolve(repoRoot, entry), out: entry.replace(/\.css$/, '') }], outdir: outDir, outbase: path.resolve(repoRoot),
    bundle: true, loader: Object.fromEntries(ASSETS.map(ext => [ext, 'file'])), assetNames: '[dir]/[name]', logLevel: 'silent', metafile: true, legalComments: 'inline',
  });
  return Object.keys(result.metafile.outputs).map(file => path.relative(outDir, path.resolve(repoRoot, file)));
}

const IMPORT = /@import\s+(?:url\(\s*)?['"]([^'"]+)['"]/g;

/** How many stylesheet files a start fetches: the entry plus every local @import still in the built output (none, once bundled). */
export function stylesheetRequests(outDir, entry) {
  const seen = new Set();
  const queue = entry ? [entry] : [];
  while (queue.length) {
    const file = queue.shift();
    if (seen.has(file) || !fs.existsSync(path.join(outDir, file))) continue;
    seen.add(file);
    const text = fs.readFileSync(path.join(outDir, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const [, spec] of text.matchAll(IMPORT)) if (!/^(https?:)?\/\//.test(spec) && !spec.startsWith('data:')) queue.push(path.posix.normalize(path.posix.join(path.posix.dirname(file), spec)));
  }
  return seen.size;
}
