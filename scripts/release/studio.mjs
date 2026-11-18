import fs from 'node:fs';
import path from 'node:path';

// The Pack Studio (studio/index.html) is a static page of ES modules that import the repo's own packs/, core/, ui/ and modules/ files by relative path.
// The release bundle does not hold it (nothing in the extension imports studio/), so the release copies it: studio/index.html and every file it reaches, at the
// same relative paths under the extension's output folder, so SillyTavern serves it at <extension>/studio/index.html and no path changes.
// Reaching = the page's <link href> and <script src>, a module's static and literal dynamic imports, `new URL('x', import.meta.url)` (the dry-run worker),
// and a stylesheet's @import and url(). A reference to a file that does not exist is a problem of the release, not a silent gap.
export const STUDIO_ENTRY = 'studio/index.html';

const JS_REF = [
  /(?:^|[\n;])\s*(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]/g,
  /(?:^|[\n;])\s*import\s*['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\bnew\s+URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g,
];
const CSS_REF = [/@import\s+(?:url\(\s*)?['"]([^'"]+)['"]/g, /url\(\s*['"]?([^'")\s]+)['"]?\s*\)/g];
const HTML_REF = [/<link\b[^>]*\bhref=["']([^"']+)["']/g, /<script\b[^>]*\bsrc=["']([^"']+)["']/g];
const LOCAL = spec => !/^([a-z][a-z0-9+.-]*:|\/\/|#|\/)/i.test(spec);
const refsOf = (file, text) => {
  const rules = file.endsWith('.html') ? HTML_REF : file.endsWith('.css') ? CSS_REF : file.endsWith('.js') ? JS_REF : [];
  const source = file.endsWith('.css') ? text.replace(/\/\*[\s\S]*?\*\//g, '') : text;
  return rules.flatMap(rule => [...source.matchAll(rule)].map(match => match[1].replace(/[?#].*$/, ''))).filter(LOCAL);
};

/** The files (paths from repoRoot, posix) the Studio page reaches, the page included, and the references that name a file that is missing: { files, missing }. */
export function studioFiles(repoRoot) {
  const files = new Set();
  const missing = [];
  const queue = [STUDIO_ENTRY];
  while (queue.length) {
    const file = queue.shift();
    if (files.has(file)) continue;
    const abs = path.join(repoRoot, file);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;
    files.add(file);
    const text = /\.(html|css|js)$/.test(file) ? fs.readFileSync(abs, 'utf8') : '';
    for (const spec of refsOf(file, text)) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
      if (target.startsWith('..')) missing.push(`${file} reaches outside the repository: ${spec}`);
      else if (!fs.existsSync(path.join(repoRoot, target))) missing.push(`${file} names ${spec}, which does not exist`);
      else queue.push(target);
    }
  }
  return { files: [...files].sort(), missing };
}

/** Copies the Studio and what it reaches into outDir (the extension's output folder) at the same relative paths; returns the problems found (none when it is whole). */
export function copyStudio(repoRoot, outDir) {
  const { files, missing } = studioFiles(repoRoot);
  const problems = missing.map(line => `studio: ${line}`);
  if (!files.includes(STUDIO_ENTRY)) return [`studio: ${STUDIO_ENTRY} is missing`];
  for (const file of files) {
    const to = path.join(outDir, file);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(repoRoot, file), to);
  }
  return problems;
}
