import fs from 'node:fs';
import path from 'node:path';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

function importsOf(source) {
  const staticSpecs = [];
  const dynamicSpecs = [];
  const nonLiteral = [];
  const tree = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  walk.full(tree, node => {
    if ((node.type === 'ImportDeclaration' || node.type === 'ExportAllDeclaration' || node.type === 'ExportNamedDeclaration') && node.source) staticSpecs.push(node.source.value);
    if (node.type === 'ImportExpression') (node.source.type === 'Literal' ? dynamicSpecs : nonLiteral).push(node.source.value ?? null);
  });
  return { staticSpecs, dynamicSpecs, nonLiteral: nonLiteral.length };
}

// Walks a bundle folder from one entry file, without running it. `loaded` is the entry plus everything its
// static imports pull in (the requests of the load); `lazy` is what only an import() reaches (fetched later);
// `missing` lists a relative specifier that names a file the folder does not have. Host specifiers ('/script.js',
// anything starting '../') are not files of the bundle and are listed as `host`.
export function walkBundle(outDir, entry) {
  const specsOf = new Map();
  const host = new Set();
  const missing = [];
  const reach = (from, pick) => {
    const found = new Set([from]);
    const queue = [from];
    while (queue.length) {
      const file = queue.shift();
      if (!specsOf.has(file)) specsOf.set(file, importsOf(fs.readFileSync(path.join(outDir, file), 'utf8')));
      const { staticSpecs, dynamicSpecs } = specsOf.get(file);
      for (const spec of pick(staticSpecs, dynamicSpecs)) {
        if (spec.startsWith('/') || spec.startsWith('../')) { host.add(spec); continue; }
        const target = path.posix.normalize(spec);
        if (!fs.existsSync(path.join(outDir, target))) { missing.push(`${file} -> ${spec}`); continue; }
        if (!found.has(target)) { found.add(target); queue.push(target); }
      }
    }
    return found;
  };
  const loaded = reach(entry, staticSpecs => staticSpecs);
  const everything = reach(entry, (staticSpecs, dynamicSpecs) => [...staticSpecs, ...dynamicSpecs]);
  return {
    loaded: [...loaded].sort(),
    lazy: [...everything].filter(file => !loaded.has(file)).sort(),
    host: [...host].sort(),
    missing: [...new Set(missing)].sort(),
  };
}
