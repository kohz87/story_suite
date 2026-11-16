import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { PACK_MODULE, PACK_SOURCE, rewriteSource } from './rewrite.mjs';
import { assertSafeOut, claimOutDir } from './outdir.mjs';

// The place SillyTavern serves the extension from. Host specifiers are URLs: they are resolved against this, so
// the result does not depend on where the checkout sits on disk. The folder name never changes a relative depth.
const SERVED = 'http://host/scripts/extensions/third-party/suite';

// The two things the bundler is told about the extension, as one plugin:
// 1. What belongs to SillyTavern stays as written: an absolute path ('/script.js') or a relative one that
//    leaves the repo ('../../../../../../extensions.js'). The repo root is the extension folder, so a host specifier is
//    written for the depth of the file that carries it; it is resolved as a URL from where that file is served
//    (SERVED/<file's folder>) and rewritten from the extension folder, where the chunks sit, so it keeps the
//    depth the host expects. A file inside the repo is bundled; only a specifier that leaves the repo stays external.
// 2. A literal import('./x.js') of a module not listed as lazy is awaited at startup anyway; it is packed into
//    the entry and loaded on demand in place (a lazily initialised module that starts once, in the same order),
//    instead of becoming a request of its own. Lazy and eager modules keep a real import() and stay separate chunks.
// 3. import.meta.url keeps naming the module's original location (see rewrite.mjs), so assets beside it resolve.
function packagePlugin(repoRoot, lazy) {
  const inRepo = abs => !path.relative(repoRoot, abs).startsWith('..');
  return { name: 'package', setup(b) {
    b.onResolve({ filter: /^release:pack$/ }, args => ({ path: `${PACK_MODULE}@${path.relative(repoRoot, args.importer).split(path.sep).join('/')}`, namespace: 'release' }));
    b.onLoad({ filter: /.*/, namespace: 'release' }, () => ({ contents: PACK_SOURCE, loader: 'js' }));
    b.onResolve({ filter: /^(\.|\/)/ }, args => {
      if (args.kind === 'entry-point') return undefined;
      if (args.path.startsWith('/')) return args.path.startsWith(repoRoot) ? undefined : { path: args.path, external: true };
      const abs = path.resolve(args.resolveDir, args.path);
      if (inRepo(abs)) return undefined;
      const folder = path.relative(repoRoot, args.resolveDir).split(path.sep).filter(Boolean).join('/');
      const target = new URL(args.path, `${SERVED}/${folder ? `${folder}/` : ''}`).pathname;
      const rel = path.posix.relative(new URL(SERVED).pathname, target);
      return { path: rel.startsWith('.') ? rel : `./${rel}`, external: true };
    });
    b.onLoad({ filter: /\.js$/ }, args => {
      if (!inRepo(args.path)) return undefined;
      const source = fs.readFileSync(args.path, 'utf8');
      if (!source.includes('import(') && !source.includes('import.meta')) return undefined;
      const file = path.relative(repoRoot, args.path).split(path.sep).join('/');
      const packKey = spec => {
        const key = path.relative(repoRoot, path.resolve(path.dirname(args.path), spec)).split(path.sep).join('/');
        return fs.existsSync(path.join(repoRoot, key)) && !lazy.has(key) ? key : null;
      };
      return { contents: rewriteSource(source, file, packKey), loader: 'js' };
    });
  } };
}

// Packs the extension's one bundle set into outDir (refused if that is inside the source; emptied only if the tool made it): ES modules, code splitting for the lazy parts, source maps kept, sources
// untouched. Returns the names of the files written.
export async function buildBundleSet(set, outDir, repoRoot) {
  assertSafeOut(outDir, repoRoot);
  claimOutDir(outDir);
  const result = await build({
    absWorkingDir: path.resolve(repoRoot), entryPoints: set.entries.map(entry => ({ in: path.resolve(repoRoot, entry), out: path.basename(entry, '.js') })), outdir: outDir, entryNames: '[name]', chunkNames: '[name]-[hash]',
    bundle: true, splitting: true, format: 'esm', target: 'es2022', sourcemap: true, legalComments: 'none',
    plugins: [packagePlugin(repoRoot, new Set([...set.lazy, ...(set.eager ?? [])]))], metafile: true, logLevel: 'silent',
  });
  return Object.keys(result.metafile.outputs).map(file => path.basename(file)).sort();
}
