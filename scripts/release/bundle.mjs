import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { PACK_MODULE, PACK_SOURCE, rewriteSource } from './rewrite.mjs';
import { assertSafeOut, claimOutDir } from './outdir.mjs';
import { fromPackage } from './layout-paths.mjs';

// The place SillyTavern serves an extension from. Host specifiers are URLs: they are resolved against this, so
// the result does not depend on where the checkout sits on disk.
const SERVED = 'http://host/scripts/extensions/third-party';

// The two things the bundler is told about this package, as one plugin:
// 1. What belongs to SillyTavern stays as written: an absolute path ('/script.js') or a relative one that
//    leaves the package ('../../../extensions.js'). The relative form is resolved as a URL from where the importer
//    is served (SERVED/<folder>/<file>) and rewritten from the package folder, where the chunks sit, so it keeps the
//    depth the host expects whatever the checkout's own depth.
//    A file inside the repo (any source root, whichever package folder it sits in) is bundled; only a specifier that
//    leaves the repo, or names a file the repo does not have (a host file), stays external.
//    A set may carry installAt: the folder it is installed in when that is deeper than the folder its host
//    specifiers were written for (set.name); they are still resolved from set.name and rewritten from installAt.
// 2. A literal import('./x.js') of a module not listed as lazy is awaited at startup anyway; it is packed into
//    the entry and loaded on demand in place (a lazily initialised module that starts once, in the same order),
//    instead of becoming a request of its own. Lazy modules keep a real import() and stay separate chunks.
// 3. import.meta.url keeps naming the module's original location (see rewrite.mjs), so assets beside it resolve.
function packagePlugin(pkgDir, repoRoot, lazy, folder, installAt) {
  const inRepo = abs => !path.relative(repoRoot, abs).startsWith('..');
  const inside = abs => !path.relative(pkgDir, abs).startsWith('..') || (inRepo(abs) && fs.existsSync(abs));
  return { name: 'package', setup(b) {
    b.onResolve({ filter: /^release:pack$/ }, () => ({ path: PACK_MODULE, namespace: 'release' }));
    b.onLoad({ filter: /.*/, namespace: 'release' }, () => ({ contents: PACK_SOURCE, loader: 'js' }));
    b.onResolve({ filter: /^(\.|\/)/ }, args => {
      if (args.kind === 'entry-point') return undefined;
      if (args.path.startsWith('/')) return args.path.startsWith(repoRoot) ? undefined : { path: args.path, external: true };
      const abs = path.resolve(args.resolveDir, args.path);
      if (inside(abs)) return undefined;
      const dirInPackage = path.relative(pkgDir, args.resolveDir).split(path.sep).filter(Boolean).join('/');
      const target = new URL(args.path, `${SERVED}/${folder}/${dirInPackage ? `${dirInPackage}/` : ''}`).pathname;
      const rel = path.posix.relative(`/scripts/extensions/third-party/${installAt}`, target);
      return { path: rel.startsWith('.') ? rel : `./${rel}`, external: true };
    });
    b.onLoad({ filter: /\.js$/ }, args => {
      if (!inside(args.path)) return undefined;
      const source = fs.readFileSync(args.path, 'utf8');
      if (!source.includes('import(') && !source.includes('import.meta')) return undefined;
      const file = path.relative(pkgDir, args.path).split(path.sep).join('/');
      const packKey = spec => {
        const target = path.resolve(path.dirname(args.path), spec);
        const key = path.relative(pkgDir, target).split(path.sep).join('/');
        return inside(target) && !lazy.has(key) ? key : null;
      };
      return { contents: rewriteSource(source, file, packKey), loader: 'js' };
    });
  } };
}

// Packs one bundle set into outDir (refused if that is inside the source; emptied only if the tool made it): ES modules, code splitting for the lazy parts, source maps kept, sources
// untouched. Returns the names of the files written.
export async function buildBundleSet(set, outDir, repoRoot) {
  assertSafeOut(outDir, repoRoot);
  claimOutDir(outDir);
  const pkgDir = path.join(repoRoot, set.dir);
  const result = await build({
    absWorkingDir: pkgDir, entryPoints: set.entries.map(entry => path.isAbsolute(entry) ? entry : fromPackage(repoRoot, set.dir, entry)), outdir: outDir, entryNames: '[name]', chunkNames: '[name]-[hash]',
    bundle: true, splitting: true, format: 'esm', target: 'es2022', sourcemap: true, legalComments: 'none',
    plugins: [packagePlugin(pkgDir, repoRoot, new Set(set.lazy.map(name => fromPackage(repoRoot, set.dir, name))), set.name, set.installAt ?? set.name)], metafile: true, logLevel: 'silent',
  });
  return Object.keys(result.metafile.outputs).map(file => path.basename(file)).sort();
}
