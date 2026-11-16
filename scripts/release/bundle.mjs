import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { PACK_MODULE, PACK_SOURCE, rewriteSource } from './rewrite.mjs';

// The two things the bundler is told about this package, as one plugin:
// 1. What belongs to SillyTavern stays as written: an absolute path ('/script.js') or a relative one that
//    leaves the package ('../../../extensions.js'). The relative form is rewritten from the package folder,
//    where the chunks sit, so it keeps the depth the host expects.
// 2. A literal import('./x.js') of a module not listed as lazy is awaited at startup anyway; it is packed into
//    the entry and loaded on demand in place (a lazily initialised module that starts once, in the same order),
//    instead of becoming a request of its own. Lazy modules keep a real import() and stay separate chunks.
// 3. import.meta.url keeps naming the module's original location (see rewrite.mjs), so assets beside it resolve.
function packagePlugin(pkgDir, repoRoot, lazy) {
  const inside = abs => !path.relative(pkgDir, abs).startsWith('..');
  return { name: 'package', setup(b) {
    b.onResolve({ filter: /^release:pack$/ }, () => ({ path: PACK_MODULE, namespace: 'release' }));
    b.onLoad({ filter: /.*/, namespace: 'release' }, () => ({ contents: PACK_SOURCE, loader: 'js' }));
    b.onResolve({ filter: /^(\.|\/)/ }, args => {
      if (args.kind === 'entry-point') return undefined;
      if (args.path.startsWith('/')) return args.path.startsWith(repoRoot) ? undefined : { path: args.path, external: true };
      const abs = path.resolve(args.resolveDir, args.path);
      return inside(abs) ? undefined : { path: path.relative(pkgDir, abs), external: true };
    });
    b.onLoad({ filter: /\.js$/ }, args => {
      if (!inside(args.path)) return undefined;
      const source = fs.readFileSync(args.path, 'utf8');
      if (!source.includes('import(') && !source.includes('import.meta')) return undefined;
      const file = path.relative(pkgDir, args.path).split(path.sep).join('/');
      const packKey = spec => {
        const key = path.relative(pkgDir, path.resolve(path.dirname(args.path), spec));
        return !key.startsWith('..') && !lazy.has(key) ? key.split(path.sep).join('/') : null;
      };
      return { contents: rewriteSource(source, file, packKey), loader: 'js' };
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
