import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const LITERAL_IMPORT = /\bimport\(\s*(['"])([^'"\n]+)\1\s*\)/g;

// The two things the bundler is told about this package, as one plugin:
// 1. What belongs to SillyTavern stays as written: an absolute path ('/script.js') or a relative one that
//    leaves the package ('../../../extensions.js'). The relative form is rewritten from the package folder,
//    where the chunks sit, so it keeps the depth the host expects.
// 2. A literal import('./x.js') of a module not listed as lazy is awaited at startup anyway; it is packed into
//    the entry and loaded on demand in place (a lazily initialised module, the same order and the same promise),
//    instead of becoming a request of its own. Lazy modules keep a real import() and stay separate chunks.
function packagePlugin(pkgDir, repoRoot, lazy) {
  const inside = abs => !path.relative(pkgDir, abs).startsWith('..');
  return { name: 'package', setup(b) {
    b.onResolve({ filter: /^(\.|\/)/ }, args => {
      if (args.kind === 'entry-point') return undefined;
      if (args.path.startsWith('/')) return args.path.startsWith(repoRoot) ? undefined : { path: args.path, external: true };
      const abs = path.resolve(args.resolveDir, args.path);
      return inside(abs) ? undefined : { path: path.relative(pkgDir, abs), external: true };
    });
    b.onLoad({ filter: /\.js$/ }, args => {
      if (!inside(args.path)) return undefined;
      const source = fs.readFileSync(args.path, 'utf8');
      if (!source.includes('import(')) return undefined;
      const contents = source.replace(LITERAL_IMPORT, (whole, quote, spec) => {
        if (!spec.startsWith('.')) return whole;
        const abs = path.resolve(path.dirname(args.path), spec);
        if (!inside(abs) || lazy.has(path.relative(pkgDir, abs))) return whole;
        return `Promise.resolve().then(() => require(${quote}${spec}${quote}))`;
      });
      return { contents, loader: 'js' };
    });
  } };
}

// Packs one bundle set into outDir: ES modules, code splitting for the lazy parts, source maps kept, sources
// untouched. Returns the names of the files written.
export async function buildBundleSet(set, outDir, repoRoot) {
  fs.rmSync(outDir, { recursive: true, force: true });
  const pkgDir = path.join(repoRoot, set.dir);
  const result = await build({
    absWorkingDir: pkgDir, entryPoints: set.entries, outdir: outDir, entryNames: '[name]', chunkNames: '[name]-[hash]',
    bundle: true, splitting: true, format: 'esm', target: 'es2022', sourcemap: true, legalComments: 'none',
    plugins: [packagePlugin(pkgDir, repoRoot, new Set(set.lazy))], metafile: true, logLevel: 'silent',
  });
  return Object.keys(result.metafile.outputs).map(file => path.basename(file)).sort();
}
