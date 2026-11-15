import { parse } from 'acorn';
import { simple } from 'acorn-walk';
import { findCommonJs } from './find-commonjs.mjs';
import { isFacade } from './is-facade.mjs';
import { collectNames } from './pattern-names.mjs';

const OPTIONS = { ecmaVersion: 'latest', sourceType: 'module' };

const exp = (name, kind, signature = name, from) => ({ name, kind, signature, from });

function declarationExports(decl, source) {
  if (decl.type === 'FunctionDeclaration') {
    const params = source.slice(decl.params[0]?.start ?? 0, decl.params.at(-1)?.end ?? 0);
    return [exp(decl.id.name, 'function', `${decl.id.name}(${params.replace(/\s+/g, ' ').trim()})`)];
  }
  if (decl.type === 'ClassDeclaration') return [exp(decl.id.name, 'class', `class ${decl.id.name}`)];
  return decl.declarations.flatMap(d => collectNames(d.id)).map(name => exp(name, 'const'));
}

function moduleName(node) {
  return node.type === 'Literal' ? String(node.value) : node.name;
}

function exportsOf(node, source) {
  if (node.type === 'ExportDefaultDeclaration') return [exp('default', 'default')];
  if (node.type === 'ExportAllDeclaration') {
    const from = String(node.source.value);
    if (node.exported) return [exp(moduleName(node.exported), 'reexport')];
    return [exp('*', 'star', `* from '${from}'`, from)];
  }
  if (node.declaration) return declarationExports(node.declaration, source);
  const kind = node.source ? 'reexport' : 'binding';
  return node.specifiers.map(s => exp(moduleName(s.exported), kind));
}

/**
 * Extracts exports, import specifiers (source order) and CommonJS use from ES module source text.
 * A file that cannot be parsed as a module yields one `unparsable` export carrying the error message.
 */
export function parseModule(source) {
  let ast;
  try {
    ast = parse(source, OPTIONS);
  } catch (error) {
    return { exports: [exp('?', 'unparsable', String(error.message))], imports: [], commonJs: false, facade: false };
  }
  const list = [];
  const found = [];
  for (const node of ast.body) {
    if (node.type.startsWith('Export')) list.push(...exportsOf(node, source));
    if (node.source) found.push(node);
  }
  simple(ast, {
    ImportExpression(node) {
      if (node.source.type === 'Literal' && typeof node.source.value === 'string') found.push(node);
    },
  });
  const imports = found
    .map(node => ({ at: node.start, spec: String(node.source.value) }))
    .sort((a, b) => a.at - b.at)
    .map(item => item.spec);
  return { exports: list, imports, commonJs: findCommonJs(ast), facade: list.length > 0 && isFacade(ast) };
}
