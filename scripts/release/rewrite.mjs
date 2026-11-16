import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

// The two source rewrites of the bundle step, done on the syntax tree so a comment or a string that only
// looks like code is never touched. `source` is one module of the package; `file` is its path from the
// package root (posix); `packKey(spec)` answers the package-relative path of a relative import('./x.js') that is
// packed into the entry, or null when it stays a real import() (a lazy module, or one outside the package).
// 1. import('./x.js') of a module that is not lazy becomes a lazily initialised module (the bundler's require wrapper)
//    behind PACK_HELPER's once(): one promise per module, so, as with a real import(), the module starts once, every
//    caller gets the same namespace object (shaped like a real one) and a failure at start is the same error each time.
// 2. import.meta.url becomes new URL('<file>', import.meta.url).href: the chunks sit at the package root, so this
//    names the module's original location again, and a stylesheet or asset next to it resolves as in the source.
export const PACK_MODULE = 'release:pack';
export const PACK_SOURCE = [
  'const made = new Map();',
  '// What a real import() resolves to: a module namespace (no prototype, tagged Module, sorted keys, closed, live values).',
  'const asNamespace = mod => {',
  '  const ns = Object.create(null);',
  '  for (const key of Object.keys(mod).sort()) Object.defineProperty(ns, key, { enumerable: true, get: () => mod[key] });',
  "  Object.defineProperty(ns, Symbol.toStringTag, { value: 'Module' });",
  '  return Object.preventExtensions(ns);',
  '};',
  'export const once = (key, make) => { if (!made.has(key)) made.set(key, make().then(asNamespace)); return made.get(key); };',
  '',
].join('\n');

export function rewriteSource(source, file, packKey) {
  const edits = [];
  let packed = false;
  const tree = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true });
  walk.full(tree, node => {
    if (node.type === 'ImportExpression' && !node.options && node.source.type === 'Literal' && typeof node.source.value === 'string' && node.source.value.startsWith('.') && packKey(node.source.value)) {
      packed = true;
      edits.push([node.start, node.end, `__releasePackOnce(${JSON.stringify(packKey(node.source.value))}, () => Promise.resolve().then(() => require(${node.source.raw})))`]);
    }
    if (node.type === 'MemberExpression' && !node.computed && node.property.name === 'url' && node.object.type === 'MetaProperty' && node.object.meta.name === 'import') {
      edits.push([node.start, node.end, `new URL(${JSON.stringify(file)}, import.meta.url).href`]);
    }
  });
  let out = source;
  for (const [start, end, text] of edits.sort((a, b) => b[0] - a[0])) out = out.slice(0, start) + text + out.slice(end);
  return packed ? `${out}\nimport { once as __releasePackOnce } from ${JSON.stringify(PACK_MODULE)};\n` : out;
}

// How many import.meta uses in bundled code are not the rewritten form new URL('<file>', import.meta.url).href.
export function strayImportMeta(code) {
  const tree = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true });
  let total = 0;
  let rewritten = 0;
  walk.full(tree, node => {
    if (node.type === 'MetaProperty') total += 1;
    const [path, base] = node.type === 'NewExpression' && node.callee.name === 'URL' ? node.arguments : [];
    if (path?.type === 'Literal' && base?.type === 'MemberExpression' && base.object.type === 'MetaProperty' && base.property.name === 'url') rewritten += 1;
  });
  return total - rewritten;
}
