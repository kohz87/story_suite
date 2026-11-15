import { parse } from 'acorn';
import { simple } from 'acorn-walk';
import { collectNames } from './pattern-names.mjs';

const OPTIONS = { ecmaVersion: 'latest', sourceType: 'module' };

const exp = (name, kind, signature = name) => ({ name, kind, signature });

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
    const name = node.exported ? moduleName(node.exported) : '*';
    return [exp(name, 'reexport')];
  }
  if (node.declaration) return declarationExports(node.declaration, source);
  const kind = node.source ? 'reexport' : 'binding';
  return node.specifiers.map(s => exp(moduleName(s.exported), kind));
}

// Names the file declares itself (variables, parameters); a local `exports` or `module` is not CommonJS.
function declaredNames(ast) {
  const names = new Set();
  const addAll = patterns => patterns.forEach(p => collectNames(p).forEach(n => names.add(n)));
  const fn = node => addAll(node.params);
  simple(ast, {
    VariableDeclarator(node) { addAll([node.id]); },
    FunctionDeclaration: fn,
    FunctionExpression: fn,
    ArrowFunctionExpression: fn,
    CatchClause(node) { if (node.param) addAll([node.param]); },
  });
  return names;
}

function findCommonJs(ast) {
  const local = declaredNames(ast);
  const isRoot = node => {
    if (node.type === 'Identifier') return node.name === 'exports' && !local.has('exports');
    if (node.type !== 'MemberExpression') return false;
    const isModuleExports = node.object.type === 'Identifier' && node.object.name === 'module'
      && !local.has('module') && !node.computed && node.property.name === 'exports';
    return isModuleExports || isRoot(node.object);
  };
  let found = false;
  simple(ast, {
    AssignmentExpression(node) { if (isRoot(node.left)) found = true; },
    MemberExpression(node) { if (isRoot(node)) found = true; },
    CallExpression(node) { if (node.arguments.some(isRoot)) found = true; },
  });
  return found;
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
    return { exports: [exp('?', 'unparsable', String(error.message))], imports: [], commonJs: false };
  }
  const exports = [];
  const found = [];
  for (const node of ast.body) {
    if (node.type.startsWith('Export')) exports.push(...exportsOf(node, source));
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
  return { exports, imports, commonJs: findCommonJs(ast) };
}
