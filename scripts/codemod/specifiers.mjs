// Finds every module specifier in a JS source with acorn and resolves a relative one against a file set.
import path from 'node:path';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

const EXTENSIONS = ['', '.js', '.mjs', '.json', '/index.js', '/index.mjs'];

function isImportMetaUrl(node) {
  return node?.type === 'MemberExpression' && !node.computed && node.property.name === 'url'
    && node.object.type === 'MetaProperty' && node.object.meta.name === 'import';
}

/**
 * Scans a source for static `import` / `export ... from` / `export *`, dynamic `import(...)` and
 * `new URL(lit, import.meta.url)`. Returns { specs: [{ spec, start, end, kind, line }], nonLiteral: [{ kind, line }] }
 * where start/end cover the string literal including its quotes, or { error } when the source does not parse.
 */
export function scanSpecifiers(source) {
  let tree;
  try {
    tree = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true, allowReturnOutsideFunction: true, locations: true });
  } catch (error) {
    return { error: error.message };
  }
  const specs = [];
  const nonLiteral = [];
  const take = (node, kind) => {
    if (node?.type === 'Literal' && typeof node.value === 'string') specs.push({ spec: node.value, start: node.start, end: node.end, kind, line: node.loc.start.line });
    else nonLiteral.push({ kind, line: (node ?? {}).loc?.start.line ?? 0 });
  };
  walk.simple(tree, {
    ImportDeclaration: node => take(node.source, 'import'),
    ExportNamedDeclaration: node => { if (node.source) take(node.source, 'export'); },
    ExportAllDeclaration: node => take(node.source, 'export'),
    ImportExpression: node => take(node.source, 'dynamic'),
    NewExpression: node => {
      if (node.callee.type === 'Identifier' && node.callee.name === 'URL' && node.arguments.length === 2 && isImportMetaUrl(node.arguments[1])) take(node.arguments[0], 'url');
    },
  });
  return { specs, nonLiteral };
}

/**
 * Resolves a relative specifier written in `fromFile` against a Set of repo paths. Returns { target, added } (the
 * file it names and the suffix that was implied, such as ".js" or "/index.js") or null when nothing matches.
 * With `allowDir` a folder that holds files also resolves (for `new URL('..', import.meta.url)`).
 */
export function resolveSpecifier(fromFile, spec, files, allowDir = false) {
  if (!spec.startsWith('./') && !spec.startsWith('../') && spec !== '.' && spec !== '..') return null;
  const joined = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), spec)).replace(/\/$/, '');
  if (joined.startsWith('..')) return null;
  for (const added of EXTENSIONS) if (files.has(joined + added)) return { target: joined + added, added, dir: false };
  if (allowDir && (joined === '.' || [...files].some(file => file.startsWith(`${joined}/`)))) return { target: joined, added: '', dir: true };
  return null;
}
